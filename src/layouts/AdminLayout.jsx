import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import AdminNotifications from "../components/AdminNotifications";
import "../styles/AdminLayout.css";

const NAV_ITEMS = [
  { path: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { path: "/admin/billing", label: "Billing & POS", icon: "🧾" },
  { path: "/admin/products", label: "Products", icon: "🍰" },
  { path: "/admin/categories", label: "Categories", icon: "🏷️" },
  { path: "/admin/orders", label: "Orders", icon: "📦" },
  { path: "/admin/payments", label: "Payments", icon: "💳" },
  { path: "/admin/customers", label: "Customers", icon: "👥" },
  { path: "/admin/inventory", label: "Inventory", icon: "🌾" },
  { path: "/admin/expenses", label: "Expenses", icon: "💸" },
  { path: "/admin/profit-loss", label: "Profit & Loss", icon: "📈" },
  { path: "/admin/staff", label: "Staff & Roster", icon: "👨‍🍳" },
  { path: "/admin/notifications", label: "Notifications", icon: "🔔" },
];

function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const [adminEmail, setAdminEmail] = useState("");
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let ignore = false;

    const checkSession = async () => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (!ignore) {
          if (currentUser) {
            setUser(currentUser);
            setAdminEmail(currentUser.email || "Admin");
          } else {
            setUser(null);
            setAdminEmail("");
          }
        }
      } catch (err) {
        console.error("AdminLayout session check error:", err);
      }
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!ignore) {
        if (session?.user) {
          setUser(session.user);
          setAdminEmail(session.user.email || "Admin");
        } else {
          setUser(null);
          setAdminEmail("");
        }
      }
    });

    return () => {
      ignore = true;
      subscription?.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Logout error:", e);
    }
    navigate("/admin/login", { replace: true });
  };

  const isItemActive = (path) => {
    if (path === "/admin/dashboard") {
      return location.pathname === "/admin/dashboard" || location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="admin-dashboard">
      {/* Top Header */}
      <header className="admin-header">
        <div className="admin-header-brand-wrap">
          <button
            type="button"
            className="admin-mobile-toggle"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            title="Toggle Menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>

          <div
            className="admin-header-brand"
            onClick={() => navigate("/admin/dashboard")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") navigate("/admin/dashboard");
            }}
          >
            <span className="admin-header-logo">🥖</span>
            <h1 className="admin-header-title">THE GOLDEN CRUST</h1>
            <span className="admin-header-badge">Admin Hub</span>
          </div>
        </div>

        <div className="admin-header-actions">
          <AdminNotifications />

          <button
            type="button"
            className="admin-header-btn admin-header-btn-ghost"
            onClick={() => navigate("/")}
            title="Open customer website"
          >
            🌐 View Website
          </button>

          {user ? (
            <button
              type="button"
              className="admin-header-btn admin-header-btn-logout"
              onClick={handleLogout}
              title="Log out from admin account"
            >
              🚪 Logout
            </button>
          ) : (
            <button
              type="button"
              className="admin-header-btn admin-header-btn-ghost"
              onClick={() => navigate("/admin/login")}
              title="Log in to admin account"
            >
              🔑 Log In
            </button>
          )}
        </div>
      </header>

      {/* Main Layout: Persistent Sidebar + Main Area */}
      <div className="admin-layout">
        {/* Backdrop for mobile drawer */}
        {mobileMenuOpen && (
          <div
            className="admin-sidebar-backdrop"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Persistent Sidebar */}
        <aside className={`admin-sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
          <div>
            <div className="admin-sidebar-nav-title">Management</div>
            <nav>
              {NAV_ITEMS.map((item) => {
                const active = isItemActive(item.path);
                return (
                  <button
                    key={item.path}
                    type="button"
                    className={`admin-sidebar-btn ${active ? "active" : ""}`}
                    onClick={() => {
                      navigate(item.path);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <span className="admin-sidebar-icon">{item.icon}</span>
                    <span className="admin-sidebar-label">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="admin-sidebar-footer">
            {adminEmail ? (
              <div className="admin-sidebar-user-info" title={adminEmail}>
                <span className="admin-sidebar-user-avatar">👤</span>
                <span className="admin-sidebar-user-email">{adminEmail}</span>
              </div>
            ) : null}
            <span>The Golden Crust Bakery v1.0</span>
          </div>
        </aside>

        {/* Nested Page Content */}
        <main className="admin-main">
          <Outlet context={{ adminEmail, user }} />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
