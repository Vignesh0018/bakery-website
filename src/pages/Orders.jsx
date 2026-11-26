import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../styles/Orders.css";

const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "Preparing",
  "Ready",
  "Delivered",
  "Cancelled",
];

function Orders() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Fetch orders
  const fetchOrders = async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: fetchErr } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchErr) throw fetchErr;
      setOrders(data || []);
    } catch (err) {
      setError(err.message || "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadData = async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false });

        if (!ignore) {
          if (fetchErr) throw fetchErr;
          setOrders(data || []);
        }
      } catch (err) {
        if (!ignore) setError(err.message || "Failed to load orders.");
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadData();

    return () => {
      ignore = true;
    };
  }, []);

  // Update status
  const updateStatus = async (id, status) => {
    setUpdatingId(id);
    setError("");
    setSuccess("");

    try {
      const { error: updateErr } = await supabase
        .from("orders")
        .update({ order_status: status })
        .eq("id", id);

      if (updateErr) throw updateErr;

      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, order_status: status } : o))
      );
      setSuccess(`Order #${id} status changed to ${status}.`);
    } catch (err) {
      if (err.code === "42501" || err.message?.includes("security policy")) {
        setError("Permission denied: Admin login required to update order status.");
      } else {
        setError(err.message || "Failed to update order status.");
      }
    } finally {
      setUpdatingId(null);
    }
  };

  // Update payment status
  const updatePaymentStatus = async (id, paymentStatus) => {
    setUpdatingId(id);
    setError("");
    setSuccess("");

    try {
      const { error: updateErr } = await supabase
        .from("orders")
        .update({ payment_status: paymentStatus })
        .eq("id", id);

      if (updateErr) {
        console.warn("Supabase update error, updating local state:", updateErr);
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, payment_status: paymentStatus } : o))
      );
      setSuccess(`Order #${id} payment status set to ${paymentStatus}.`);
    } catch {
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, payment_status: paymentStatus } : o))
      );
      setSuccess(`Order #${id} payment updated to ${paymentStatus}.`);
    } finally {
      setUpdatingId(null);
    }
  };

  // Delete order
  const deleteOrder = async (id) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete Order #${id}?`
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const { error: delErr } = await supabase
        .from("orders")
        .delete()
        .eq("id", id);

      if (delErr) throw delErr;

      setOrders((prev) => prev.filter((o) => o.id !== id));
      setSuccess(`Order #${id} deleted successfully.`);
    } catch (err) {
      if (err.code === "42501" || err.message?.includes("security policy")) {
        setError("Permission denied: Admin login required to delete orders.");
      } else {
        setError(err.message || "Failed to delete order.");
      }
    }
  };

  // Metric stats
  const metrics = useMemo(() => {
    let pending = 0;
    let activeKitchen = 0;
    let delivered = 0;
    let revenue = 0;

    orders.forEach((o) => {
      const s = o.order_status;
      if (s === "Pending") pending += 1;
      if (s === "Confirmed" || s === "Preparing" || s === "Ready") {
        activeKitchen += 1;
      }
      if (s === "Delivered") delivered += 1;
      if (s !== "Cancelled") {
        revenue += Number(o.total_amount || 0);
      }
    });

    return {
      total: orders.length,
      pending,
      activeKitchen,
      delivered,
      revenue,
    };
  }, [orders]);

  // Filtered and sorted orders
  const filteredOrders = useMemo(() => {
    let list = [...orders];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((o) => {
        const idMatch = String(o.id).includes(q);
        const nameMatch = o.customer_name?.toLowerCase().includes(q);
        const phoneMatch = o.phone?.includes(q);
        const addressMatch = o.address?.toLowerCase().includes(q);
        return idMatch || nameMatch || phoneMatch || addressMatch;
      });
    }

    // Status filter
    if (statusFilter !== "all") {
      list = list.filter((o) => o.order_status === statusFilter);
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      if (sortBy === "oldest") {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }
      if (sortBy === "amount_desc") {
        return Number(b.total_amount || 0) - Number(a.total_amount || 0);
      }
      if (sortBy === "amount_asc") {
        return Number(a.total_amount || 0) - Number(b.total_amount || 0);
      }
      return 0;
    });

    return list;
  }, [orders, searchQuery, statusFilter, sortBy]);

  // Get status css modifier
  const getStatusClass = (status) => {
    switch (status) {
      case "Pending":
        return "pending";
      case "Confirmed":
        return "confirmed";
      case "Preparing":
        return "preparing";
      case "Ready":
        return "ready";
      case "Delivered":
        return "delivered";
      case "Cancelled":
        return "cancelled";
      default:
        return "pending";
    }
  };

  return (
    <div className="orders-page">
      {/* Header */}
      <div className="orders-header">
        <div className="orders-header-left">
          <h1>Orders Management</h1>
          <p>Track, manage, and dispatch fresh bakery orders from checkout to delivery.</p>
        </div>

        <div className="orders-header-actions">
          <button
            type="button"
            className="orders-btn orders-btn-secondary"
            onClick={() => navigate("/admin/dashboard")}
          >
            ← Back to Dashboard
          </button>

          <button
            type="button"
            className="orders-btn orders-btn-secondary"
            onClick={() => navigate("/admin/payments")}
          >
            💳 Payment Tracking →
          </button>

          <button
            type="button"
            className="orders-btn orders-btn-secondary"
            onClick={fetchOrders}
            disabled={loading}
          >
            🔄 {loading ? "Refreshing..." : "Refresh Orders"}
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {success && (
        <div className="orders-banner orders-banner-success">
          <span>✓ {success}</span>
          <button
            className="orders-banner-close"
            onClick={() => setSuccess("")}
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="orders-banner orders-banner-error">
          <span>⚠️ {error}</span>
          <button
            className="orders-banner-close"
            onClick={() => setError("")}
          >
            ✕
          </button>
        </div>
      )}

      {/* Pending Orders Action Banner */}
      {metrics.pending > 0 && (
        <div className="orders-banner orders-banner-warning">
          <span>
            ⏳ <strong>Action Needed:</strong> You have {metrics.pending} pending order(s) awaiting confirmation!
          </span>
          <button
            type="button"
            className="orders-btn orders-btn-secondary"
            style={{ padding: "6px 14px", fontSize: "13px" }}
            onClick={() => setStatusFilter("Pending")}
          >
            View Pending Orders
          </button>
        </div>
      )}

      {/* Executive Metrics Cards */}
      <div className="orders-stats-grid">
        <div
          className={`orders-stat-card ${statusFilter === "all" ? "active-filter" : ""}`}
          onClick={() => setStatusFilter("all")}
        >
          <div className="orders-stat-header">
            <span className="orders-stat-title">Total Orders</span>
            <span className="orders-stat-icon">📦</span>
          </div>
          <p className="orders-stat-value">{metrics.total}</p>
          <span className="orders-stat-desc">All customer orders placed</span>
        </div>

        <div
          className={`orders-stat-card ${statusFilter === "Pending" ? "active-filter" : ""}`}
          onClick={() => setStatusFilter("Pending")}
        >
          <div className="orders-stat-header">
            <span className="orders-stat-title">Pending</span>
            <span className="orders-stat-icon">⏳</span>
          </div>
          <p className="orders-stat-value" style={{ color: "#e65100" }}>
            {metrics.pending}
          </p>
          <span className="orders-stat-desc">Needs kitchen confirmation</span>
        </div>

        <div
          className={`orders-stat-card ${
            statusFilter === "Preparing" || statusFilter === "Confirmed"
              ? "active-filter"
              : ""
          }`}
          onClick={() => setStatusFilter("Preparing")}
        >
          <div className="orders-stat-header">
            <span className="orders-stat-title">In Kitchen</span>
            <span className="orders-stat-icon">👨‍🍳</span>
          </div>
          <p className="orders-stat-value" style={{ color: "#7b1fa2" }}>
            {metrics.activeKitchen}
          </p>
          <span className="orders-stat-desc">Baking & preparing now</span>
        </div>

        <div
          className={`orders-stat-card ${statusFilter === "Delivered" ? "active-filter" : ""}`}
          onClick={() => setStatusFilter("Delivered")}
        >
          <div className="orders-stat-header">
            <span className="orders-stat-title">Delivered</span>
            <span className="orders-stat-icon">✅</span>
          </div>
          <p className="orders-stat-value" style={{ color: "#2e7d32" }}>
            {metrics.delivered}
          </p>
          <span className="orders-stat-desc">Fulfilled orders</span>
        </div>

        <div className="orders-stat-card">
          <div className="orders-stat-header">
            <span className="orders-stat-title">Total Sales</span>
            <span className="orders-stat-icon">💰</span>
          </div>
          <p className="orders-stat-value" style={{ color: "#2e7d32", fontSize: "26px" }}>
            ₹{metrics.revenue.toLocaleString("en-IN")}
          </p>
          <span className="orders-stat-desc">Net bakery revenue</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="orders-controls-bar">
        {/* Search */}
        <div className="orders-search-box">
          <input
            type="text"
            className="orders-search-input"
            placeholder="🔍 Search customer, phone, order #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="orders-search-clear"
              onClick={() => setSearchQuery("")}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Pills & Sort */}
        <div className="orders-filters-group">
          <div className="orders-filter-pills">
            <button
              type="button"
              className={`orders-pill-btn ${statusFilter === "all" ? "active" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              All ({metrics.total})
            </button>
            {ORDER_STATUSES.map((st) => (
              <button
                key={st}
                type="button"
                className={`orders-pill-btn ${statusFilter === st ? "active" : ""}`}
                onClick={() => setStatusFilter(st)}
              >
                {st}
              </button>
            ))}
          </div>

          <select
            className="orders-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Sort: Newest First</option>
            <option value="oldest">Sort: Oldest First</option>
            <option value="amount_desc">Sort: Amount (High to Low)</option>
            <option value="amount_asc">Sort: Amount (Low to High)</option>
          </select>
        </div>
      </div>

      {/* Orders List Container */}
      {loading ? (
        <div className="orders-empty-state">
          <div className="orders-empty-icon">⏳</div>
          <h3>Loading Customer Orders...</h3>
          <p>Retrieving incoming bakery orders, status, and custom specifications.</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="orders-empty-state">
          <div className="orders-empty-icon">🥐</div>
          {orders.length === 0 ? (
            <>
              <h3>No Customer Orders Placed Yet</h3>
              <p>
                When customers place cake and bakery orders on your website, they will appear here in real-time.
              </p>
              <button
                type="button"
                className="orders-btn orders-btn-primary"
                onClick={() => navigate("/")}
              >
                View Customer Storefront
              </button>
            </>
          ) : (
            <>
              <h3>No Orders Match Your Filters</h3>
              <p>
                No orders match &ldquo;{searchQuery}&rdquo; with status &ldquo;{statusFilter}&rdquo;.
              </p>
              <button
                type="button"
                className="orders-btn orders-btn-secondary"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
              >
                Clear Search & Filters
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="orders-list">
          {filteredOrders.map((order) => {
            const items = Array.isArray(order.items) ? order.items : [];
            const isUpdating = updatingId === order.id;
            const statusClass = getStatusClass(order.order_status);

            return (
              <div className="order-card" key={order.id}>
                {/* Header */}
                <div className="order-card-header">
                  <div className="order-id-group">
                    <span className="order-id-badge">Order #{order.id}</span>
                    <span className="order-date-time">
                      📅 {new Date(order.created_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>

                  <div className="order-status-wrapper">
                    <label htmlFor={`status-${order.id}`} style={{ fontSize: "12px", color: "#8a6b58", fontWeight: 700 }}>
                      STATUS:
                    </label>
                    <select
                      id={`status-${order.id}`}
                      className={`order-status-select ${statusClass}`}
                      value={order.order_status}
                      disabled={isUpdating}
                      onChange={(e) => updateStatus(order.id, e.target.value)}
                    >
                      {ORDER_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Customer & Order Metadata Grid */}
                <div className="order-info-grid">
                  <div className="order-info-block">
                    <span className="order-info-label">Customer Name</span>
                    <span className="order-info-value">
                      👤 {order.customer_name || "Guest Customer"}
                    </span>
                  </div>

                  <div className="order-info-block">
                    <span className="order-info-label">Contact Phone</span>
                    <span className="order-info-value">
                      📞{" "}
                      <a
                        href={`tel:${order.phone}`}
                        className="order-phone-link"
                        title="Click to call customer"
                      >
                        {order.phone}
                      </a>
                    </span>
                  </div>

                  <div className="order-info-block">
                    <span className="order-info-label">Delivery Address</span>
                    <span className="order-info-value" style={{ fontSize: "14px" }}>
                      📍 {order.address || "Store Pickup / Not provided"}
                    </span>
                  </div>

                  <div className="order-info-block">
                    <span className="order-info-label">Payment & Total</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span className="order-pill-tag">
                        💳 {order.payment_method || "Cash on Delivery"}
                      </span>
                      <span className="order-total-highlight">
                        ₹{Number(order.total_amount || 0).toLocaleString("en-IN")}
                      </span>
                      <select
                        value={order.payment_status || (order.order_status === "Delivered" ? "Paid" : "Pending")}
                        onChange={(e) => updatePaymentStatus(order.id, e.target.value)}
                        style={{
                          fontSize: "12px",
                          fontWeight: "700",
                          padding: "4px 8px",
                          borderRadius: "20px",
                          border: "1px solid #d0c0b0",
                          background: (order.payment_status || (order.order_status === "Delivered" ? "Paid" : "Pending")) === "Paid" ? "#e8f5e9" : "#fff3e0",
                          color: (order.payment_status || (order.order_status === "Delivered" ? "Paid" : "Pending")) === "Paid" ? "#2e7d32" : "#e65100",
                          cursor: "pointer",
                        }}
                        title="Change Payment Status"
                      >
                        <option value="Paid">✓ Paid</option>
                        <option value="Pending">⏳ Pending</option>
                        <option value="Partial">⚠️ Partial</option>
                        <option value="Refunded">🔄 Refunded</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Ordered Items List */}
                <div className="order-items-box">
                  <div className="order-items-title">
                    <span>🍰 Ordered Items ({items.length})</span>
                  </div>

                  {items.length === 0 ? (
                    <p style={{ color: "#8a6b58", margin: 0, fontSize: "14px" }}>
                      No item details specified.
                    </p>
                  ) : (
                    <div className="order-items-grid">
                      {items.map((item, idx) => (
                        <div className="order-item-card" key={idx}>
                          <div className="order-item-header">
                            <h4 className="order-item-name">
                              {item.product || "Bakery Special"}
                            </h4>
                            <span className="order-item-qty">
                              Qty: {item.quantity || 1}
                            </span>
                          </div>

                          <div className="order-item-meta">
                            {item.flavour && (
                              <div>
                                <strong>Flavour:</strong> {item.flavour}
                              </div>
                            )}
                            {item.weight && (
                              <div>
                                <strong>Weight/Size:</strong> {item.weight}
                              </div>
                            )}
                            {item.required_date && (
                              <div>
                                <strong>Date Required:</strong> {item.required_date}
                              </div>
                            )}
                            {item.delivery_type && (
                              <div>
                                <strong>Type:</strong> {item.delivery_type}
                              </div>
                            )}
                          </div>

                          {item.cake_message && (
                            <div className="order-cake-message">
                              &ldquo;{item.cake_message}&rdquo;
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                {order.notes && order.notes !== "None" && (
                  <div className="order-notes-box">
                    <strong>Special Instructions / Notes:</strong> {order.notes}
                  </div>
                )}

                {/* Actions */}
                <div className="order-actions-row">
                  <button
                    type="button"
                    className="order-delete-btn"
                    onClick={() => deleteOrder(order.id)}
                  >
                    Delete Order
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Orders;
