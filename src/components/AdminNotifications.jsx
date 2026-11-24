import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../styles/AdminNotifications.css";

function AdminNotifications() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [readIds, setReadIds] = useState(() => {
    try {
      const stored = localStorage.getItem("golden_crust_read_notifications");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const dropdownRef = useRef(null);

  useEffect(() => {
    let ignore = false;

    const loadAlerts = async () => {
      try {
        const [ordersRes, invRes, prodRes] = await Promise.all([
          supabase
            .from("orders")
            .select("id, customer_name, total_amount, order_status, created_at")
            .order("created_at", { ascending: false })
            .limit(25),
          supabase.from("inventory").select("id, item_name, quantity, minimum_stock, unit"),
          supabase.from("products").select("id, name, is_available").eq("is_available", false),
        ]);

        const newAlerts = [];

        // 1. Pending Orders Alerts
        const pendingOrders = (ordersRes.data || []).filter((o) => o.order_status === "Pending");
        if (pendingOrders.length > 0) {
          newAlerts.push({
            id: `pending-orders-${pendingOrders.length}`,
            category: "Orders",
            type: "warning",
            icon: "⏳",
            title: `${pendingOrders.length} Pending Order${pendingOrders.length > 1 ? "s" : ""}`,
            message: `Orders awaiting kitchen confirmation. Oldest: #${pendingOrders[0].id} (${pendingOrders[0].customer_name || "Guest"}).`,
            link: "/admin/orders",
            actionText: "Review Orders",
            time: "Needs Action",
          });
        }

        // 2. Recent New Orders (Placed within last 24 hours)
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const recentOrders = (ordersRes.data || []).filter(
          (o) => new Date(o.created_at).getTime() > oneDayAgo
        );
        if (recentOrders.length > 0) {
          newAlerts.push({
            id: `recent-orders-${recentOrders.length}`,
            category: "Orders",
            type: "info",
            icon: "🛎️",
            title: `${recentOrders.length} Order${recentOrders.length > 1 ? "s" : ""} Today`,
            message: `Total revenue: ₹${recentOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0).toLocaleString("en-IN")}.`,
            link: "/admin/orders",
            actionText: "View Orders",
            time: "Today",
          });
        }

        // 3. Out of stock inventory
        const outOfStock = (invRes.data || []).filter((i) => Number(i.quantity) <= 0);
        outOfStock.forEach((item) => {
          newAlerts.push({
            id: `out-stock-${item.id}`,
            category: "Inventory",
            type: "critical",
            icon: "🚫",
            title: `Out of Stock: ${item.item_name}`,
            message: `Depleted! Kitchen cannot bake items requiring ${item.item_name}.`,
            link: "/admin/inventory",
            actionText: "Restock Now",
            time: "Urgent",
          });
        });

        // 4. Low stock inventory
        const lowStock = (invRes.data || []).filter(
          (i) => Number(i.quantity) > 0 && Number(i.quantity) <= Number(i.minimum_stock)
        );
        lowStock.forEach((item) => {
          newAlerts.push({
            id: `low-stock-${item.id}`,
            category: "Inventory",
            type: "warning",
            icon: "⚠️",
            title: `Low Stock: ${item.item_name}`,
            message: `Current: ${item.quantity} ${item.unit}. Minimum threshold: ${item.minimum_stock} ${item.unit}.`,
            link: "/admin/inventory",
            actionText: "Order Stock",
            time: "Stock Warning",
          });
        });

        // 5. Unavailable menu products
        const unavail = prodRes.data || [];
        if (unavail.length > 0) {
          newAlerts.push({
            id: `paused-products-${unavail.length}`,
            category: "Products",
            type: "info",
            icon: "🍰",
            title: `${unavail.length} Product${unavail.length > 1 ? "s" : ""} Paused`,
            message: `Hidden from online customer menu (${unavail.map((p) => p.name).slice(0, 2).join(", ")}...).`,
            link: "/admin/products",
            actionText: "Manage Menu",
            time: "Catalog",
          });
        }

        if (!ignore) {
          setAlerts(newAlerts);
        }
      } catch (err) {
        console.warn("Could not load notifications:", err);
      }
    };

    loadAlerts();
    const interval = setInterval(loadAlerts, 45000); // Check every 45s

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const unreadAlerts = alerts.filter((a) => !readIds.includes(a.id));
  const unreadCount = unreadAlerts.length;

  const handleMarkAllRead = () => {
    const allIds = alerts.map((a) => a.id);
    setReadIds(allIds);
    try {
      localStorage.setItem("golden_crust_read_notifications", JSON.stringify(allIds));
    } catch (e) {
      console.warn("Could not save read notifications:", e);
    }
  };

  const handleAlertClick = (link, alertId) => {
    if (!readIds.includes(alertId)) {
      const updated = [...readIds, alertId];
      setReadIds(updated);
      try {
        localStorage.setItem("golden_crust_read_notifications", JSON.stringify(updated));
      } catch (e) {
        console.warn("Could not save read notifications:", e);
      }
    }
    setIsOpen(false);
    navigate(link);
  };

  return (
    <div className="admin-notif-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className={`admin-notif-bell-btn ${unreadCount > 0 ? "has-unread" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        title="Bakery Notifications & Alerts"
        aria-label="Notifications"
      >
        <span className="admin-notif-bell-icon">🔔</span>
        {unreadCount > 0 && <span className="admin-notif-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="admin-notif-dropdown">
          <div className="admin-notif-dropdown-header">
            <div className="admin-notif-dropdown-title">
              <strong>Bakery Alerts</strong>
              {unreadCount > 0 && (
                <span className="admin-notif-unread-tag">{unreadCount} New</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="admin-notif-mark-read-btn"
                onClick={handleMarkAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="admin-notif-dropdown-list">
            {alerts.length === 0 ? (
              <div className="admin-notif-empty">
                <span style={{ fontSize: "24px" }}>✨</span>
                <p>All quiet! No pending orders or low stock alerts right now.</p>
              </div>
            ) : (
              alerts.map((alert) => {
                const isRead = readIds.includes(alert.id);
                return (
                  <div
                    key={alert.id}
                    className={`admin-notif-item ${alert.type} ${isRead ? "read" : "unread"}`}
                    onClick={() => handleAlertClick(alert.link, alert.id)}
                  >
                    <div className="admin-notif-icon-col">
                      <span className="admin-notif-item-icon">{alert.icon}</span>
                    </div>
                    <div className="admin-notif-content-col">
                      <div className="admin-notif-item-header">
                        <strong>{alert.title}</strong>
                        <span className="admin-notif-item-time">{alert.time}</span>
                      </div>
                      <p className="admin-notif-item-msg">{alert.message}</p>
                      <span className="admin-notif-action-link">
                        {alert.actionText} →
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="admin-notif-dropdown-footer">
            <button
              type="button"
              className="admin-notif-view-all-btn"
              onClick={() => {
                setIsOpen(false);
                navigate("/admin/notifications");
              }}
            >
              Open Full Notifications Center →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminNotifications;
