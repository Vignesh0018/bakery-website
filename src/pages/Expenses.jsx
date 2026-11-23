import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  SAMPLE_EXPENSES,
  SUPABASE_SQL_HELPER,
  generateExpenseId,
  getTodayDateString,
} from "../constants/expenses";
import "../styles/Expenses.css";

const LOCAL_STORAGE_KEY = "golden_crust_expenses";

function Expenses() {
  const navigate = useNavigate();

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [isUsingLocalStorage, setIsUsingLocalStorage] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copiedSql, setCopiedSql] = useState(false);

  // Form State
  const emptyForm = {
    title: "",
    category: "Raw Ingredients",
    amount: "",
    expense_date: getTodayDateString(),
    payment_method: "UPI / GPay",
    vendor: "",
    notes: "",
  };

  const [form, setForm] = useState(emptyForm);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all"); // 'all' | 'this_month' | 'last_month' | 'this_year'
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date_desc");

  // Load local storage fallback
  const getLocalExpenses = () => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Could not read local expenses:", e);
    }
    return SAMPLE_EXPENSES;
  };

  // Save to local storage
  const saveLocalExpenses = (items) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Could not save to local storage:", e);
    }
  };

  // Fetch expenses from Supabase with fallback to localStorage
  const fetchExpenses = async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: fetchErr } = await supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false });

      if (fetchErr) {
        setIsUsingLocalStorage(true);
        const local = getLocalExpenses();
        setExpenses(local);
        saveLocalExpenses(local);
      } else {
        setIsUsingLocalStorage(false);
        setExpenses(data || []);
      }
    } catch {
      setIsUsingLocalStorage(true);
      const local = getLocalExpenses();
      setExpenses(local);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadData = async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from("expenses")
          .select("*")
          .order("expense_date", { ascending: false });

        if (!ignore) {
          if (fetchErr) {
            setIsUsingLocalStorage(true);
            const local = getLocalExpenses();
            setExpenses(local);
            saveLocalExpenses(local);
          } else {
            setIsUsingLocalStorage(false);
            setExpenses(data || []);
          }
        }
      } catch {
        if (!ignore) {
          setIsUsingLocalStorage(true);
          const local = getLocalExpenses();
          setExpenses(local);
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
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const cancelForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setIsFormOpen(false);
    setError("");
  };

  // Create or update expense
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    const parsedAmount = Number(form.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid expense amount greater than 0.");
      setSaving(false);
      return;
    }

    const payload = {
      title: form.title.trim(),
      category: form.category,
      amount: parsedAmount,
      expense_date: form.expense_date,
      payment_method: form.payment_method,
      vendor: form.vendor ? form.vendor.trim() : "",
      notes: form.notes ? form.notes.trim() : "",
    };

    try {
      if (isUsingLocalStorage) {
        if (editingId) {
          const updated = expenses.map((item) =>
            item.id === editingId ? { ...item, ...payload } : item
          );
          setExpenses(updated);
          saveLocalExpenses(updated);
          setSuccess("Expense updated successfully (saved locally)!");
        } else {
          const newItem = {
            ...payload,
            id: generateExpenseId(),
            created_at: new Date().toISOString(),
          };
          const updated = [newItem, ...expenses];
          setExpenses(updated);
          saveLocalExpenses(updated);
          setSuccess("Expense added successfully (saved locally)!");
        }
        cancelForm();
      } else {
        let result;
        if (editingId) {
          result = await supabase
            .from("expenses")
            .update(payload)
            .eq("id", editingId);
        } else {
          result = await supabase.from("expenses").insert([payload]);
        }

        if (result.error) throw result.error;

        setSuccess(
          editingId ? "Expense updated successfully!" : "Expense logged successfully!"
        );
        cancelForm();
        await fetchExpenses();
      }
    } catch (err) {
      if (err.code === "PGRST205" || err.code === "42501" || err.message?.includes("schema cache")) {
        setIsUsingLocalStorage(true);
        if (editingId) {
          const updated = expenses.map((item) =>
            item.id === editingId ? { ...item, ...payload } : item
          );
          setExpenses(updated);
          saveLocalExpenses(updated);
          setSuccess("Expense updated successfully (saved to browser storage)!");
        } else {
          const newItem = {
            ...payload,
            id: generateExpenseId(),
            created_at: new Date().toISOString(),
          };
          const updated = [newItem, ...expenses];
          setExpenses(updated);
          saveLocalExpenses(updated);
          setSuccess("Expense logged successfully (saved to browser storage)!");
        }
        cancelForm();
      } else {
        setError(err.message || "Failed to save expense record.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setForm({
      title: item.title,
      category: item.category,
      amount: item.amount,
      expense_date: item.expense_date,
      payment_method: item.payment_method || "UPI / GPay",
      vendor: item.vendor || "",
      notes: item.notes || "",
    });
    setEditingId(item.id);
    setIsFormOpen(true);
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    const item = expenses.find((x) => x.id === id);
    const confirmed = window.confirm(
      `Are you sure you want to delete the expense "${item?.title || "record"}" of ₹${item?.amount}?`
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      if (isUsingLocalStorage) {
        const updated = expenses.filter((x) => x.id !== id);
        setExpenses(updated);
        saveLocalExpenses(updated);
        setSuccess("Expense deleted successfully.");
        if (editingId === id) cancelForm();
      } else {
        const { error: delErr } = await supabase
          .from("expenses")
          .delete()
          .eq("id", id);

        if (delErr) throw delErr;

        setSuccess("Expense deleted successfully.");
        if (editingId === id) cancelForm();
        await fetchExpenses();
      }
    } catch (err) {
      if (err.code === "PGRST205" || err.code === "42501") {
        const updated = expenses.filter((x) => x.id !== id);
        setExpenses(updated);
        saveLocalExpenses(updated);
        setSuccess("Expense deleted successfully.");
      } else {
        setError(err.message || "Failed to delete expense.");
      }
    }
  };

  const handleSeedExpenses = async () => {
    const confirmed = window.confirm(
      "Load realistic bakery operating expenses (flour, dairy, packaging, electricity, wages, rent, equipment)?"
    );
    if (!confirmed) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!isUsingLocalStorage) {
        const toInsert = SAMPLE_EXPENSES.map(({ title, category, amount, expense_date, payment_method, vendor, notes }) => ({
          title,
          category,
          amount,
          expense_date,
          payment_method,
          vendor,
          notes,
        }));

        const { error: seedErr } = await supabase.from("expenses").insert(toInsert);
        if (seedErr) throw seedErr;
        setSuccess("Bakery sample expenses successfully loaded into database!");
        await fetchExpenses();
      } else {
        setExpenses(SAMPLE_EXPENSES);
        saveLocalExpenses(SAMPLE_EXPENSES);
        setSuccess("Bakery sample expenses loaded into browser storage!");
      }
    } catch {
      setIsUsingLocalStorage(true);
      setExpenses(SAMPLE_EXPENSES);
      saveLocalExpenses(SAMPLE_EXPENSES);
      setSuccess("Sample bakery expenses loaded in local storage!");
    } finally {
      setLoading(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_HELPER);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleExportCSV = () => {
    if (expenses.length === 0) {
      alert("No expenses to export.");
      return;
    }

    const headers = ["ID", "Date", "Title", "Category", "Amount (INR)", "Payment Method", "Vendor", "Notes"];
    const rows = filteredExpenses.map((exp) => [
      `"${exp.id}"`,
      `"${exp.expense_date}"`,
      `"${(exp.title || "").replace(/"/g, '""')}"`,
      `"${exp.category}"`,
      Number(exp.amount),
      `"${exp.payment_method || ""}"`,
      `"${(exp.vendor || "").replace(/"/g, '""')}"`,
      `"${(exp.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bakery-expenses-${getTodayDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered & Sorted Expenses
  const filteredExpenses = useMemo(() => {
    let list = [...expenses];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (x) =>
          x.title.toLowerCase().includes(q) ||
          (x.vendor && x.vendor.toLowerCase().includes(q)) ||
          (x.notes && x.notes.toLowerCase().includes(q)) ||
          (x.category && x.category.toLowerCase().includes(q))
      );
    }

    if (categoryFilter !== "all") {
      list = list.filter((x) => x.category === categoryFilter);
    }

    if (paymentFilter !== "all") {
      list = list.filter((x) => x.payment_method === paymentFilter);
    }

    if (periodFilter === "this_month") {
      list = list.filter((x) => {
        const d = new Date(x.expense_date);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      });
    } else if (periodFilter === "last_month") {
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      list = list.filter((x) => {
        const d = new Date(x.expense_date);
        return d.getFullYear() === lastMonthYear && d.getMonth() === lastMonth;
      });
    } else if (periodFilter === "this_year") {
      list = list.filter((x) => {
        const d = new Date(x.expense_date);
        return d.getFullYear() === currentYear;
      });
    }

    list.sort((a, b) => {
      if (sortBy === "date_desc") {
        return new Date(b.expense_date) - new Date(a.expense_date);
      }
      if (sortBy === "date_asc") {
        return new Date(a.expense_date) - new Date(b.expense_date);
      }
      if (sortBy === "amount_desc") {
        return Number(b.amount) - Number(a.amount);
      }
      if (sortBy === "amount_asc") {
        return Number(a.amount) - Number(b.amount);
      }
      if (sortBy === "title_asc") {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });

    return list;
  }, [expenses, searchQuery, categoryFilter, paymentFilter, periodFilter, sortBy]);

  // Statistics computation
  const stats = useMemo(() => {
    let totalAll = 0;
    let thisMonthTotal = 0;
    const catSums = {};
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth();

    expenses.forEach((item) => {
      const amt = Number(item.amount || 0);
      totalAll += amt;

      const d = new Date(item.expense_date);
      if (d.getFullYear() === currYear && d.getMonth() === currMonth) {
        thisMonthTotal += amt;
      }

      if (item.category) {
        catSums[item.category] = (catSums[item.category] || 0) + amt;
      }
    });

    let topCategory = "N/A";
    let topCatAmount = 0;
    Object.entries(catSums).forEach(([cat, sum]) => {
      if (sum > topCatAmount) {
        topCatAmount = sum;
        topCategory = cat;
      }
    });

    const averageExpense = expenses.length > 0 ? Math.round(totalAll / expenses.length) : 0;

    return {
      totalAll,
      thisMonthTotal,
      topCategory,
      topCatAmount,
      averageExpense,
      count: expenses.length,
    };
  }, [expenses]);

  return (
    <div className="expenses-page">
      {/* Top Header */}
      <div className="expenses-header">
        <div className="expenses-header-left">
          <div className="expenses-title-row">
            <h1>Bakery Expense Management</h1>
            <span className="expenses-badge">Financial Ops</span>
          </div>
          <p>
            Log ingredient purchases, packaging, utilities, staff wages, and operational costs.
          </p>
        </div>

        <div className="expenses-header-actions">
          <button
            type="button"
            className="expenses-btn expenses-btn-secondary"
            onClick={() => navigate("/admin/dashboard")}
          >
            ← Dashboard
          </button>

          <button
            type="button"
            className="expenses-btn expenses-btn-accent"
            onClick={() => navigate("/admin/profit-loss")}
            title="Open Profit & Loss Statement"
          >
            📈 View Profit & Loss →
          </button>

          <button
            type="button"
            className="expenses-btn expenses-btn-secondary"
            onClick={fetchExpenses}
            disabled={loading}
          >
            🔄 {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            className="expenses-btn expenses-btn-primary"
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
            {isFormOpen && !editingId ? "✕ Close Form" : "+ Log New Expense"}
          </button>
        </div>
      </div>

      {/* Storage Mode Notice */}
      {isUsingLocalStorage && (
        <div className="expenses-storage-banner">
          <div className="expenses-storage-info">
            <span className="expenses-storage-icon">💾</span>
            <div>
              <strong>Using Browser Storage:</strong> Your expenses are safely saved locally on this device.
              To sync automatically to Supabase Cloud, run the 1-minute table setup script.
            </div>
          </div>
          <div className="expenses-storage-actions">
            <button
              type="button"
              className="expenses-storage-btn"
              onClick={() => setIsSqlModalOpen(true)}
            >
              📋 View Supabase SQL Setup
            </button>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {success && (
        <div className="expenses-banner expenses-banner-success">
          <span>✓ {success}</span>
          <button
            type="button"
            className="expenses-banner-close"
            onClick={() => setSuccess("")}
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="expenses-banner expenses-banner-error">
          <span>⚠️ {error}</span>
          <button
            type="button"
            className="expenses-banner-close"
            onClick={() => setError("")}
          >
            ✕
          </button>
        </div>
      )}

      {/* SQL Setup Modal */}
      {isSqlModalOpen && (
        <div className="expenses-modal-overlay" onClick={() => setIsSqlModalOpen(false)}>
          <div className="expenses-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="expenses-modal-header">
              <h3>⚡ Connect Expenses to Supabase Cloud</h3>
              <button
                type="button"
                className="expenses-modal-close"
                onClick={() => setIsSqlModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <p className="expenses-modal-desc">
              Copy and execute this script once in your <strong>Supabase Dashboard → SQL Editor</strong> to create the <code>expenses</code> table and enable real-time cloud sync:
            </p>
            <pre className="expenses-sql-snippet">{SUPABASE_SQL_HELPER}</pre>
            <div className="expenses-modal-footer">
              <button
                type="button"
                className="expenses-btn expenses-btn-primary"
                onClick={handleCopySql}
              >
                {copiedSql ? "✓ Copied to Clipboard!" : "📋 Copy SQL Script"}
              </button>
              <button
                type="button"
                className="expenses-btn expenses-btn-secondary"
                onClick={() => setIsSqlModalOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Executive Metric / KPI Cards */}
      <div className="expenses-stats-grid">
        {/* Total Outflow */}
        <div className="expenses-stat-card">
          <div className="expenses-stat-header">
            <span className="expenses-stat-title">Total Expenses</span>
            <span className="expenses-stat-icon">💸</span>
          </div>
          <p className="expenses-stat-value" style={{ color: "#c62828" }}>
            ₹{stats.totalAll.toLocaleString("en-IN")}
          </p>
          <span className="expenses-stat-desc">
            Cumulative across {stats.count} recorded entries
          </span>
        </div>

        {/* Current Month */}
        <div
          className={`expenses-stat-card ${periodFilter === "this_month" ? "active-filter" : ""}`}
          onClick={() => setPeriodFilter((prev) => (prev === "this_month" ? "all" : "this_month"))}
          title="Click to filter by This Month"
        >
          <div className="expenses-stat-header">
            <span className="expenses-stat-title">This Month</span>
            <span className="expenses-stat-icon">📅</span>
          </div>
          <p className="expenses-stat-value" style={{ color: "#d84315" }}>
            ₹{stats.thisMonthTotal.toLocaleString("en-IN")}
          </p>
          <span className="expenses-stat-desc">Current month operating cash burn</span>
        </div>

        {/* Top Spending Category */}
        <div
          className="expenses-stat-card"
          onClick={() => {
            if (stats.topCategory !== "N/A") {
              setCategoryFilter(stats.topCategory);
            }
          }}
          title={stats.topCategory !== "N/A" ? `Filter by ${stats.topCategory}` : ""}
        >
          <div className="expenses-stat-header">
            <span className="expenses-stat-title">Top Cost Driver</span>
            <span className="expenses-stat-icon">🏆</span>
          </div>
          <p className="expenses-stat-value" style={{ fontSize: "22px", color: "#432719" }}>
            {stats.topCategory}
          </p>
          <span className="expenses-stat-desc">
            {stats.topCatAmount > 0 ? `₹${stats.topCatAmount.toLocaleString("en-IN")} total spent` : "No costs logged"}
          </span>
        </div>

        {/* Average Transaction */}
        <div className="expenses-stat-card">
          <div className="expenses-stat-header">
            <span className="expenses-stat-title">Average Cost</span>
            <span className="expenses-stat-icon">📊</span>
          </div>
          <p className="expenses-stat-value">
            ₹{stats.averageExpense.toLocaleString("en-IN")}
          </p>
          <span className="expenses-stat-desc">Average per receipt / voucher</span>
        </div>
      </div>

      {/* Add / Edit Expense Collapsible Section */}
      {isFormOpen && (
        <section className="expenses-section">
          <div className="expenses-section-header">
            <h2>{editingId ? "Edit Expense Entry" : "Log New Bakery Expense"}</h2>
            <button
              type="button"
              className="expenses-btn expenses-btn-secondary"
              onClick={cancelForm}
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="expenses-form">
            <div className="expenses-form-grid">
              {/* Expense Title */}
              <div className="expenses-field">
                <label htmlFor="exp-title">
                  Expense Description <span className="required">*</span>
                </label>
                <input
                  id="exp-title"
                  type="text"
                  name="title"
                  placeholder="e.g. 20 Bags All-Purpose Flour, Commercial Oven Power Bill"
                  value={form.title}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {/* Amount */}
              <div className="expenses-field">
                <label htmlFor="exp-amount">
                  Amount (₹) <span className="required">*</span>
                </label>
                <input
                  id="exp-amount"
                  type="number"
                  name="amount"
                  placeholder="e.g. 4500"
                  min="1"
                  step="0.01"
                  value={form.amount}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {/* Category */}
              <div className="expenses-field">
                <label htmlFor="exp-cat">
                  Category <span className="required">*</span>
                </label>
                <select
                  id="exp-cat"
                  name="category"
                  value={form.category}
                  onChange={handleInputChange}
                  required
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name} ({c.type})
                    </option>
                  ))}
                </select>
                <span className="expenses-field-hint">
                  Raw Ingredients & Packaging are classified as direct Cost of Goods Sold (COGS).
                </span>
              </div>

              {/* Date */}
              <div className="expenses-field">
                <label htmlFor="exp-date">
                  Expense Date <span className="required">*</span>
                </label>
                <input
                  id="exp-date"
                  type="date"
                  name="expense_date"
                  value={form.expense_date}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {/* Payment Method */}
              <div className="expenses-field">
                <label htmlFor="exp-method">Payment Method</label>
                <select
                  id="exp-method"
                  name="payment_method"
                  value={form.payment_method}
                  onChange={handleInputChange}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Vendor / Supplier */}
              <div className="expenses-field">
                <label htmlFor="exp-vendor">Vendor / Payee</label>
                <input
                  id="exp-vendor"
                  type="text"
                  name="vendor"
                  placeholder="e.g. Golden Grains Mill, City Power, Normandy Dairy"
                  value={form.vendor}
                  onChange={handleInputChange}
                />
              </div>

              {/* Notes */}
              <div className="expenses-field expenses-field-full">
                <label htmlFor="exp-notes">Notes / Voucher Details</label>
                <textarea
                  id="exp-notes"
                  name="notes"
                  placeholder="Invoice number, quantity details, batch references, or warranty notes..."
                  value={form.notes}
                  onChange={handleInputChange}
                  rows={3}
                />
              </div>
            </div>

            <div className="expenses-form-actions">
              <button
                type="submit"
                className="expenses-btn expenses-btn-primary"
                disabled={saving}
              >
                {saving
                  ? "Saving Entry..."
                  : editingId
                  ? "Update Expense"
                  : "Save Expense"}
              </button>

              <button
                type="button"
                className="expenses-btn expenses-btn-secondary"
                onClick={cancelForm}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Main Expenses Registry Section */}
      <section className="expenses-section">
        {/* Section Header with Product Counting */}
        <div className="expenses-registry-header">
          <div className="expenses-registry-title-wrap">
            <h2>Expense Records</h2>
            <span className="expenses-count-badge">
              {filteredExpenses.length} {filteredExpenses.length === 1 ? "Record" : "Records"}
            </span>
            {filteredExpenses.length !== expenses.length && (
              <span className="expenses-total-count-tag">
                of {expenses.length} total
              </span>
            )}
            <span className="expenses-sum-badge">
              Filtered Total: ₹{filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0).toLocaleString("en-IN")}
            </span>
          </div>

          <div className="expenses-registry-quick-actions">
            <button
              type="button"
              className="expenses-btn expenses-btn-secondary"
              onClick={handleExportCSV}
              title="Download CSV spreadsheet of current expenses"
            >
              📥 Export CSV
            </button>
          </div>
        </div>

        {/* Controls & Filters Bar */}
        <div className="expenses-controls-bar">
          {/* Search Box */}
          <div className="expenses-search-box">
            <input
              type="text"
              className="expenses-search-input"
              placeholder="🔍 Search expense, vendor, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="expenses-search-clear"
                onClick={() => setSearchQuery("")}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filters Group */}
          <div className="expenses-filters-group">
            {/* Period Pills */}
            <div className="expenses-period-pills">
              <button
                type="button"
                className={`expenses-pill ${periodFilter === "all" ? "active" : ""}`}
                onClick={() => setPeriodFilter("all")}
              >
                All Time
              </button>
              <button
                type="button"
                className={`expenses-pill ${periodFilter === "this_month" ? "active" : ""}`}
                onClick={() => setPeriodFilter("this_month")}
              >
                This Month
              </button>
              <button
                type="button"
                className={`expenses-pill ${periodFilter === "last_month" ? "active" : ""}`}
                onClick={() => setPeriodFilter("last_month")}
              >
                Last Month
              </button>
              <button
                type="button"
                className={`expenses-pill ${periodFilter === "this_year" ? "active" : ""}`}
                onClick={() => setPeriodFilter("this_year")}
              >
                This Year
              </button>
            </div>

            {/* Category Filter */}
            <select
              className="expenses-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories ({expenses.length})</option>
              {EXPENSE_CATEGORIES.map((c) => {
                const count = expenses.filter((x) => x.category === c.name).length;
                return (
                  <option key={c.id} value={c.name}>
                    {c.icon} {c.name} ({count})
                  </option>
                );
              })}
            </select>

            {/* Payment Method Filter */}
            <select
              className="expenses-select"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
            >
              <option value="all">All Payment Methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            {/* Sort Dropdown */}
            <select
              className="expenses-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="date_desc">Sort: Date (Newest first)</option>
              <option value="date_asc">Sort: Date (Oldest first)</option>
              <option value="amount_desc">Sort: Amount (High to Low)</option>
              <option value="amount_asc">Sort: Amount (Low to High)</option>
              <option value="title_asc">Sort: Title (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Expenses List / Table */}
        {loading ? (
          <div className="expenses-empty-state">
            <div className="expenses-empty-icon">⏳</div>
            <h3>Loading Bakery Expenses...</h3>
            <p>Fetching ledger receipts and supplier records.</p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="expenses-empty-state">
            <div className="expenses-empty-icon">🧾</div>
            {expenses.length === 0 ? (
              <>
                <h3>No Expenses Logged Yet</h3>
                <p>
                  Start tracking raw flour, dairy, packaging, bakery utilities, and kitchen wages to measure your net profitability.
                </p>
                <div className="expenses-empty-actions">
                  <button
                    type="button"
                    className="expenses-btn expenses-btn-primary"
                    onClick={() => {
                      setForm(emptyForm);
                      setEditingId(null);
                      setIsFormOpen(true);
                    }}
                  >
                    + Log First Expense
                  </button>

                  <button
                    type="button"
                    className="expenses-btn expenses-btn-secondary"
                    onClick={handleSeedExpenses}
                  >
                    ⚡ Load Starter Bakery Expenses
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>No Expenses Found</h3>
                <p>No expense vouchers match your selected search and filters.</p>
                <button
                  type="button"
                  className="expenses-btn expenses-btn-secondary"
                  onClick={() => {
                    setSearchQuery("");
                    setCategoryFilter("all");
                    setPeriodFilter("all");
                    setPaymentFilter("all");
                  }}
                >
                  Clear All Filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="expenses-table-wrapper">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Expense Description</th>
                  <th>Category</th>
                  <th>Vendor / Payee</th>
                  <th>Payment Method</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((item, index) => {
                  const catDef = EXPENSE_CATEGORIES.find((c) => c.name === item.category);
                  const isCogs = catDef?.type === "COGS";

                  return (
                    <tr key={item.id} className="expenses-row">
                      <td className="expenses-index-cell">#{index + 1}</td>
                      <td className="expenses-date-cell">
                        <span className="expenses-date-text">{item.expense_date}</span>
                      </td>
                      <td className="expenses-title-cell">
                        <div className="expenses-title-wrapper">
                          <strong>{item.title}</strong>
                          {item.notes && (
                            <span className="expenses-notes-text">{item.notes}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`expenses-cat-tag ${isCogs ? "cogs" : "opex"}`}>
                          <span className="expenses-cat-icon">{catDef?.icon || "🏷️"}</span>
                          {item.category}
                        </span>
                      </td>
                      <td className="expenses-vendor-cell">
                        {item.vendor ? item.vendor : <span style={{ color: "#aaa" }}>—</span>}
                      </td>
                      <td>
                        <span className="expenses-method-pill">
                          {item.payment_method || "UPI"}
                        </span>
                      </td>
                      <td className="expenses-amount-cell">
                        ₹{Number(item.amount).toLocaleString("en-IN")}
                      </td>
                      <td className="expenses-actions-cell">
                        <button
                          type="button"
                          className="expenses-action-btn expenses-edit-btn"
                          onClick={() => handleEdit(item)}
                          title="Edit this expense"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          className="expenses-action-btn expenses-delete-btn"
                          onClick={() => handleDelete(item.id)}
                          title="Delete this expense"
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

export default Expenses;
