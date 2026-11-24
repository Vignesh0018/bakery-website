import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  STAFF_ROLES,
  PERMISSIONS_LIST,
  SHIFT_SCHEDULES,
  SAMPLE_STAFF,
  SUPABASE_STAFF_SQL_HELPER,
  generateStaffId,
} from "../constants/staff";
import "../styles/Staff.css";

const LOCAL_STORAGE_KEY = "golden_crust_staff";

function Staff() {
  const navigate = useNavigate();

  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [isUsingLocalStorage, setIsUsingLocalStorage] = useState(false);
  const [dismissedStorageBanner, setDismissedStorageBanner] = useState(() => {
    try {
      return localStorage.getItem("dismissed_staff_storage_banner") === "true";
    } catch {
      return false;
    }
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copiedSql, setCopiedSql] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const emptyForm = {
    full_name: "",
    email: "",
    phone: "",
    role: "Head Baker",
    status: "Active",
    shift: "Morning Shift (7:00 AM - 3:00 PM)",
    join_date: new Date().toISOString().split("T")[0],
    permissions: ["manage_products", "manage_orders", "manage_inventory"],
    notes: "",
  };

  const [form, setForm] = useState(emptyForm);

  // Local storage helpers
  const getLocalStaff = () => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const realStaff = parsed.filter(
            (item) => !item.id?.startsWith("sample-staff-")
          );
          if (realStaff.length !== parsed.length) {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(realStaff));
          }
          return realStaff;
        }
      }
    } catch (e) {
      console.warn("Could not read local staff data:", e);
    }
    return [];
  };

  const saveLocalStaff = (items) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Could not save to local storage:", e);
    }
  };

  // Fetch staff
  const fetchStaff = async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: fetchErr } = await supabase
        .from("staff")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchErr) {
        setIsUsingLocalStorage(true);
        const local = getLocalStaff();
        setStaffList(local);
        saveLocalStaff(local);
      } else {
        setIsUsingLocalStorage(false);
        setStaffList(data || []);
      }
    } catch {
      setIsUsingLocalStorage(true);
      const local = getLocalStaff();
      setStaffList(local);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadData = async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from("staff")
          .select("*")
          .order("created_at", { ascending: false });

        if (!ignore) {
          if (fetchErr) {
            setIsUsingLocalStorage(true);
            const local = getLocalStaff();
            setStaffList(local);
            saveLocalStaff(local);
          } else {
            setIsUsingLocalStorage(false);
            setStaffList(data || []);
          }
        }
      } catch {
        if (!ignore) {
          setIsUsingLocalStorage(true);
          const local = getLocalStaff();
          setStaffList(local);
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };

      // Auto-assign suggested default permissions when role changes
      if (name === "role") {
        const selectedRoleDef = STAFF_ROLES.find((r) => r.id === value);
        if (selectedRoleDef) {
          updated.permissions = selectedRoleDef.defaultPermissions;
        }
      }
      return updated;
    });
  };

  const handlePermissionToggle = (permId) => {
    setForm((prev) => {
      const exists = prev.permissions.includes(permId);
      const newPerms = exists
        ? prev.permissions.filter((p) => p !== permId)
        : [...prev.permissions, permId];
      return { ...prev, permissions: newPerms };
    });
  };

  const cancelForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setIsFormOpen(false);
    setError("");
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    if (!form.full_name.trim()) {
      setError("Please enter the staff member's full name.");
      setSaving(false);
      return;
    }

    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      role: form.role,
      status: form.status,
      shift: form.shift,
      join_date: form.join_date,
      permissions: form.permissions,
      notes: form.notes ? form.notes.trim() : "",
    };

    try {
      if (isUsingLocalStorage) {
        if (editingId) {
          const updated = staffList.map((s) =>
            s.id === editingId ? { ...s, ...payload } : s
          );
          setStaffList(updated);
          saveLocalStaff(updated);
          setSuccess(`Staff account for ${payload.full_name} updated successfully!`);
        } else {
          const newItem = {
            ...payload,
            id: generateStaffId(),
            created_at: new Date().toISOString(),
          };
          const updated = [newItem, ...staffList];
          setStaffList(updated);
          saveLocalStaff(updated);
          setSuccess(`New staff account for ${payload.full_name} created successfully!`);
        }
        cancelForm();
      } else {
        let result;
        if (editingId) {
          result = await supabase.from("staff").update(payload).eq("id", editingId);
        } else {
          result = await supabase.from("staff").insert([payload]);
        }

        if (result.error) throw result.error;

        setSuccess(
          editingId
            ? `Staff member ${payload.full_name} updated successfully!`
            : `Staff member ${payload.full_name} added to team!`
        );
        cancelForm();
        await fetchStaff();
      }
    } catch (err) {
      if (err.code === "PGRST205" || err.code === "42501" || err.message?.includes("schema cache")) {
        setIsUsingLocalStorage(true);
        if (editingId) {
          const updated = staffList.map((s) =>
            s.id === editingId ? { ...s, ...payload } : s
          );
          setStaffList(updated);
          saveLocalStaff(updated);
          setSuccess(`Staff member ${payload.full_name} updated (saved to local storage)!`);
        } else {
          const newItem = {
            ...payload,
            id: generateStaffId(),
            created_at: new Date().toISOString(),
          };
          const updated = [newItem, ...staffList];
          setStaffList(updated);
          saveLocalStaff(updated);
          setSuccess(`Staff member ${payload.full_name} created (saved to local storage)!`);
        }
        cancelForm();
      } else {
        setError(err.message || "Failed to save staff record.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (member) => {
    setForm({
      full_name: member.full_name,
      email: member.email || "",
      phone: member.phone || "",
      role: member.role || "Head Baker",
      status: member.status || "Active",
      shift: member.shift || "General Shift (9:00 AM - 5:00 PM)",
      join_date: member.join_date || new Date().toISOString().split("T")[0],
      permissions: Array.isArray(member.permissions) ? member.permissions : [],
      notes: member.notes || "",
    });
    setEditingId(member.id);
    setIsFormOpen(true);
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggleStatus = async (member) => {
    const nextStatus = member.status === "Active" ? "On Leave" : "Active";
    setError("");
    setSuccess("");

    try {
      if (isUsingLocalStorage) {
        const updated = staffList.map((s) =>
          s.id === member.id ? { ...s, status: nextStatus } : s
        );
        setStaffList(updated);
        saveLocalStaff(updated);
        setSuccess(`${member.full_name} is now marked as "${nextStatus}".`);
      } else {
        const { error: updErr } = await supabase
          .from("staff")
          .update({ status: nextStatus })
          .eq("id", member.id);

        if (updErr) throw updErr;

        setStaffList((prev) =>
          prev.map((s) => (s.id === member.id ? { ...s, status: nextStatus } : s))
        );
        setSuccess(`${member.full_name} is now marked as "${nextStatus}".`);
      }
    } catch (err) {
      setError(err.message || "Failed to update staff status.");
    }
  };

  const handleDelete = async (id) => {
    const member = staffList.find((s) => s.id === id);
    const confirmed = window.confirm(
      `Are you sure you want to remove ${member?.full_name || "this staff member"} from the bakery roster?`
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      if (isUsingLocalStorage) {
        const updated = staffList.filter((s) => s.id !== id);
        setStaffList(updated);
        saveLocalStaff(updated);
        setSuccess("Staff member removed from team.");
        if (editingId === id) cancelForm();
      } else {
        const { error: delErr } = await supabase.from("staff").delete().eq("id", id);
        if (delErr) throw delErr;

        setSuccess("Staff member removed from team.");
        if (editingId === id) cancelForm();
        await fetchStaff();
      }
    } catch (err) {
      setError(err.message || "Failed to delete staff member.");
    }
  };

  const handleSeedStaff = async () => {
    const confirmed = window.confirm(
      "Load standard bakery operational roles (Head Baker, Pastry Chef, Cashier, Manager, Delivery)?"
    );
    if (!confirmed) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!isUsingLocalStorage) {
        const toInsert = SAMPLE_STAFF.map(
          ({ full_name, email, phone, role, status, shift, join_date, permissions, notes }) => ({
            full_name,
            email,
            phone,
            role,
            status,
            shift,
            join_date,
            permissions,
            notes,
          })
        );

        const { error: seedErr } = await supabase.from("staff").insert(toInsert);
        if (seedErr) throw seedErr;
        setSuccess("Sample bakery team loaded into database!");
        await fetchStaff();
      } else {
        setStaffList(SAMPLE_STAFF);
        saveLocalStaff(SAMPLE_STAFF);
        setSuccess("Sample bakery team loaded into browser storage!");
      }
    } catch {
      setIsUsingLocalStorage(true);
      setStaffList(SAMPLE_STAFF);
      saveLocalStaff(SAMPLE_STAFF);
      setSuccess("Sample bakery staff loaded in local storage!");
    } finally {
      setLoading(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_STAFF_SQL_HELPER);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  // Filtered staff computation
  let filteredStaff = [...staffList];
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filteredStaff = filteredStaff.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.role && s.role.toLowerCase().includes(q)) ||
        (s.notes && s.notes.toLowerCase().includes(q))
    );
  }

  if (roleFilter !== "all") {
    filteredStaff = filteredStaff.filter((s) => s.role === roleFilter);
  }

  if (shiftFilter !== "all") {
    filteredStaff = filteredStaff.filter((s) => s.shift === shiftFilter);
  }

  if (statusFilter !== "all") {
    filteredStaff = filteredStaff.filter((s) => s.status === statusFilter);
  }

  // Stats calculation
  const totalCount = staffList.length;
  const activeCount = staffList.filter((s) => s.status === "Active").length;
  const kitchenCount = staffList.filter(
    (s) => s.role === "Head Baker" || s.role === "Pastry Chef" || s.role === "Kitchen Assistant"
  ).length;
  const frontDeskCount = staffList.filter(
    (s) => s.role === "Cashier" || s.role === "Delivery Lead"
  ).length;

  return (
    <div className="staff-page">
      {/* Header */}
      <div className="staff-header">
        <div className="staff-header-left">
          <div className="staff-title-row">
            <h1>Staff & Kitchen Roster</h1>
            <span className="staff-badge">Team Ops</span>
          </div>
          <p>
            Manage bakery employee accounts, kitchen roles, shift schedules, and operational permissions.
          </p>
        </div>

        <div className="staff-header-actions">
          <button
            type="button"
            className="staff-btn staff-btn-secondary"
            onClick={() => navigate("/admin/dashboard")}
          >
            ← Dashboard
          </button>

          <button
            type="button"
            className="staff-btn staff-btn-secondary"
            onClick={() => navigate("/admin/notifications")}
          >
            🔔 Notifications
          </button>

          <button
            type="button"
            className="staff-btn staff-btn-secondary"
            onClick={fetchStaff}
            disabled={loading}
          >
            🔄 {loading ? "Updating..." : "Refresh"}
          </button>

          <button
            type="button"
            className="staff-btn staff-btn-primary"
            onClick={() => {
              if (isFormOpen && !editingId) {
                cancelForm();
              } else {
                setForm(emptyForm);
                setEditingId(null);
                setIsFormOpen(true);
              }
            }}
          >
            {isFormOpen && !editingId ? "✕ Close Form" : "+ Add Staff Member"}
          </button>
        </div>
      </div>

      {/* Storage Mode Notice */}
      {isUsingLocalStorage && !dismissedStorageBanner && (
        <div className="staff-storage-banner">
          <div className="staff-storage-info">
            <span className="staff-storage-icon">👥</span>
            <div>
              <strong>Using Browser Storage:</strong> Staff accounts are currently preserved locally in this browser.
              To sync staff profiles to Supabase Cloud, run the 1-minute table setup script.
            </div>
          </div>
          <div className="staff-storage-actions">
            <button
              type="button"
              className="staff-storage-btn"
              onClick={() => setIsSqlModalOpen(true)}
            >
              📋 View Supabase SQL Setup
            </button>
            <button
              type="button"
              className="staff-storage-close-btn"
              onClick={() => {
                setDismissedStorageBanner(true);
                try {
                  localStorage.setItem("dismissed_staff_storage_banner", "true");
                } catch (e) {
                  console.warn("Storage save failed:", e);
                }
              }}
              title="Dismiss banner"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {success && (
        <div className="staff-banner staff-banner-success">
          <span>✓ {success}</span>
          <button type="button" className="staff-banner-close" onClick={() => setSuccess("")}>
            ✕
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="staff-banner staff-banner-error">
          <span>⚠️ {error}</span>
          <button type="button" className="staff-banner-close" onClick={() => setError("")}>
            ✕
          </button>
        </div>
      )}

      {/* SQL Setup Modal */}
      {isSqlModalOpen && (
        <div className="staff-modal-overlay" onClick={() => setIsSqlModalOpen(false)}>
          <div className="staff-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="staff-modal-header">
              <h3>⚡ Connect Staff Table to Supabase Cloud</h3>
              <button
                type="button"
                className="staff-modal-close"
                onClick={() => setIsSqlModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <p className="staff-modal-desc">
              Copy and execute this script once in your <strong>Supabase Dashboard → SQL Editor</strong> to create the <code>staff</code> table:
            </p>
            <pre className="staff-sql-snippet">{SUPABASE_STAFF_SQL_HELPER}</pre>
            <div className="staff-modal-footer">
              <button
                type="button"
                className="staff-btn staff-btn-primary"
                onClick={handleCopySql}
              >
                {copiedSql ? "✓ Copied to Clipboard!" : "📋 Copy SQL Script"}
              </button>
              <button
                type="button"
                className="staff-btn staff-btn-secondary"
                onClick={() => setIsSqlModalOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Executive Metric Cards */}
      <div className="staff-stats-grid">
        <div
          className={`staff-stat-card ${statusFilter === "all" ? "active-filter" : ""}`}
          onClick={() => setStatusFilter("all")}
        >
          <div className="staff-stat-header">
            <span className="staff-stat-title">Total Staff</span>
            <span className="staff-stat-icon">👥</span>
          </div>
          <p className="staff-stat-value">{totalCount}</p>
          <span className="staff-stat-desc">All registered bakery members</span>
        </div>

        <div
          className={`staff-stat-card ${statusFilter === "Active" ? "active-filter" : ""}`}
          onClick={() => setStatusFilter((prev) => (prev === "Active" ? "all" : "Active"))}
        >
          <div className="staff-stat-header">
            <span className="staff-stat-title">Active on Duty</span>
            <span className="staff-stat-icon">🟢</span>
          </div>
          <p className="staff-stat-value" style={{ color: "#2e7d32" }}>
            {activeCount}
          </p>
          <span className="staff-stat-desc">Currently rostered staff</span>
        </div>

        <div
          className={`staff-stat-card ${roleFilter === "Head Baker" ? "active-filter" : ""}`}
          onClick={() => setRoleFilter((prev) => (prev === "Head Baker" ? "all" : "Head Baker"))}
        >
          <div className="staff-stat-header">
            <span className="staff-stat-title">Kitchen Crew</span>
            <span className="staff-stat-icon">👨‍🍳</span>
          </div>
          <p className="staff-stat-value" style={{ color: "#b76e27" }}>
            {kitchenCount}
          </p>
          <span className="staff-stat-desc">Bakers & pastry specialists</span>
        </div>

        <div
          className={`staff-stat-card ${roleFilter === "Cashier" ? "active-filter" : ""}`}
          onClick={() => setRoleFilter((prev) => (prev === "Cashier" ? "all" : "Cashier"))}
        >
          <div className="staff-stat-header">
            <span className="staff-stat-title">Front & Dispatch</span>
            <span className="staff-stat-icon">🛒</span>
          </div>
          <p className="staff-stat-value" style={{ color: "#1565c0" }}>
            {frontDeskCount}
          </p>
          <span className="staff-stat-desc">Cashiers & delivery partners</span>
        </div>
      </div>

      {/* Add / Edit Staff Section */}
      {isFormOpen && (
        <section className="staff-section">
          <div className="staff-section-header">
            <h2>{editingId ? "Edit Staff Account & Permissions" : "Add New Staff Member"}</h2>
            <button type="button" className="staff-btn staff-btn-secondary" onClick={cancelForm}>
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="staff-form">
            <div className="staff-form-grid">
              {/* Full Name */}
              <div className="staff-field">
                <label htmlFor="staff-name">
                  Full Name <span className="required">*</span>
                </label>
                <input
                  id="staff-name"
                  type="text"
                  name="full_name"
                  placeholder="e.g. Pierre Dubois, Ananya Sharma"
                  value={form.full_name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {/* Email */}
              <div className="staff-field">
                <label htmlFor="staff-email">Email Address</label>
                <input
                  id="staff-email"
                  type="email"
                  name="email"
                  placeholder="staff@thegoldencrust.com"
                  value={form.email}
                  onChange={handleInputChange}
                />
              </div>

              {/* Phone */}
              <div className="staff-field">
                <label htmlFor="staff-phone">Phone / WhatsApp</label>
                <input
                  id="staff-phone"
                  type="tel"
                  name="phone"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={handleInputChange}
                />
              </div>

              {/* Role */}
              <div className="staff-field">
                <label htmlFor="staff-role">
                  Bakery Role <span className="required">*</span>
                </label>
                <select
                  id="staff-role"
                  name="role"
                  value={form.role}
                  onChange={handleInputChange}
                  required
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
                <span className="staff-field-hint">
                  {STAFF_ROLES.find((r) => r.id === form.role)?.description}
                </span>
              </div>

              {/* Shift */}
              <div className="staff-field">
                <label htmlFor="staff-shift">Shift Schedule</label>
                <select
                  id="staff-shift"
                  name="shift"
                  value={form.shift}
                  onChange={handleInputChange}
                >
                  {SHIFT_SCHEDULES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div className="staff-field">
                <label htmlFor="staff-status">Roster Status</label>
                <select
                  id="staff-status"
                  name="status"
                  value={form.status}
                  onChange={handleInputChange}
                >
                  <option value="Active">🟢 Active on Duty</option>
                  <option value="On Leave">🟡 On Leave / Off Today</option>
                  <option value="Inactive">🔴 Inactive / Former</option>
                </select>
              </div>

              {/* Join Date */}
              <div className="staff-field">
                <label htmlFor="staff-join">Date Joined</label>
                <input
                  id="staff-join"
                  type="date"
                  name="join_date"
                  value={form.join_date}
                  onChange={handleInputChange}
                />
              </div>

              {/* Notes */}
              <div className="staff-field">
                <label htmlFor="staff-notes">Specialization / Notes</label>
                <input
                  id="staff-notes"
                  type="text"
                  name="notes"
                  placeholder="e.g. Sourdough specialist, French patisserie certification"
                  value={form.notes}
                  onChange={handleInputChange}
                />
              </div>

              {/* Permissions Checklist */}
              <div className="staff-field staff-field-full">
                <label className="staff-permissions-title">
                  System Permissions & Access Controls:
                </label>
                <div className="staff-permissions-grid">
                  {PERMISSIONS_LIST.map((p) => {
                    const isChecked = form.permissions.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        className={`staff-perm-card ${isChecked ? "checked" : ""}`}
                        onClick={() => handlePermissionToggle(p.id)}
                      >
                        <input
                          type="checkbox"
                          id={`perm-${p.id}`}
                          checked={isChecked}
                          onChange={() => {}}
                        />
                        <div className="staff-perm-info">
                          <strong>{p.label}</strong>
                          <span>{p.desc}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="staff-form-actions">
              <button type="submit" className="staff-btn staff-btn-primary" disabled={saving}>
                {saving
                  ? "Saving Roster..."
                  : editingId
                  ? "Update Staff Account"
                  : "Save Staff Account"}
              </button>
              <button
                type="button"
                className="staff-btn staff-btn-secondary"
                onClick={cancelForm}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Staff Directory Registry */}
      <section className="staff-section">
        <div className="staff-registry-header">
          <div className="staff-registry-title-wrap">
            <h2>Staff Directory</h2>
            <span className="staff-count-badge">
              {filteredStaff.length} {filteredStaff.length === 1 ? "Member" : "Members"}
            </span>
            {filteredStaff.length !== staffList.length && (
              <span className="staff-total-count-tag">of {staffList.length} total</span>
            )}
          </div>

          <div className="staff-registry-actions">
            <button
              type="button"
              className="staff-btn staff-btn-secondary"
              onClick={handleSeedStaff}
              title="Populate bakery staff positions"
            >
              ⚡ Load Sample Bakery Roster
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="staff-controls-bar">
          <div className="staff-search-box">
            <input
              type="text"
              className="staff-search-input"
              placeholder="🔍 Search staff by name, email, role, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="staff-search-clear"
                onClick={() => setSearchQuery("")}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="staff-filters-group">
            {/* Status pills */}
            <div className="staff-status-pills">
              <button
                type="button"
                className={`staff-pill ${statusFilter === "all" ? "active" : ""}`}
                onClick={() => setStatusFilter("all")}
              >
                All ({staffList.length})
              </button>
              <button
                type="button"
                className={`staff-pill ${statusFilter === "Active" ? "active" : ""}`}
                onClick={() => setStatusFilter("Active")}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                className={`staff-pill ${statusFilter === "On Leave" ? "active" : ""}`}
                onClick={() => setStatusFilter("On Leave")}
              >
                On Leave ({staffList.filter((s) => s.status === "On Leave").length})
              </button>
            </div>

            {/* Role Filter */}
            <select
              className="staff-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              {STAFF_ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>

            {/* Shift Filter */}
            <select
              className="staff-select"
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
            >
              <option value="all">All Shift Schedules</option>
              {SHIFT_SCHEDULES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Staff Table / Cards */}
        {loading ? (
          <div className="staff-empty-state">
            <div className="staff-empty-icon">⏳</div>
            <h3>Loading Bakery Roster...</h3>
            <p>Fetching active staff members, roles, and shift assignments.</p>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="staff-empty-state">
            <div className="staff-empty-icon">👨‍🍳</div>
            {staffList.length === 0 ? (
              <>
                <h3>No Staff Members Registered</h3>
                <p>
                  Build your bakery team with custom permissions for Head Bakers, Pastry Chefs, and Store Cashiers.
                </p>
                <div className="staff-empty-actions">
                  <button
                    type="button"
                    className="staff-btn staff-btn-primary"
                    onClick={() => {
                      setForm(emptyForm);
                      setEditingId(null);
                      setIsFormOpen(true);
                    }}
                  >
                    + Add First Staff Member
                  </button>

                  <button
                    type="button"
                    className="staff-btn staff-btn-secondary"
                    onClick={handleSeedStaff}
                  >
                    ⚡ Load Bakery Roster Starter Pack
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>No Staff Found</h3>
                <p>No team members match your current filter settings.</p>
                <button
                  type="button"
                  className="staff-btn staff-btn-secondary"
                  onClick={() => {
                    setSearchQuery("");
                    setRoleFilter("all");
                    setShiftFilter("all");
                    setStatusFilter("all");
                  }}
                >
                  Clear All Filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="staff-table-wrapper">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Member Name</th>
                  <th>Role</th>
                  <th>Shift Schedule</th>
                  <th>Status</th>
                  <th>Permissions</th>
                  <th>Contact Info</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((member, index) => {
                  const roleDef = STAFF_ROLES.find((r) => r.id === member.role);
                  const isActive = member.status === "Active";
                  const perms = Array.isArray(member.permissions) ? member.permissions : [];

                  return (
                    <tr key={member.id} className="staff-row">
                      <td className="staff-index-cell">#{index + 1}</td>
                      <td>
                        <div className="staff-name-group">
                          <strong>{member.full_name}</strong>
                          {member.notes && (
                            <span className="staff-bio-subtext">{member.notes}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className="staff-role-badge"
                          style={{
                            color: roleDef?.badgeColor || "#432719",
                            background: roleDef?.bgColor || "#fdf8f3",
                            borderColor: roleDef?.badgeColor || "#d8c5b5",
                          }}
                        >
                          {member.role}
                        </span>
                      </td>
                      <td className="staff-shift-cell">{member.shift}</td>
                      <td>
                        <button
                          type="button"
                          className={`staff-status-toggle-btn ${
                            isActive
                              ? "status-active"
                              : member.status === "On Leave"
                              ? "status-leave"
                              : "status-inactive"
                          }`}
                          onClick={() => handleToggleStatus(member)}
                          title="Click to toggle status"
                        >
                          <span className="staff-status-dot" />
                          {member.status || "Active"}
                        </button>
                      </td>
                      <td>
                        <div className="staff-perms-chips">
                          {perms.length === 0 ? (
                            <span className="staff-perm-chip empty">View Only</span>
                          ) : perms.length === PERMISSIONS_LIST.length ? (
                            <span className="staff-perm-chip admin">Full Access (All)</span>
                          ) : (
                            perms.map((p) => {
                              const pDef = PERMISSIONS_LIST.find((x) => x.id === p);
                              return (
                                <span key={p} className="staff-perm-chip">
                                  {pDef?.label || p}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>
                      <td className="staff-contact-cell">
                        {member.email && <div className="staff-contact-row">✉️ {member.email}</div>}
                        {member.phone && <div className="staff-contact-row">📞 {member.phone}</div>}
                      </td>
                      <td className="staff-actions-cell">
                        <button
                          type="button"
                          className="staff-action-btn staff-edit-btn"
                          onClick={() => handleEdit(member)}
                          title="Edit member details"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          className="staff-action-btn staff-delete-btn"
                          onClick={() => handleDelete(member.id)}
                          title="Remove from roster"
                        >
                          🗑️
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

export default Staff;
