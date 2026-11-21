import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../styles/AdminDashboard.css";

function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState("");

  useEffect(() => {
    const verifyAdmin = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        navigate("/admin/login", { replace: true });
        return;
      }

      const { data, error } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !data) {
        await supabase.auth.signOut();
        navigate("/admin/login", { replace: true });
        return;
      }

      setAdminEmail(user.email || "");
      setLoading(false);
    };

    verifyAdmin();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login", { replace: true });
  };

  if (loading) {
    return <h2>Verifying admin access...</h2>;
  }

  return (
    <div className="admin-dashboard">
      <header>
        <h1>THE GOLDEN CRUST.</h1>
        <button onClick={handleLogout}>Logout</button>
      </header>

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <h3>ADMIN PANEL</h3>

          <nav>
            <button
              className="active"
              onClick={() => navigate("/admin/dashboard")}
            >
              Dashboard
            </button>

            <button onClick={() => navigate("/admin/products")}>
              Products
            </button>

            <button onClick={() => navigate("/admin/orders")}>
              Orders
            </button>

            <button onClick={() => navigate("/admin/customers")}>
              Customers
            </button>

            <button onClick={() => navigate("/admin/inventory")}>
              Inventory
            </button>

            <button onClick={() => navigate("/admin/settings")}>
              Settings
            </button>
          </nav>
        </aside>

        <main className="admin-main">
          <div className="admin-welcome" id="overview">
            <h2>Welcome Back!</h2>
            <p>Logged in as: {adminEmail}</p>
            <p>Here's your bakery management overview.</p>
          </div>

          <div className="admin-stats">
            <div className="stat-card">
              <h3>Total Products</h3>
              <p>0</p>
            </div>

            <div className="stat-card">
              <h3>Total Orders</h3>
              <p>0</p>
            </div>

            <div className="stat-card">
              <h3>Pending Orders</h3>
              <p>0</p>
            </div>

            <div className="stat-card">
              <h3>Customers</h3>
              <p>0</p>
            </div>
          </div>

          <section className="admin-content">
            <h2>Quick Actions</h2>

            <div className="admin-actions">
              <button onClick={() => navigate("/admin/products")}>
                Manage Products
              </button>

              <button onClick={() => navigate("/admin/orders")}>
                Manage Orders
              </button>

              <button onClick={() => navigate("/admin/inventory")}>
                Manage Inventory
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;