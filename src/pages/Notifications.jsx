import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../styles/Notifications.css";

function Notifications() {
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState(() => {
    try {
      const stored = localStorage.getItem("golden_crust_read_notifications");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const fetchAllAlerts = async () => {
    setLoading(true);
    try {
      const [ordersRes, invRes, prodRes, expRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, customer_name, total_amount, order_status, created_at")
          .order("created_at", { ascending: false })
          .limit(40),
        supabase.from("inventory").select("id, item_name, quantity, minimum_stock, unit"),
        supabase.from("products").select("id, name, is_available").eq("is_available", false),
        supabase.from("expenses").select("id, title, amount, category, expense_date").limit(20),
      ]);

      const items = [];

      // 1. Pending Orders
      const pendingOrders = (ordersRes.data || []).filter((o) => o.order_status === "Pending");
      pendingOrders.forEach((o) => {
        items.push({
          id: `order-pending-${o.id}`,
          category: "Orders",
          priority: "Critical",
          icon: "⏳",
          title: `Pending Kitchen Order #${o.id}`,
          message: `Customer: ${o.customer_name || "Guest"} • ₹${Number(o.total_amount).toLocaleString("en-IN")}. Awaiting kitchen confirmation.`,
          date: o.created_at ? new Date(o.created_at).toLocaleDateString() : "Recent",
          link: "/admin/orders",
          actionText: "Open Order Ticket",
        });
      });

      // 2. Confirmed / In Preparation Orders
      const prepOrders = (ordersRes.data || []).filter(
        (o) => o.order_status === "Preparing" || o.order_status === "Confirmed"
      );
      if (prepOrders.length > 0) {
        items.push({
          id: `kitchen-active-${prepOrders.length}`,
          category: "Orders",
          priority: "Info",
          icon: "👨‍🍳",
          title: `${prepOrders.length} Order${prepOrders.length > 1 ? "s" : ""} in Kitchen Preparation`,
          message: "Kitchen deck active. Ensure baking timers and packaging are ready.",
          date: "Today",
          link: "/admin/orders",
          actionText: "View Kitchen Queue",
        });
      }

      // 3. Out of Stock Inventory
      const outOfStock = (invRes.data || []).filter((i) => Number(i.quantity) <= 0);
      outOfStock.forEach((i) => {
        items.push({
          id: `stock-depleted-${i.id}`,
          category: "Inventory",
          priority: "Critical",
          icon: "🚫",
          title: `Stock Depleted: ${i.item_name}`,
          message: `Zero quantity left in bakery storage. Please log restock arrival immediately.`,
          date: "Immediate Action Required",
          link: "/admin/inventory",
          actionText: "Update Stock Count",
        });
      });

      // 4. Low Stock Inventory
      const lowStock = (invRes.data || []).filter(
        (i) => Number(i.quantity) > 0 && Number(i.quantity) <= Number(i.minimum_stock)
      );
      lowStock.forEach((i) => {
        items.push({
          id: `stock-low-${i.id}`,
          category: "Inventory",
          priority: "Warning",
          icon: "⚠️",
          title: `Low Stock: ${i.item_name}`,
          message: `Currently ${i.quantity} ${i.unit} on hand (threshold: ${i.minimum_stock} ${i.unit}). Reorder recommended.`,
          date: "Reorder Required",
          link: "/admin/inventory",
          actionText: "Reorder Ingredient",
        });
      });

      // 5. Paused Products
      const unavail = prodRes.data || [];
      if (unavail.length > 0) {
        items.push({
          id: `prod-unavail-${unavail.length}`,
          category: "Menu",
          priority: "Info",
          icon: "🍰",
          title: `${unavail.length} Menu Creation${unavail.length > 1 ? "s" : ""} Currently Hidden`,
          message: `Items marked unavailable: ${unavail.map((p) => p.name).slice(0, 3).join(", ")}${unavail.length > 3 ? "..." : ""}.`,
          date: "Catalog Setting",
          link: "/admin/products",
          actionText: "Review Menu Items",
        });
      }

      // 6. High single expenses
      const highExpenses = (expRes.data || []).filter((e) => Number(e.amount) >= 15000);
      highExpenses.forEach((e) => {
        items.push({
          id: `exp-high-${e.id}`,
          category: "Finances",
          priority: "Warning",
          icon: "💸",
          title: `High Operating Expense: ₹${Number(e.amount).toLocaleString("en-IN")}`,
          message: `${e.title} (${e.category}). Review budget impact on P&L statement.`,
          date: e.expense_date || "Recent",
          link: "/admin/profit-loss",
          actionText: "Review Financials",
        });
      });

      setAlerts(items);
    } catch (err) {
      console.warn("Notifications fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAlerts();
  }, []);

  const handleMarkAllRead = () => {
    const allIds = alerts.map((a) => a.id);
    setReadIds(allIds);
    try {
      localStorage.setItem("golden_crust_read_notifications", JSON.stringify(allIds));
    } catch (e) {
      console.warn("Could not save read notifications:", e);
    }
  };

  const handleToggleRead = (id) => {
    setReadIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem("golden_crust_read_notifications", JSON.stringify(next));
      } catch (e) {
        console.warn("Could not save read notifications:", e);
      }
      return next;
    });
  };

  // Filter alerts
  let filtered = [...alerts];
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.message.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    );
  }

  if (categoryFilter !== "all") {
    filtered = filtered.filter((a) => a.category === categoryFilter);
  }

  if (priorityFilter !== "all") {
    filtered = filtered.filter((a) => a.priority === priorityFilter);
  }

  // Stats
  const totalCount = alerts.length;
  const criticalCount = alerts.filter((a) => a.priority === "Critical").length;
  const pendingOrdersCount = alerts.filter((a) => a.category === "Orders" && a.priority === "Critical").length;
  const stockWarningsCount = alerts.filter((a) => a.category === "Inventory").length;

  return (
    <div className="notifs-page">
      {/* Header */}
      <div className="notifs-header">
        <div className="notifs-header-left">
          <div className="notifs-title-row">
            <h1>Bakery Notifications & Alerts</h1>
            <span className="notifs-badge">Live Monitor</span>
          </div>
          <p>
            Real-time bakery operation feeds: incoming orders, low ingredient stock, kitchen queues, and catalog alerts.
          </p>
        </div>

        <div className="notifs-header-actions">
          <button
            type="button"
            className="notifs-btn notifs-btn-secondary"
            onClick={() => navigate("/admin/dashboard")}
          >
            ← Dashboard
          </button>

          <button
            type="button"
            className="notifs-btn notifs-btn-secondary"
            onClick={fetchAllAlerts}
            disabled={loading}
          >
            🔄 {loading ? "Checking..." : "Refresh"}
          </button>

          {alerts.length > 0 && (
            <button
              type="button"
              className="notifs-btn notifs-btn-primary"
              onClick={handleMarkAllRead}
            >
              ✓ Mark All as Read
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="notifs-stats-grid">
        <div
          className={`notifs-stat-card ${priorityFilter === "all" && categoryFilter === "all" ? "active-filter" : ""}`}
          onClick={() => {
            setCategoryFilter("all");
            setPriorityFilter("all");
          }}
        >
          <div className="notifs-stat-header">
            <span className="notifs-stat-title">Total Active Alerts</span>
            <span className="notifs-stat-icon">🔔</span>
          </div>
          <p className="notifs-stat-value">{totalCount}</p>
          <span className="notifs-stat-desc">System alerts across store</span>
        </div>

        <div
          className={`notifs-stat-card ${priorityFilter === "Critical" ? "active-filter" : ""}`}
          onClick={() => setPriorityFilter((prev) => (prev === "Critical" ? "all" : "Critical"))}
        >
          <div className="notifs-stat-header">
            <span className="notifs-stat-title">Critical Attention</span>
            <span className="notifs-stat-icon">🚨</span>
          </div>
          <p className="notifs-stat-value" style={{ color: "#c62828" }}>
            {criticalCount}
          </p>
          <span className="notifs-stat-desc">Stockouts & pending orders</span>
        </div>

        <div
          className={`notifs-stat-card ${categoryFilter === "Orders" ? "active-filter" : ""}`}
          onClick={() => setCategoryFilter((prev) => (prev === "Orders" ? "all" : "Orders"))}
        >
          <div className="notifs-stat-header">
            <span className="notifs-stat-title">Pending Orders</span>
            <span className="notifs-stat-icon">⏳</span>
          </div>
          <p className="notifs-stat-value" style={{ color: "#e65100" }}>
            {pendingOrdersCount}
          </p>
          <span className="notifs-stat-desc">Awaiting kitchen confirmation</span>
        </div>

        <div
          className={`notifs-stat-card ${categoryFilter === "Inventory" ? "active-filter" : ""}`}
          onClick={() => setCategoryFilter((prev) => (prev === "Inventory" ? "all" : "Inventory"))}
        >
          <div className="notifs-stat-header">
            <span className="notifs-stat-title">Inventory Warnings</span>
            <span className="notifs-stat-icon">🌾</span>
          </div>
          <p className="notifs-stat-value" style={{ color: "#b76e27" }}>
            {stockWarningsCount}
          </p>
          <span className="notifs-stat-desc">Low flour, butter & baking stock</span>
        </div>
      </div>

      {/* Main Alert Feed Section */}
      <section className="notifs-section">
        <div className="notifs-controls-bar">
          <div className="notifs-search-box">
            <input
              type="text"
              className="notifs-search-input"
              placeholder="🔍 Search alerts by ingredient, order #, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="notifs-search-clear"
                onClick={() => setSearchQuery("")}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="notifs-filters-group">
            {/* Category Pills */}
            <div className="notifs-pills">
              {["all", "Orders", "Inventory", "Menu", "Finances"].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`notifs-pill ${categoryFilter === cat ? "active" : ""}`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat === "all" ? "All Categories" : cat}
                </button>
              ))}
            </div>

            {/* Priority Filter */}
            <select
              className="notifs-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="Critical">🔴 Critical Only</option>
              <option value="Warning">🟠 Warnings</option>
              <option value="Info">🔵 Informational</option>
            </select>
          </div>
        </div>

        {/* Alerts List */}
        {loading ? (
          <div className="notifs-empty-state">
            <div className="notifs-empty-icon">⏳</div>
            <h3>Scanning Bakery Systems...</h3>
            <p>Checking incoming orders, current stock levels, and kitchen queue.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="notifs-empty-state">
            <div className="notifs-empty-icon">✨</div>
            <h3>No Active Alerts</h3>
            <p>
              Your bakery is running smoothly! Orders are on track and inventory levels are healthy.
            </p>
            {(categoryFilter !== "all" || priorityFilter !== "all" || searchQuery) && (
              <button
                type="button"
                className="notifs-btn notifs-btn-secondary"
                onClick={() => {
                  setCategoryFilter("all");
                  setPriorityFilter("all");
                  setSearchQuery("");
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="notifs-list">
            {filtered.map((item) => {
              const isRead = readIds.includes(item.id);

              return (
                <div
                  key={item.id}
                  className={`notifs-card ${item.priority.toLowerCase()} ${isRead ? "read" : "unread"}`}
                >
                  <div className="notifs-card-icon-col">
                    <span className="notifs-card-icon">{item.icon}</span>
                  </div>

                  <div className="notifs-card-main">
                    <div className="notifs-card-header">
                      <div className="notifs-card-title-group">
                        <span className={`notifs-priority-tag ${item.priority.toLowerCase()}`}>
                          {item.priority}
                        </span>
                        <span className="notifs-cat-tag">{item.category}</span>
                        <h3>{item.title}</h3>
                      </div>
                      <span className="notifs-card-date">{item.date}</span>
                    </div>

                    <p className="notifs-card-msg">{item.message}</p>

                    <div className="notifs-card-actions">
                      <button
                        type="button"
                        className="notifs-action-link-btn"
                        onClick={() => navigate(item.link)}
                      >
                        {item.actionText} →
                      </button>

                      <button
                        type="button"
                        className="notifs-read-toggle-btn"
                        onClick={() => handleToggleRead(item.id)}
                      >
                        {isRead ? "Mark Unread" : "✓ Mark Read"}
                      </button>
                    </div>
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

export default Notifications;
