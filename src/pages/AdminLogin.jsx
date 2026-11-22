import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../styles/AdminLogin.css";

function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState(
    () => localStorage.getItem("golden_crust_admin_email") || ""
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Check if admin is already logged in
  useEffect(() => {
    let ignore = false;

    const checkExistingAuth = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user && !ignore) {
          const { data: adminRecord } = await supabase
            .from("admin_users")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (adminRecord && !ignore) {
            navigate("/admin/dashboard", { replace: true });
            return;
          }
        }
      } catch (err) {
        console.error("Session check error:", err);
      } finally {
        if (!ignore) {
          setCheckingSession(false);
        }
      }
    };

    checkExistingAuth();

    return () => {
      ignore = true;
    };
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const cleanEmail = email.trim();

      const { data, error: authError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password,
        });

      if (authError) throw authError;

      if (!data?.user) {
        throw new Error("Unable to authenticate. Please check your credentials.");
      }

      // Check if user is registered in admin_users table
      const { data: adminData, error: adminErr } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (adminErr || !adminData) {
        // Sign out immediately if not authorized
        await supabase.auth.signOut();
        throw new Error(
          "Access Denied: This account does not have administrator privileges for The Golden Crust."
        );
      }

      // Store or remove email preference
      if (rememberEmail) {
        localStorage.setItem("golden_crust_admin_email", cleanEmail);
      } else {
        localStorage.removeItem("golden_crust_admin_email");
      }

      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      setError(
        err.message || "Login failed. Please verify your email and password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      {/* Back to Customer Website */}
      <div className="admin-login-back-nav">
        <button
          type="button"
          className="admin-back-btn"
          onClick={() => navigate("/")}
        >
          ← Back to Bakery Website
        </button>
      </div>

      {/* Main Login Card */}
      <div className="admin-login-card">
        {/* Header */}
        <div className="admin-login-header">
          <div className="admin-login-logo-badge">🥖</div>
          <div className="admin-login-brand">The Golden Crust</div>
          <h1>Admin Portal</h1>
          <p className="admin-login-subtext">
            Sign in to manage products, customer orders, categories, and inventory.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="admin-login-error-banner">
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="admin-login-form">
          {/* Email */}
          <div className="admin-login-field">
            <label htmlFor="admin-email">Admin Email</label>
            <div className="admin-login-input-wrapper">
              <span className="admin-login-input-icon">✉️</span>
              <input
                id="admin-email"
                type="email"
                className="admin-login-input"
                placeholder="admin@thegoldencrust.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading || checkingSession}
              />
            </div>
          </div>

          {/* Password */}
          <div className="admin-login-field">
            <label htmlFor="admin-password">Password</label>
            <div className="admin-login-input-wrapper">
              <span className="admin-login-input-icon">🔑</span>
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                className="admin-login-input"
                placeholder="Enter your admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading || checkingSession}
              />
              <button
                type="button"
                className="admin-login-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
                tabIndex="-1"
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {/* Options: Remember Email */}
          <div className="admin-login-options-row">
            <label className="admin-login-remember">
              <input
                type="checkbox"
                checked={rememberEmail}
                onChange={(e) => setRememberEmail(e.target.checked)}
              />
              <span>Remember my email</span>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="admin-login-submit-btn"
            disabled={loading || checkingSession}
          >
            {loading
              ? "Verifying Admin Credentials..."
              : checkingSession
              ? "Checking Session..."
              : "Sign In to Admin Panel"}
          </button>
        </form>

        {/* Footer Security Badge */}
        <div className="admin-login-footer">
          <span className="admin-login-security-badge">
            🔒 Authorized Staff & Bakery Management Only
          </span>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;
