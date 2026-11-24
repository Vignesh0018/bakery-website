import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import AdminNotifications from "../components/AdminNotifications";
import "../styles/AdminDashboard.css";

function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState("");
  const [recentOrders, setRecentOrders] = useState([]);

  const [orderPipeline, setOrderPipeline] = useState({
    Pending: 0,
    Confirmed: 0,
    Preparing: 0,
    Ready: 0,
    Delivered: 0,
    Cancelled: 0,
  });
  const [dailySales, setDailySales] = useState([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState({});

  const [stats, setStats] = useState({
    totalProducts: 0,
    totalCategories: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalCustomers: 0,
    totalInventory: 0,
    lowStockCount: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
  });

  // Fetch dashboard statistics
  const fetchStats = async () => {
    try {
      const [
        productsResult,
        categoriesResult,
        ordersCountResult,
        pendingResult,
        allOrdersResult,
        inventoryResult,
        productsListResult,
        recentOrdersResult,
      ] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("categories").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("*", { count: "exact", head: true }),
        supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("order_status", "Pending"),
        supabase.from("orders").select("phone, total_amount, order_status, created_at"),
        supabase.from("inventory").select("quantity, minimum_stock"),
        supabase.from("products").select("category"),
        supabase
          .from("orders")
          .select("id, customer_name, phone, total_amount, order_status, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const uniqueCustomers = new Set(
        (allOrdersResult.data || []).map((order) => order.phone)
      );

      // Revenue sum and pipeline computation
      let revenue = 0;
      const pipeline = {
        Pending: 0,
        Confirmed: 0,
        Preparing: 0,
        Ready: 0,
        Delivered: 0,
        Cancelled: 0,
      };

      (allOrdersResult.data || []).forEach((order) => {
        if (order.order_status !== "Cancelled") {
          revenue += Number(order.total_amount || 0);
        }
        if (pipeline[order.order_status] !== undefined) {
          pipeline[order.order_status] += 1;
        }
      });
      setOrderPipeline(pipeline);

      // Compute last 7 days sales
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const dateStr = d.toISOString().split("T")[0];
        const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
        days.push({
          date: dateStr,
          label: dayLabel,
          revenue: 0,
          ordersCount: 0,
        });
      }

      (allOrdersResult.data || []).forEach((o) => {
        if (o.order_status !== "Cancelled" && o.created_at) {
          const oDate = o.created_at.split("T")[0];
          const match = days.find((d) => d.date === oDate);
          if (match) {
            match.revenue += Number(o.total_amount || 0);
            match.ordersCount += 1;
          }
        }
      });
      setDailySales(days);

      // Product category breakdown
      const catCount = {};
      const prodsList = inventoryResult.data ? allOrdersResult.data : [];
      (productsResult.data || []).forEach((p) => {
        if (p.category) {
          catCount[p.category] = (catCount[p.category] || 0) + 1;
        }
      });

      // Low stock count
      let lowCount = 0;
      (inventoryResult.data || []).forEach((item) => {
        if (Number(item.quantity) <= Number(item.minimum_stock)) {
          lowCount += 1;
        }
      });

      // Fetch expenses
      let expensesSum = 0;
      try {
        const { data: expData, error: expErr } = await supabase
          .from("expenses")
          .select("amount");
        if (!expErr && expData && expData.length > 0) {
          expensesSum = expData.reduce((acc, x) => acc + Number(x.amount || 0), 0);
        } else {
          const stored = localStorage.getItem("golden_crust_expenses");
          if (stored) {
            const parsed = JSON.parse(stored);
            expensesSum = parsed.reduce((acc, x) => acc + Number(x.amount || 0), 0);
          }
        }
      } catch {
        const stored = localStorage.getItem("golden_crust_expenses");
        if (stored) {
          const parsed = JSON.parse(stored);
          expensesSum = parsed.reduce((acc, x) => acc + Number(x.amount || 0), 0);
        }
      }

      const calculatedNetProfit = revenue - expensesSum;

      setStats({
        totalProducts: productsResult.count || 0,
        totalCategories: categoriesResult.count || 0,
        totalOrders: ordersCountResult.count || 0,
        pendingOrders: pendingResult.count || 0,
        totalCustomers: uniqueCustomers.size,
        totalInventory: inventoryResult.data ? inventoryResult.data.length : 0,
        lowStockCount: lowCount,
        totalRevenue: revenue,
        totalExpenses: expensesSum,
        netProfit: calculatedNetProfit,
      });

      setRecentOrders(recentOrdersResult.data || []);
    } catch (err) {
      console.error("Dashboard statistics error:", err);
    }
  };

  // Verify admin and load dashboard
  useEffect(() => {
    let ignore = false;

    const verifyAdmin = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          if (!ignore) navigate("/admin/login", { replace: true });
          return;
        }

        const { data: adminRecord, error: adminErr } = await supabase
          .from("admin_users")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (adminErr || !adminRecord) {
          await supabase.auth.signOut();
          if (!ignore) navigate("/admin/login", { replace: true });
          return;
        }

        if (!ignore) {
          setAdminEmail(user.email || "");
          await fetchStats();
        }
      } catch (err) {
        console.error("Admin verification error:", err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    verifyAdmin();

    return () => {
      ignore = true;
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login", { replace: true });
  };

  // Time-based greeting helper
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff8ef",
          color: "#432719",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <h2>Verifying Administrator Access...</h2>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* Top Header */}
      <header className="admin-header">
        <div className="admin-header-brand">
          <span className="admin-header-logo">🥖</span>
          <h1 className="admin-header-title">THE GOLDEN CRUST</h1>
          <span className="admin-header-badge">Admin Hub</span>
        </div>

        <div className="admin-header-actions">
          <button
            type="button"
            className="admin-header-btn admin-header-btn-ghost"
            onClick={() => navigate("/")}
            title="Open customer website"
          >
            🌐 View Website
          </button>

          <button
            type="button"
            className="admin-header-btn admin-header-btn-logout"
            onClick={handleLogout}
          >
            🚪 Logout
          </button>
        </div>
      </header>

      {/* Main Layout: Sidebar + Main Area */}
      <div className="admin-layout">
        {/* Sidebar */}
        <aside className="admin-sidebar">
          <div>
            <div className="admin-sidebar-nav-title">Management</div>
            <nav>
              <button
                type="button"
                className="admin-sidebar-btn active"
                onClick={() => navigate("/admin/dashboard")}
              >
                <span className="admin-sidebar-icon">📊</span>
                Dashboard
              </button>

              <button
                type="button"
                className="admin-sidebar-btn"
                onClick={() => navigate("/admin/products")}
              >
                <span className="admin-sidebar-icon">🍰</span>
                Products
              </button>

              <button
                type="button"
                className="admin-sidebar-btn"
                onClick={() => navigate("/admin/categories")}
              >
                <span className="admin-sidebar-icon">🏷️</span>
                Categories
              </button>

              <button
                type="button"
                className="admin-sidebar-btn"
                onClick={() => navigate("/admin/orders")}
              >
                <span className="admin-sidebar-icon">📦</span>
                Orders
              </button>

              <button
                type="button"
                className="admin-sidebar-btn"
                onClick={() => navigate("/admin/customers")}
              >
                <span className="admin-sidebar-icon">👥</span>
                Customers
              </button>

              <button
                type="button"
                className="admin-sidebar-btn"
                onClick={() => navigate("/admin/inventory")}
              >
                <span className="admin-sidebar-icon">🌾</span>
                Inventory
              </button>

              <button
                type="button"
                className="admin-sidebar-btn"
                onClick={() => navigate("/admin/expenses")}
              >
                <span className="admin-sidebar-icon">💸</span>
                Expenses
              </button>

              <button
                type="button"
                className="admin-sidebar-btn"
                onClick={() => navigate("/admin/profit-loss")}
              >
                <span className="admin-sidebar-icon">📈</span>
                Profit & Loss
              </button>
            </nav>
          </div>

          <div className="admin-sidebar-footer">
            <span>The Golden Crust Bakery v1.0</span>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="admin-main">
          {/* Welcome Banner Box */}
          <div className="admin-welcome-box">
            <div className="admin-welcome-text">
              <h2>
                {getGreeting()}, Bakery Admin!
              </h2>
              <p>
                Here is your live bakery overview, pending kitchen tickets, and store activity.
              </p>
              <div className="admin-user-pill">
                👤 Logged in as: {adminEmail}
              </div>
            </div>

            <div className="admin-welcome-actions">
              <button
                type="button"
                className="admin-header-btn admin-header-btn-ghost"
                style={{ background: "#432719", color: "#fff8ef" }}
                onClick={fetchStats}
              >
                🔄 Refresh Metrics
              </button>
            </div>
          </div>

          {/* Actionable Pending Orders Alert */}
          {stats.pendingOrders > 0 && (
            <div className="admin-alert-banner admin-alert-warning">
              <span>
                ⏳ <strong>Pending Orders:</strong> You have {stats.pendingOrders} order(s) waiting for kitchen confirmation.
              </span>
              <button
                type="button"
                className="admin-alert-action-btn"
                onClick={() => navigate("/admin/orders")}
              >
                Review Orders ({stats.pendingOrders})
              </button>
            </div>
          )}

          {/* Actionable Low Stock Alert */}
          {stats.lowStockCount > 0 && (
            <div className="admin-alert-banner admin-alert-warning">
              <span>
                ⚠️ <strong>Inventory Alert:</strong> {stats.lowStockCount} ingredient(s) or supplies are at or below reorder threshold.
              </span>
              <button
                type="button"
                className="admin-alert-action-btn"
                onClick={() => navigate("/admin/inventory")}
              >
                Check Stock ({stats.lowStockCount})
              </button>
            </div>
          )}

          {/* KPI Statistics Grid */}
          <div className="admin-stats-grid">
            {/* Products */}
            <div
              className="dashboard-stat-card"
              onClick={() => navigate("/admin/products")}
              title="Click to view Products"
            >
              <div className="dashboard-stat-header">
                <span className="dashboard-stat-title">Products</span>
                <span className="dashboard-stat-icon">🍰</span>
              </div>
              <p className="dashboard-stat-value">{stats.totalProducts}</p>
              <span className="dashboard-stat-desc">Menu items published</span>
            </div>

            {/* Categories */}
            <div
              className="dashboard-stat-card"
              onClick={() => navigate("/admin/categories")}
              title="Click to view Categories"
            >
              <div className="dashboard-stat-header">
                <span className="dashboard-stat-title">Categories</span>
                <span className="dashboard-stat-icon">🏷️</span>
              </div>
              <p className="dashboard-stat-value">{stats.totalCategories}</p>
              <span className="dashboard-stat-desc">Menu classifications</span>
            </div>

            {/* Orders */}
            <div
              className="dashboard-stat-card"
              onClick={() => navigate("/admin/orders")}
              title="Click to view Orders"
            >
              <div className="dashboard-stat-header">
                <span className="dashboard-stat-title">Total Orders</span>
                <span className="dashboard-stat-icon">📦</span>
              </div>
              <p className="dashboard-stat-value">{stats.totalOrders}</p>
              <span className="dashboard-stat-desc">Orders placed to date</span>
            </div>

            {/* Pending Orders */}
            <div
              className="dashboard-stat-card"
              onClick={() => navigate("/admin/orders")}
              title="Click to review Pending Orders"
            >
              <div className="dashboard-stat-header">
                <span className="dashboard-stat-title">Pending Orders</span>
                <span className="dashboard-stat-icon">⏳</span>
              </div>
              <p className="dashboard-stat-value" style={{ color: "#e65100" }}>
                {stats.pendingOrders}
              </p>
              <span className="dashboard-stat-desc">Awaiting confirmation</span>
            </div>

            {/* Customers */}
            <div
              className="dashboard-stat-card"
              onClick={() => navigate("/admin/customers")}
              title="Click to view Customers"
            >
              <div className="dashboard-stat-header">
                <span className="dashboard-stat-title">Customers</span>
                <span className="dashboard-stat-icon">👥</span>
              </div>
              <p className="dashboard-stat-value">{stats.totalCustomers}</p>
              <span className="dashboard-stat-desc">Unique customer profiles</span>
            </div>

            {/* Inventory */}
            <div
              className="dashboard-stat-card"
              onClick={() => navigate("/admin/inventory")}
              title="Click to view Inventory"
            >
              <div className="dashboard-stat-header">
                <span className="dashboard-stat-title">Inventory Items</span>
                <span className="dashboard-stat-icon">🌾</span>
              </div>
              <p className="dashboard-stat-value">{stats.totalInventory}</p>
              <span className="dashboard-stat-desc">Baking ingredients tracked</span>
            </div>

            {/* Total Sales */}
            <div
              className="dashboard-stat-card"
              onClick={() => navigate("/admin/orders")}
              title="Click to view Sales & Orders"
            >
              <div className="dashboard-stat-header">
                <span className="dashboard-stat-title">Gross Revenue</span>
                <span className="dashboard-stat-icon">💰</span>
              </div>
              <p className="dashboard-stat-value" style={{ color: "#2e7d32", fontSize: "28px" }}>
                ₹{stats.totalRevenue.toLocaleString("en-IN")}
              </p>
              <span className="dashboard-stat-desc">Net bakery sales</span>
            </div>

            {/* Total Expenses */}
            <div
              className="dashboard-stat-card"
              onClick={() => navigate("/admin/expenses")}
              title="Click to view & manage Expenses"
            >
              <div className="dashboard-stat-header">
                <span className="dashboard-stat-title">Total Expenses</span>
                <span className="dashboard-stat-icon">💸</span>
              </div>
              <p className="dashboard-stat-value" style={{ color: "#c62828", fontSize: "28px" }}>
                ₹{stats.totalExpenses.toLocaleString("en-IN")}
              </p>
              <span className="dashboard-stat-desc">Ingredients, utilities & overheads</span>
            </div>

            {/* Net Operating Profit */}
            <div
              className="dashboard-stat-card"
              onClick={() => navigate("/admin/profit-loss")}
              title="Click to view Profit & Loss Statement"
            >
              <div className="dashboard-stat-header">
                <span className="dashboard-stat-title">Net Operating Profit</span>
                <span className="dashboard-stat-icon">
                  {stats.netProfit >= 0 ? "📈" : "📉"}
                </span>
              </div>
              <p
                className="dashboard-stat-value"
                style={{
                  color: stats.netProfit >= 0 ? "#1b5e20" : "#c62828",
                  fontSize: "28px",
                }}
              >
                ₹{stats.netProfit.toLocaleString("en-IN")}
              </p>
              <span className="dashboard-stat-desc">
                {stats.netProfit >= 0 ? "Surplus (Profitable)" : "Deficit (Operating Loss)"}
              </span>
            </div>
          </div>

          {/* Recent Orders Section */}
          <section className="admin-section">
            <div className="admin-section-header">
              <h2>Recent Orders</h2>
              <button
                type="button"
                className="admin-section-link"
                onClick={() => navigate("/admin/orders")}
              >
                View All Orders →
              </button>
            </div>

            {recentOrders.length === 0 ? (
              <p style={{ color: "#8a6b58", margin: 0, fontSize: "14px" }}>
                No orders received yet. New incoming orders will appear here automatically.
              </p>
            ) : (
              <div className="dashboard-orders-table-wrapper">
                <table className="dashboard-orders-table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Customer</th>
                      <th>Contact</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Placed At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => {
                      let tagClass = "dashboard-status-other";
                      if (order.order_status === "Pending") tagClass = "dashboard-status-pending";
                      if (order.order_status === "Preparing" || order.order_status === "Confirmed") tagClass = "dashboard-status-preparing";
                      if (order.order_status === "Delivered") tagClass = "dashboard-status-delivered";

                      return (
                        <tr
                          key={order.id}
                          style={{ cursor: "pointer" }}
                          onClick={() => navigate("/admin/orders")}
                          title="Click to open orders"
                        >
                          <td style={{ fontWeight: 700 }}>#{order.id}</td>
                          <td>{order.customer_name || "Guest Customer"}</td>
                          <td>{order.phone}</td>
                          <td style={{ fontWeight: 700, color: "#2e7d32" }}>
                            ₹{Number(order.total_amount || 0).toLocaleString("en-IN")}
                          </td>
                          <td>
                            <span className={`dashboard-status-tag ${tagClass}`}>
                              {order.order_status}
                            </span>
                          </td>
                          <td style={{ color: "#8a6b58", fontSize: "12px" }}>
                            {new Date(order.created_at).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Quick Actions Hub */}
          <section className="admin-section">
            <div className="admin-section-header">
              <h2>Quick Actions Hub</h2>
            </div>

            <div className="admin-actions-grid">
              <div
                className="admin-action-card"
                onClick={() => navigate("/admin/products")}
              >
                <span className="admin-action-icon">🍰</span>
                <h3>Manage Products</h3>
                <p>Add, edit price, or toggle menu availability</p>
              </div>

              <div
                className="admin-action-card"
                onClick={() => navigate("/admin/categories")}
              >
                <span className="admin-action-icon">🏷️</span>
                <h3>Manage Categories</h3>
                <p>Classify breads, cakes, cookies & pastries</p>
              </div>

              <div
                className="admin-action-card"
                onClick={() => navigate("/admin/orders")}
              >
                <span className="admin-action-icon">📦</span>
                <h3>Process Orders</h3>
                <p>Review customer orders and update kitchen tickets</p>
              </div>

              <div
                className="admin-action-card"
                onClick={() => navigate("/admin/inventory")}
              >
                <span className="admin-action-icon">🌾</span>
                <h3>Manage Inventory</h3>
                <p>Track flour, sugar, butter & reorder alerts</p>
              </div>

              <div
                className="admin-action-card"
                onClick={() => navigate("/admin/customers")}
              >
                <span className="admin-action-icon">👥</span>
                <h3>Customer Directory</h3>
                <p>View repeat buyers and customer spend history</p>
              </div>

              <div
                className="admin-action-card"
                onClick={() => navigate("/")}
              >
                <span className="admin-action-icon">🌐</span>
                <h3>Visit Storefront</h3>
                <p>Preview the live website as customers see it</p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
