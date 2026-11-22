import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../styles/Categories.css";

const QUICK_CATEGORY_PRESETS = [
  "CUPCAKES",
  "TARTS",
  "DONUTS",
  "SAVOURIES",
  "BEVERAGES",
  "DESSERT JARS",
];

function Categories() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [productCounts, setProductCounts] = useState({});
  const [categoryName, setCategoryName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch categories and product count per category
  const fetchCategories = async () => {
    setLoading(true);
    setError("");

    try {
      const [catRes, prodRes] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("products").select("category"),
      ]);

      if (catRes.error) throw catRes.error;

      // Count products per category
      const counts = {};
      (prodRes.data || []).forEach((p) => {
        if (p.category) {
          counts[p.category] = (counts[p.category] || 0) + 1;
        }
      });

      setCategories(catRes.data || []);
      setProductCounts(counts);
    } catch (err) {
      setError(err.message || "Failed to load categories.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadData = async () => {
      try {
        const [catRes, prodRes] = await Promise.all([
          supabase.from("categories").select("*").order("name"),
          supabase.from("products").select("category"),
        ]);

        if (!ignore) {
          if (catRes.error) throw catRes.error;

          const counts = {};
          (prodRes.data || []).forEach((p) => {
            if (p.category) {
              counts[p.category] = (counts[p.category] || 0) + 1;
            }
          });

          setCategories(catRes.data || []);
          setProductCounts(counts);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Failed to load categories.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      ignore = true;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const name = categoryName.trim().toUpperCase();
    if (!name) return;

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      // Check for duplicate name if adding new
      if (
        !editingId &&
        categories.some((c) => c.name.toUpperCase() === name)
      ) {
        throw new Error(`Category "${name}" already exists.`);
      }

      if (editingId) {
        const { error: updateErr } = await supabase
          .from("categories")
          .update({ name })
          .eq("id", editingId);

        if (updateErr) throw updateErr;

        setSuccess(`Category updated to "${name}" successfully!`);
      } else {
        const { error: insertErr } = await supabase
          .from("categories")
          .insert([{ name }]);

        if (insertErr) throw insertErr;

        setSuccess(`Category "${name}" added successfully!`);
      }

      setCategoryName("");
      setEditingId(null);
      await fetchCategories();
    } catch (err) {
      if (err.code === "42501" || err.message?.includes("security policy")) {
        setError(
          "Permission denied: Please ensure you are logged in as an administrator to manage categories."
        );
      } else {
        setError(err.message || "Failed to save category.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (category) => {
    setCategoryName(category.name);
    setEditingId(category.id);
    setError("");
    setSuccess("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleDelete = async (category) => {
    const assignedCount = productCounts[category.name] || 0;
    let message = `Are you sure you want to delete category "${category.name}"?`;
    if (assignedCount > 0) {
      message = `⚠️ Warning: "${category.name}" currently has ${assignedCount} active product(s) assigned to it.\nDeleting this category will leave those products uncategorized.\n\nProceed with deletion?`;
    }

    const confirmed = window.confirm(message);
    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const { error: delErr } = await supabase
        .from("categories")
        .delete()
        .eq("id", category.id);

      if (delErr) throw delErr;

      setSuccess(`Category "${category.name}" deleted.`);
      if (editingId === category.id) {
        cancelEdit();
      }
      await fetchCategories();
    } catch (err) {
      if (err.code === "42501" || err.message?.includes("security policy")) {
        setError(
          "Permission denied: Please ensure you are logged in as an administrator to delete categories."
        );
      } else {
        setError(err.message || "Failed to delete category.");
      }
    }
  };

  const cancelEdit = () => {
    setCategoryName("");
    setEditingId(null);
    setError("");
    setSuccess("");
  };

  // Helper for bakery category icon
  const getCategoryIcon = (name) => {
    const upper = name.toUpperCase();
    if (upper.includes("CAKE")) return "🎂";
    if (upper.includes("PASTR")) return "🥐";
    if (upper.includes("BREAD")) return "🥖";
    if (upper.includes("COOKIE") || upper.includes("BISCUIT")) return "🍪";
    if (upper.includes("CUPCAKE") || upper.includes("MUFFIN")) return "🧁";
    if (upper.includes("TART") || upper.includes("PIE")) return "🥧";
    if (upper.includes("DONUT") || upper.includes("DOUGHNUT")) return "🍩";
    if (upper.includes("BEVERAGE") || upper.includes("COFFEE") || upper.includes("TEA")) return "☕";
    return "🥣";
  };

  // Filtered categories
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase().trim();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    let inUse = 0;
    let totalAssignedProducts = 0;

    categories.forEach((c) => {
      const count = productCounts[c.name] || 0;
      if (count > 0) inUse += 1;
      totalAssignedProducts += count;
    });

    return {
      total: categories.length,
      inUse,
      empty: categories.length - inUse,
      totalAssignedProducts,
    };
  }, [categories, productCounts]);

  return (
    <div className="categories-page">
      {/* Header */}
      <div className="categories-header">
        <div className="categories-header-left">
          <h1>Category Management</h1>
          <p>Organize your bakery menu items into customer-friendly shop categories.</p>
        </div>

        <div className="categories-header-actions">
          <button
            type="button"
            className="categories-btn categories-btn-secondary"
            onClick={() => navigate("/admin/dashboard")}
          >
            ← Back to Dashboard
          </button>

          <button
            type="button"
            className="categories-btn categories-btn-secondary"
            onClick={fetchCategories}
            disabled={loading}
          >
            🔄 {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {success && (
        <div className="categories-banner categories-banner-success">
          <span>✓ {success}</span>
          <button
            className="categories-banner-close"
            onClick={() => setSuccess("")}
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="categories-banner categories-banner-error">
          <span>⚠️ {error}</span>
          <button
            className="categories-banner-close"
            onClick={() => setError("")}
          >
            ✕
          </button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="categories-stats-grid">
        <div className="categories-stat-card">
          <div className="categories-stat-header">
            <span className="categories-stat-title">Total Categories</span>
            <span className="categories-stat-icon">🏷️</span>
          </div>
          <p className="categories-stat-value">{metrics.total}</p>
          <span className="categories-stat-desc">Active store classifications</span>
        </div>

        <div className="categories-stat-card">
          <div className="categories-stat-header">
            <span className="categories-stat-title">Active Categories</span>
            <span className="categories-stat-icon">🟢</span>
          </div>
          <p className="categories-stat-value" style={{ color: "#2e7d32" }}>
            {metrics.inUse}
          </p>
          <span className="categories-stat-desc">Categories with menu items</span>
        </div>

        <div className="categories-stat-card">
          <div className="categories-stat-header">
            <span className="categories-stat-title">Unused Categories</span>
            <span className="categories-stat-icon">⚪</span>
          </div>
          <p className="categories-stat-value" style={{ color: "#8a6b58" }}>
            {metrics.empty}
          </p>
          <span className="categories-stat-desc">No products assigned yet</span>
        </div>
      </div>

      {/* Add / Edit Category Form */}
      <section className="category-form-section">
        <div className="category-form-header">
          <h2>{editingId ? "Edit Category Name" : "Create New Category"}</h2>
          <p>Categories display on the storefront menu tabs and customer product filters.</p>
        </div>

        <form onSubmit={handleSubmit} className="category-form">
          <input
            type="text"
            className="category-form-input"
            placeholder="e.g. SOURDOUGH BREADS, CUPCAKES"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            required
            disabled={saving}
          />

          <button
            type="submit"
            className="categories-btn categories-btn-primary"
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : editingId
              ? "Update Category"
              : "+ Add Category"}
          </button>

          {editingId && (
            <button
              type="button"
              className="categories-btn categories-btn-secondary"
              onClick={cancelEdit}
              disabled={saving}
            >
              Cancel
            </button>
          )}
        </form>

        {/* Quick Suggestion Presets */}
        {!editingId && (
          <div className="category-presets-box">
            <span className="category-presets-label">Popular Bakery Presets:</span>
            {QUICK_CATEGORY_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="category-preset-pill"
                onClick={() => setCategoryName(preset)}
              >
                + {preset}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* All Categories Section */}
      <section className="categories-list-section">
        <div className="categories-controls-bar">
          <div className="categories-search-box">
            <input
              type="text"
              className="categories-search-input"
              placeholder="🔍 Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="categories-search-clear"
                onClick={() => setSearchQuery("")}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="categories-list-header">
          <h2>All Categories ({filteredCategories.length})</h2>
        </div>

        {loading ? (
          <div className="categories-empty-state">
            <div className="categories-empty-icon">⏳</div>
            <h3>Loading Bakery Categories...</h3>
            <p>Fetching active classifications and linked product counts.</p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="categories-empty-state">
            <div className="categories-empty-icon">🏷️</div>
            <h3>No Categories Found</h3>
            <p>
              {categories.length === 0
                ? "No categories have been created yet. Add your first category above to begin classifying products."
                : `No categories match "${searchQuery}".`}
            </p>
          </div>
        ) : (
          <div className="categories-grid">
            {filteredCategories.map((category) => {
              const productCount = productCounts[category.name] || 0;
              const icon = getCategoryIcon(category.name);

              return (
                <div className="category-card" key={category.id}>
                  <div className="category-card-top">
                    <div className="category-icon-badge">{icon}</div>
                    <div className="category-info">
                      <h3>{category.name}</h3>
                      <span className="category-product-count">
                        {productCount === 1
                          ? "1 Product"
                          : `${productCount} Products`}
                      </span>
                    </div>
                  </div>

                  <div className="category-actions">
                    <button
                      type="button"
                      className="category-action-btn category-edit-btn"
                      onClick={() => handleEdit(category)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="category-action-btn category-delete-btn"
                      onClick={() => handleDelete(category)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default Categories;
