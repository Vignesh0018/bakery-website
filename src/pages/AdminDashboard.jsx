
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

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

      <main>
        <h2>Welcome to Admin Dashboard</h2>
        <p>Logged in as: {adminEmail}</p>

        <h3>Bakery Management</h3>
        <p>Your admin dashboard is ready.</p>
      </main>
    </div>
  );
}

export default AdminDashboard;
