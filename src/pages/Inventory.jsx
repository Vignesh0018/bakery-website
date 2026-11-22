import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../styles/Inventory.css";

// Common units used in bakeries
const PRESET_UNITS = [
  "kg",
  "g",
  "litres",
  "ml",
  "pcs",
  "boxes",
  "bags",
  "trays",
  "packets",
  "bottles",
];

// Starter kit for bakery essentials
const BAKERY_DEFAULTS = [
  { item_name: "All-Purpose Flour", quantity: 50, unit: "kg", minimum_stock: 15 },
  { item_name: "Unsalted Butter", quantity: 20, unit: "kg", minimum_stock: 5 },
  { item_name: "Caster Sugar", quantity: 30, unit: "kg", minimum_stock: 10 },
  { item_name: "Fresh Whole Milk", quantity: 15, unit: "litres", minimum_stock: 5 },
  { item_name: "Large Farm Eggs", quantity: 180, unit: "pcs", minimum_stock: 60 },
  { item_name: "Active Dry Yeast", quantity: 5, unit: "kg", minimum_stock: 1.5 },
  { item_name: "Dark Chocolate 70%", quantity: 8, unit: "kg", minimum_stock: 3 },
  { item_name: "Cake Boxes (8-inch)", quantity: 60, unit: "pcs", minimum_stock: 25 },
];

function Inventory() {
  const navigate = useNavigate();

  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [adjustingId, setAdjustingId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const emptyForm = {
    item_name: "",
    quantity: "",
    unit: "kg",
    custom_unit: "",
    minimum_stock: "",
  };

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'healthy' | 'low' | 'out'
  const [sortBy, setSortBy] = useState("name_asc");

  // Fetch Inventory from Supabase
  const fetchInventory = async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: fetchErr } = await supabase
        .from("inventory")
        .select("*")
        .order("item_name", { ascending: true });

      if (fetchErr) throw fetchErr;
      setInventory(data || []);
    } catch (err) {
      setError(err.message || "Failed to load inventory items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadData = async () => {
      try {
        const [invRes, authRes] = await Promise.all([
          supabase
            .from("inventory")
            .select("*")
            .order("item_name", { ascending: true }),
          supabase.auth.getUser(),
        ]);

        if (!ignore) {
          if (invRes.error) throw invRes.error;
          setInventory(invRes.data || []);
          setCurrentUser(authRes?.data?.user || null);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Failed to load inventory items.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
          setCheckingAuth(false);
        }
      }
    };

    loadData();

    return () => {
      ignore = true;
    };
  }, []);

  // Form input changes
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Submit Add or Edit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const trimmedName = form.item_name.trim();
      if (!trimmedName) {
        throw new Error("Please enter an item name.");
      }

      const effectiveUnit =
        form.unit === "custom"
          ? (form.custom_unit || "").trim().toLowerCase() || "pcs"
          : form.unit;

      const qty = parseFloat(form.quantity);
      const minStock = parseFloat(form.minimum_stock);

      if (isNaN(qty) || qty < 0) {
        throw new Error("Quantity must be a valid number (0 or greater).");
      }

      if (isNaN(minStock) || minStock < 0) {
        throw new Error("Minimum stock must be a valid number (0 or greater).");
      }

      const payload = {
        item_name: trimmedName,
        quantity: qty,
        unit: effectiveUnit,
        minimum_stock: minStock,
      };

      if (editingId) {
        const { error: updateErr } = await supabase
          .from("inventory")
          .update(payload)
          .eq("id", editingId);

        if (updateErr) throw updateErr;

        setSuccess(`"${trimmedName}" updated successfully!`);
      } else {
        const { error: insertErr } = await supabase
          .from("inventory")
          .insert([payload]);

        if (insertErr) throw insertErr;

        setSuccess(`"${trimmedName}" added to inventory!`);
      }

      // Reset form
      setForm(emptyForm);
      setEditingId(null);
      setIsFormOpen(false);
      await fetchInventory();
    } catch (err) {
      if (err.code === "42501" || err.message?.includes("security policy")) {
        setError(
          "Permission denied: Please ensure you are logged in as an administrator to modify inventory."
        );
      } else {
        setError(err.message || "An unexpected error occurred.");
      }
    } finally {
      setSaving(false);
    }
  };

  // Edit item
  const handleEdit = (item) => {
    const isPresetUnit = PRESET_UNITS.includes(item.unit);
    setForm({
      item_name: item.item_name,
      quantity: item.quantity,
      unit: isPresetUnit ? item.unit : "custom",
      custom_unit: isPresetUnit ? "" : item.unit,
      minimum_stock: item.minimum_stock,
    });
    setEditingId(item.id);
    setIsFormOpen(true);
    setError("");
    setSuccess("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Cancel edit
  const cancelEdit = () => {
    setForm(emptyForm);
    setEditingId(null);
    setIsFormOpen(false);
    setError("");
    setSuccess("");
  };

  // Delete item
  const handleDelete = async (item) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${item.item_name}" from inventory?`
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const { error: deleteErr } = await supabase
        .from("inventory")
        .delete()
        .eq("id", item.id);

      if (deleteErr) throw deleteErr;

      setSuccess(`"${item.item_name}" removed from inventory.`);
      if (editingId === item.id) {
        cancelEdit();
      }
      await fetchInventory();
    } catch (err) {
      if (err.code === "42501" || err.message?.includes("security policy")) {
        setError(
          "Permission denied: Please ensure you are logged in as an administrator to delete items."
        );
      } else {
        setError(err.message || "Unable to delete inventory item.");
      }
    }
  };

  // Quick adjust stock quantity (+/-)
  const handleQuickAdjust = async (item, delta) => {
    const newQty = Math.max(0, parseFloat((item.quantity + delta).toFixed(2)));
    if (newQty === item.quantity) return;

    setAdjustingId(item.id);
    setError("");

    try {
      const { error: adjustErr } = await supabase
        .from("inventory")
        .update({ quantity: newQty })
        .eq("id", item.id);

      if (adjustErr) throw adjustErr;

      // Optimistically update local state
      setInventory((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, quantity: newQty } : i))
      );
    } catch (err) {
      if (err.code === "42501" || err.message?.includes("security policy")) {
        setError(
          "Permission denied: Please ensure you are logged in as an administrator to adjust stock."
        );
      } else {
        setError(err.message || "Failed to update stock quantity.");
      }
    } finally {
      setAdjustingId(null);
    }
  };

  // Seed sample bakery items
  const handleSeedDefaults = async () => {
    const confirmed = window.confirm(
      "Load standard bakery essentials (flour, sugar, butter, eggs, milk, yeast, etc.) into inventory?"
    );
    if (!confirmed) return;

    setSeeding(true);
    setError("");
    setSuccess("");

    try {
      const { error: seedErr } = await supabase
        .from("inventory")
        .insert(BAKERY_DEFAULTS);

      if (seedErr) throw seedErr;

      setSuccess("Sample bakery essentials added successfully!");
      await fetchInventory();
    } catch (err) {
      if (err.code === "42501" || err.message?.includes("security policy")) {
        setError(
          "Permission denied: Please ensure you are logged in as an administrator to add inventory."
        );
      } else {
        setError(err.message || "Failed to add sample items.");
      }
    } finally {
      setSeeding(false);
    }
  };

  // Metrics computation
  const metrics = useMemo(() => {
    let healthyCount = 0;
    let lowCount = 0;
    let outCount = 0;

    inventory.forEach((item) => {
      const qty = Number(item.quantity);
      const min = Number(item.minimum_stock);

      if (qty <= 0) {
        outCount += 1;
      } else if (qty <= min) {
        lowCount += 1;
      } else {
        healthyCount += 1;
      }
    });

    return {
      total: inventory.length,
      healthy: healthyCount,
      low: lowCount,
      out: outCount,
    };
  }, [inventory]);

  // Filtered and Sorted Inventory List
  const filteredInventory = useMemo(() => {
    let result = [...inventory];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.item_name.toLowerCase().includes(q) ||
          item.unit.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter === "healthy") {
      result = result.filter(
        (item) => Number(item.quantity) > Number(item.minimum_stock)
      );
    } else if (statusFilter === "low") {
      result = result.filter(
        (item) =>
          Number(item.quantity) > 0 &&
          Number(item.quantity) <= Number(item.minimum_stock)
      );
    } else if (statusFilter === "out") {
      result = result.filter((item) => Number(item.quantity) <= 0);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "name_asc") {
        return a.item_name.localeCompare(b.item_name);
      }
      if (sortBy === "name_desc") {
        return b.item_name.localeCompare(a.item_name);
      }
      if (sortBy === "qty_asc") {
        return Number(a.quantity) - Number(b.quantity);
      }
      if (sortBy === "qty_desc") {
        return Number(b.quantity) - Number(a.quantity);
      }
      if (sortBy === "min_desc") {
        return Number(b.minimum_stock) - Number(a.minimum_stock);
      }
      if (sortBy === "newest") {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      return 0;
    });

    return result;
  }, [inventory, searchQuery, statusFilter, sortBy]);

  // Helper function to get status details
  const getItemStatus = (qty, min) => {
    if (qty <= 0) {
      return {
        label: "Out of Stock",
        className: "inventory-badge-out",
        progressClass: "inventory-progress-out",
        percent: 0,
      };
    }
    if (qty <= min) {
      const pct = Math.min(100, Math.round((qty / (min || 1)) * 50));
      return {
        label: "Low Stock",
        className: "inventory-badge-low",
        progressClass: "inventory-progress-low",
        percent: pct,
      };
    }
    const safeRatio = min > 0 ? (qty / min) * 50 : 100;
    const pct = Math.min(100, Math.round(safeRatio));
    return {
      label: "In Stock",
      className: "inventory-badge-healthy",
      progressClass: "inventory-progress-healthy",
      percent: Math.max(50, pct),
    };
  };

  return (
    <div className="inventory-page">
      {/* Top Header */}
      <div className="inventory-header">
        <div className="inventory-header-left">
          <h1>Inventory Management</h1>
          <p>Track raw baking ingredients, packaging supplies, and stock levels.</p>
        </div>

        <div className="inventory-header-actions">
          <button
            type="button"
            className="inventory-btn inventory-btn-secondary"
            onClick={() => navigate("/admin/dashboard")}
          >
            ← Back to Dashboard
          </button>

          <button
            type="button"
            className="inventory-btn inventory-btn-secondary"
            onClick={fetchInventory}
            disabled={loading}
          >
            🔄 {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            className="inventory-btn inventory-btn-primary"
            onClick={() => {
              if (isFormOpen && !editingId) {
                setIsFormOpen(false);
              } else {
                setForm(emptyForm);
                setEditingId(null);
                setIsFormOpen(true);
              }
            }}
          >
            {isFormOpen && !editingId ? "✕ Close Form" : "+ Add New Item"}
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {success && (
        <div className="inventory-banner inventory-banner-success">
          <span>✓ {success}</span>
          <button
            className="inventory-banner-close"
            onClick={() => setSuccess("")}
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="inventory-banner inventory-banner-error">
          <span>⚠️ {error}</span>
          <button
            className="inventory-banner-close"
            onClick={() => setError("")}
          >
            ✕
          </button>
        </div>
      )}

      {/* Low Stock Warning Banner */}
      {(metrics.low > 0 || metrics.out > 0) && (
        <div className="inventory-banner inventory-banner-warning">
          <span>
            ⚠️ <strong>Attention Baker:</strong> {metrics.low + metrics.out} item(s) are low or out of stock! Consider placing supplier orders.
          </span>
          <button
            type="button"
            className="inventory-btn inventory-btn-secondary"
            style={{ padding: "6px 14px", fontSize: "13px" }}
            onClick={() => setStatusFilter("low")}
          >
            View Low Stock ({metrics.low})
          </button>
        </div>
      )}

      {/* Metrics / Stats Cards */}
      <div className="inventory-stats-grid">
        <div
          className={`inventory-stat-card ${statusFilter === "all" ? "active-filter" : ""}`}
          onClick={() => setStatusFilter("all")}
        >
          <div className="inventory-stat-header">
            <span className="inventory-stat-title">Total Items</span>
            <span className="inventory-stat-icon">📦</span>
          </div>
          <p className="inventory-stat-value">{metrics.total}</p>
          <span className="inventory-stat-desc">Tracked in bakery inventory</span>
        </div>

        <div
          className={`inventory-stat-card ${statusFilter === "healthy" ? "active-filter" : ""}`}
          onClick={() => setStatusFilter("healthy")}
        >
          <div className="inventory-stat-header">
            <span className="inventory-stat-title">In Stock</span>
            <span className="inventory-stat-icon">🟢</span>
          </div>
          <p className="inventory-stat-value" style={{ color: "#2e7d32" }}>
            {metrics.healthy}
          </p>
          <span className="inventory-stat-desc">Above reorder threshold</span>
        </div>

        <div
          className={`inventory-stat-card ${statusFilter === "low" ? "active-filter" : ""}`}
          onClick={() => setStatusFilter("low")}
        >
          <div className="inventory-stat-header">
            <span className="inventory-stat-title">Low Stock</span>
            <span className="inventory-stat-icon">🟠</span>
          </div>
          <p className="inventory-stat-value" style={{ color: "#e65100" }}>
            {metrics.low}
          </p>
          <span className="inventory-stat-desc">At or below minimum stock</span>
        </div>

        <div
          className={`inventory-stat-card ${statusFilter === "out" ? "active-filter" : ""}`}
          onClick={() => setStatusFilter("out")}
        >
          <div className="inventory-stat-header">
            <span className="inventory-stat-title">Out of Stock</span>
            <span className="inventory-stat-icon">🔴</span>
          </div>
          <p className="inventory-stat-value" style={{ color: "#c62828" }}>
            {metrics.out}
          </p>
          <span className="inventory-stat-desc">Stock depleted (0 quantity)</span>
        </div>
      </div>

      {/* Add / Edit Item Collapsible Form */}
      {isFormOpen && (
        <section className="inventory-section">
          <div className="inventory-section-header">
            <h2>{editingId ? "Edit Inventory Item" : "Add New Inventory Item"}</h2>
            <button
              type="button"
              className="inventory-btn inventory-btn-secondary"
              onClick={cancelEdit}
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="inventory-form">
            <div className="inventory-form-grid">
              {/* Item Name */}
              <div className="inventory-field">
                <label htmlFor="item_name">
                  Item Name <span className="required">*</span>
                </label>
                <input
                  id="item_name"
                  type="text"
                  name="item_name"
                  placeholder="e.g. Bread Flour, Unsalted Butter"
                  value={form.item_name}
                  onChange={handleFormChange}
                  required
                />
                <span className="inventory-field-hint">
                  Raw ingredient or bakery supply name
                </span>
              </div>

              {/* Quantity */}
              <div className="inventory-field">
                <label htmlFor="quantity">
                  Current Stock <span className="required">*</span>
                </label>
                <input
                  id="quantity"
                  type="number"
                  step="any"
                  min="0"
                  name="quantity"
                  placeholder="e.g. 25"
                  value={form.quantity}
                  onChange={handleFormChange}
                  required
                />
                <span className="inventory-field-hint">
                  Available quantity currently on hand
                </span>
              </div>

              {/* Unit */}
              <div className="inventory-field">
                <label htmlFor="unit">
                  Unit of Measurement <span className="required">*</span>
                </label>
                <div className="inventory-unit-group">
                  <select
                    id="unit"
                    name="unit"
                    value={form.unit}
                    onChange={handleFormChange}
                  >
                    {PRESET_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                    <option value="custom">Other (Custom)</option>
                  </select>

                  {form.unit === "custom" && (
                    <input
                      type="text"
                      name="custom_unit"
                      placeholder="e.g. jars, rolls"
                      value={form.custom_unit}
                      onChange={handleFormChange}
                      required
                    />
                  )}
                </div>
                <span className="inventory-field-hint">
                  Measurement standard for this item
                </span>
              </div>

              {/* Minimum Stock Threshold */}
              <div className="inventory-field">
                <label htmlFor="minimum_stock">
                  Minimum Stock Threshold <span className="required">*</span>
                </label>
                <input
                  id="minimum_stock"
                  type="number"
                  step="any"
                  min="0"
                  name="minimum_stock"
                  placeholder="e.g. 10"
                  value={form.minimum_stock}
                  onChange={handleFormChange}
                  required
                />
                <span className="inventory-field-hint">
                  Triggers low stock alert when quantity reaches this level
                </span>
              </div>
            </div>

            <div className="inventory-form-actions">
              <button
                type="submit"
                className="inventory-btn inventory-btn-primary"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                  ? "Update Inventory Item"
                  : "Add to Inventory"}
              </button>

              <button
                type="button"
                className="inventory-btn inventory-btn-secondary"
                onClick={cancelEdit}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Main Inventory Table Section */}
      <section className="inventory-section">
        <div className="inventory-controls-bar">
          {/* Search box */}
          <div className="inventory-search-box">
            <input
              type="text"
              className="inventory-search-input"
              placeholder="🔍 Search items or units..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="inventory-search-clear"
                onClick={() => setSearchQuery("")}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Pills and Sort */}
          <div className="inventory-filters-group">
            <div className="inventory-filter-pills">
              <button
                type="button"
                className={`inventory-pill-btn ${statusFilter === "all" ? "active" : ""}`}
                onClick={() => setStatusFilter("all")}
              >
                All ({metrics.total})
              </button>
              <button
                type="button"
                className={`inventory-pill-btn ${statusFilter === "healthy" ? "active" : ""}`}
                onClick={() => setStatusFilter("healthy")}
              >
                In Stock ({metrics.healthy})
              </button>
              <button
                type="button"
                className={`inventory-pill-btn ${statusFilter === "low" ? "active" : ""}`}
                onClick={() => setStatusFilter("low")}
              >
                Low ({metrics.low})
              </button>
              <button
                type="button"
                className={`inventory-pill-btn ${statusFilter === "out" ? "active" : ""}`}
                onClick={() => setStatusFilter("out")}
              >
                Out ({metrics.out})
              </button>
            </div>

            <select
              className="inventory-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name_asc">Sort: Name (A-Z)</option>
              <option value="name_desc">Sort: Name (Z-A)</option>
              <option value="qty_asc">Sort: Stock (Low to High)</option>
              <option value="qty_desc">Sort: Stock (High to Low)</option>
              <option value="min_desc">Sort: Min Alert (High to Low)</option>
              <option value="newest">Sort: Recently Added</option>
            </select>
          </div>
        </div>

        {/* Content Loading / Empty / Table */}
        {loading ? (
          <div className="inventory-empty-state">
            <div className="inventory-empty-icon">⏳</div>
            <h3>Loading Bakery Inventory...</h3>
            <p>Fetching stock levels and ingredient thresholds.</p>
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="inventory-empty-state">
            <div className="inventory-empty-icon">🌾</div>
            {inventory.length === 0 ? (
              <>
                <h3>Your Bakery Inventory is Empty</h3>
                <p>
                  Start tracking your flour, butter, sugar, eggs, packaging, and supplies to prevent stockouts during busy baking hours.
                </p>
                <div className="inventory-empty-actions">
                  <button
                    type="button"
                    className="inventory-btn inventory-btn-primary"
                    onClick={() => {
                      setForm(emptyForm);
                      setEditingId(null);
                      setIsFormOpen(true);
                    }}
                  >
                    + Add Your First Item
                  </button>

                  <button
                    type="button"
                    className="inventory-btn inventory-btn-secondary"
                    onClick={handleSeedDefaults}
                    disabled={seeding}
                  >
                    {seeding ? "Loading Defaults..." : "⚡ Load Bakery Essentials"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>No Items Match Your Filter</h3>
                <p>
                  No inventory items match &ldquo;{searchQuery}&rdquo; under the &ldquo;{statusFilter}&rdquo; status.
                </p>
                <button
                  type="button"
                  className="inventory-btn inventory-btn-secondary"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                >
                  Clear Filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="inventory-table-container">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Ingredient / Item</th>
                  <th>Current Stock</th>
                  <th>Min. Threshold</th>
                  <th>Status</th>
                  <th>Quick Adjust</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item) => {
                  const qty = Number(item.quantity);
                  const min = Number(item.minimum_stock);
                  const status = getItemStatus(qty, min);
                  const isAdjusting = adjustingId === item.id;

                  return (
                    <tr key={item.id}>
                      {/* Name */}
                      <td>
                        <div className="inventory-item-cell">
                          <div className="inventory-item-avatar">
                            {item.unit === "kg" || item.unit === "g"
                              ? "🌾"
                              : item.unit === "litres" || item.unit === "ml"
                              ? "🥛"
                              : item.unit === "pcs" || item.unit === "boxes"
                              ? "📦"
                              : "🥣"}
                          </div>
                          <div>
                            <div className="inventory-item-name">
                              {item.item_name}
                            </div>
                            {item.created_at && (
                              <div className="inventory-item-date">
                                Added {new Date(item.created_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Current Stock */}
                      <td>
                        <div className="inventory-stock-display">
                          <span className="inventory-qty-text">
                            {qty} {item.unit}
                          </span>
                          <div className="inventory-progress-track">
                            <div
                              className={`inventory-progress-bar ${status.progressClass}`}
                              style={{ width: `${status.percent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Min Threshold */}
                      <td>
                        <span style={{ fontWeight: 600, color: "#654b3a" }}>
                          {min} {item.unit}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td>
                        <span className={`inventory-badge ${status.className}`}>
                          <span className="inventory-badge-dot" />
                          {status.label}
                        </span>
                      </td>

                      {/* Quick Adjust Buttons */}
                      <td>
                        <div className="inventory-adjust-group">
                          <button
                            type="button"
                            className="inventory-adjust-btn"
                            title="Deduct 1"
                            disabled={isAdjusting || qty <= 0}
                            onClick={() => handleQuickAdjust(item, -1)}
                          >
                            -1
                          </button>
                          <button
                            type="button"
                            className="inventory-adjust-btn inventory-adjust-btn-plus"
                            title="Add 1"
                            disabled={isAdjusting}
                            onClick={() => handleQuickAdjust(item, 1)}
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            className="inventory-adjust-btn inventory-adjust-btn-plus"
                            title="Add 5"
                            disabled={isAdjusting}
                            onClick={() => handleQuickAdjust(item, 5)}
                          >
                            +5
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="inventory-actions-cell">
                        <button
                          type="button"
                          className="inventory-action-btn inventory-action-edit"
                          onClick={() => handleEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="inventory-action-btn inventory-action-delete"
                          onClick={() => handleDelete(item)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default Inventory;
