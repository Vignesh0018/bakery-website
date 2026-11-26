import { useState, useEffect, useMemo } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PAYMENT_CATEGORIES,
  generateTransactionId,
  formatINR,
  getTodayDateString,
} from "../constants/payments";
import "../styles/Payments.css";

const BILLS_HISTORY_STORAGE_KEY = "golden_crust_billing_history";
const PAYMENTS_STORAGE_KEY = "golden_crust_payments_ledger";
const CASH_DRAWER_STORAGE_KEY = "golden_crust_cash_drawer_shifts";

function Payments() {
  const navigate = useNavigate();
  const outletCtx = useOutletContext() || {};
  const adminEmail = outletCtx.adminEmail || "Bakery Admin";

  // Data states
  const [posBills, setPosBills] = useState([]);
  const [cloudOrders, setCloudOrders] = useState([]);
  const [manualPayments, setManualPayments] = useState([]);
  const [cashShifts, setCashShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Notifications
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Tab & Filters
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'cash' | 'upi' | 'pending' | 'refunds'
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all"); // 'today' | 'yesterday' | 'this_week' | 'this_month' | 'all'
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [countedCash, setCountedCash] = useState("");
  const [openingFloat, setOpeningFloat] = useState("2000");
  const [shiftNotes, setShiftNotes] = useState("");

  // Record Form state
  const initialForm = {
    customerName: "",
    customerPhone: "",
    amount: "",
    paymentMethod: "UPI / QR",
    paymentStatus: "Paid",
    category: "Custom Cake Order",
    referenceId: "",
    notes: "",
  };
  const [form, setForm] = useState(initialForm);

  // Load local manual payments
  const getLocalPayments = () => {
    try {
      const stored = localStorage.getItem(PAYMENTS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn("Could not load local payments:", e);
    }
    return [];
  };

  // Save local manual payments
  const saveLocalPayments = (items) => {
    try {
      localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Could not save local payments:", e);
    }
  };

  // Load POS bills history
  const getLocalBills = () => {
    try {
      const stored = localStorage.getItem(BILLS_HISTORY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn("Could not load POS bills:", e);
    }
    return [];
  };

  // Save POS bills history
  const saveLocalBills = (items) => {
    try {
      localStorage.setItem(BILLS_HISTORY_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Could not save POS bills:", e);
    }
  };

  // Load Cash drawer shifts
  const getLocalShifts = () => {
    try {
      const stored = localStorage.getItem(CASH_DRAWER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn("Could not load cash shifts:", e);
    }
    return [];
  };

  // Fetch all payment sources
  const fetchData = async () => {
    setLoading(true);
    setError("");

    try {
      // 1. Local POS bills
      const bills = getLocalBills();
      setPosBills(bills);

      // 2. Local manual payments
      const manual = getLocalPayments();
      setManualPayments(manual);

      // 3. Cash shifts
      const shifts = getLocalShifts();
      setCashShifts(shifts);

      // 4. Supabase Cloud orders
      const { data, error: fetchErr } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchErr) {
        console.warn("Could not fetch Supabase orders, using local:", fetchErr.message);
      } else {
        setCloudOrders(data || []);
      }
    } catch (err) {
      console.error("Error loading payment data:", err);
      setError("Failed to load full payment transactions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      try {
        const bills = getLocalBills();
        const manual = getLocalPayments();
        const shifts = getLocalShifts();

        if (!ignore) {
          setPosBills(bills);
          setManualPayments(manual);
          setCashShifts(shifts);
        }

        const { data, error: fetchErr } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false });

        if (!ignore) {
          if (!fetchErr && data) {
            setCloudOrders(data);
          }
        }
      } catch (err) {
        if (!ignore) {
          console.warn("Orders fetch fallback:", err);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    load();

    return () => {
      ignore = true;
    };
  }, []);

  // Merge all sources into a unified payment transactions list
  const unifiedTransactions = useMemo(() => {
    const list = [];

    // 1. Counter POS Bills
    posBills.forEach((bill) => {
      list.push({
        id: bill.invoiceNumber || `BILL-${bill.orderId}`,
        source: "Counter POS",
        sourceIcon: "🧾",
        date: bill.createdAt || new Date().toISOString(),
        customerName: bill.customerName || "Walk-in Guest",
        customerPhone: bill.customerPhone || "N/A",
        amount: Number(bill.totalAmount || 0),
        tendered: Number(bill.tenderedAmount || bill.totalAmount || 0),
        changeDue: Number(bill.changeDue || 0),
        paymentMethod: bill.paymentMethod || "Cash",
        paymentStatus: bill.paymentStatus || "Paid",
        category: "Counter Sale (POS Bill)",
        referenceId: bill.invoiceNumber,
        notes: bill.orderNotes || `Items: ${bill.items?.length || 0} bakery products`,
        rawBill: bill,
      });
    });

    // 2. Custom Cake & Online Orders (Filter out counter bills already captured)
    cloudOrders.forEach((order) => {
      const isPosOrder = order.notes?.includes("POS Bill:");
      if (!isPosOrder) {
        // Derive payment status: default to "Pending" unless explicitly marked "Paid"
        const status = order.payment_status || (order.order_status === "Delivered" ? "Paid" : "Pending");
        list.push({
          id: `ORD-#${order.id}`,
          source: "Custom Cake / Online",
          sourceIcon: "🎂",
          date: order.created_at || new Date().toISOString(),
          customerName: order.customer_name || "Guest Customer",
          customerPhone: order.phone || "N/A",
          amount: Number(order.total_amount || 0),
          tendered: Number(order.total_amount || 0),
          changeDue: 0,
          paymentMethod: order.payment_method || "WhatsApp / Direct Confirmation",
          paymentStatus: status,
          category: "Custom Cake Order",
          referenceId: `ORD-${order.id}`,
          notes: order.notes || "Online / WhatsApp custom order",
          rawOrder: order,
        });
      }
    });

    // 3. Manual Direct Payments / Advances
    manualPayments.forEach((p) => {
      list.push({
        id: p.id,
        source: "Manual Entry",
        sourceIcon: "📝",
        date: p.date,
        customerName: p.customerName,
        customerPhone: p.customerPhone,
        amount: Number(p.amount || 0),
        tendered: Number(p.amount || 0),
        changeDue: 0,
        paymentMethod: p.paymentMethod,
        paymentStatus: p.paymentStatus,
        category: p.category,
        referenceId: p.referenceId || p.id,
        notes: p.notes,
        rawManual: p,
      });
    });

    // Sort newest first
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [posBills, cloudOrders, manualPayments]);

  // Date filtering logic
  const dateFilteredTransactions = useMemo(() => {
    if (dateFilter === "all") return unifiedTransactions;

    const now = new Date();
    const todayStr = getTodayDateString();

    return unifiedTransactions.filter((tx) => {
      const txDate = new Date(tx.date);
      const txDateStr = tx.date?.slice(0, 10);

      if (dateFilter === "today") {
        return txDateStr === todayStr;
      }
      if (dateFilter === "yesterday") {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        const yStr = y.toISOString().slice(0, 10);
        return txDateStr === yStr;
      }
      if (dateFilter === "this_week") {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return txDate >= weekAgo;
      }
      if (dateFilter === "this_month") {
        return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [unifiedTransactions, dateFilter]);

  // Secondary tab & search filtering
  const filteredTransactions = useMemo(() => {
    return dateFilteredTransactions.filter((tx) => {
      // Tab filter
      if (activeTab === "cash" && tx.paymentMethod !== "Cash") return false;
      if (activeTab === "upi" && !tx.paymentMethod.toLowerCase().includes("upi")) return false;
      if (activeTab === "pending" && tx.paymentStatus !== "Pending" && tx.paymentStatus !== "Partial") return false;
      if (activeTab === "refunds" && tx.paymentStatus !== "Refunded") return false;

      // Method dropdown filter
      if (methodFilter !== "all" && tx.paymentMethod !== methodFilter) return false;

      // Status dropdown filter
      if (statusFilter !== "all" && tx.paymentStatus !== statusFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = tx.customerName.toLowerCase().includes(q);
        const matchPhone = tx.customerPhone.toLowerCase().includes(q);
        const matchId = tx.id.toLowerCase().includes(q);
        const matchRef = (tx.referenceId || "").toLowerCase().includes(q);
        const matchNotes = (tx.notes || "").toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchId && !matchRef && !matchNotes) return false;
      }

      return true;
    });
  }, [dateFilteredTransactions, activeTab, methodFilter, statusFilter, searchQuery]);

  // Key KPI Aggregations
  const stats = useMemo(() => {
    let totalCollected = 0;
    let cashCollected = 0;
    let upiCollected = 0;
    let cardCollected = 0;
    let pendingAmount = 0;
    let refundedAmount = 0;

    dateFilteredTransactions.forEach((tx) => {
      if (tx.paymentStatus === "Paid") {
        totalCollected += tx.amount;
        if (tx.paymentMethod === "Cash") cashCollected += tx.amount;
        else if (tx.paymentMethod.toLowerCase().includes("upi")) upiCollected += tx.amount;
        else if (tx.paymentMethod === "Card") cardCollected += tx.amount;
      } else if (tx.paymentStatus === "Pending" || tx.paymentStatus === "Partial") {
        pendingAmount += tx.amount;
      } else if (tx.paymentStatus === "Refunded") {
        refundedAmount += tx.amount;
      }
    });

    return {
      totalCollected,
      cashCollected,
      upiCollected,
      cardCollected,
      pendingAmount,
      refundedAmount,
      countPaid: dateFilteredTransactions.filter((t) => t.paymentStatus === "Paid").length,
      countPending: dateFilteredTransactions.filter((t) => t.paymentStatus === "Pending" || t.paymentStatus === "Partial").length,
    };
  }, [dateFilteredTransactions]);

  // Cash Drawer Till Aggregations (Today's Shift)
  const todayCashSales = useMemo(() => {
    const todayStr = getTodayDateString();
    return unifiedTransactions
      .filter((tx) => tx.date?.slice(0, 10) === todayStr && tx.paymentMethod === "Cash" && tx.paymentStatus === "Paid")
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [unifiedTransactions]);

  const floatNum = Number(openingFloat) || 0;
  const expectedClosingCash = floatNum + todayCashSales;
  const countedNum = countedCash ? Number(countedCash) : null;
  const variance = countedNum !== null ? countedNum - expectedClosingCash : 0;

  // Record a new payment
  const handleRecordPayment = (e) => {
    e.preventDefault();
    if (!form.customerName.trim()) {
      setError("Please provide customer name.");
      return;
    }
    const numericAmount = Number(form.amount);
    if (!numericAmount || numericAmount <= 0) {
      setError("Please enter a valid amount in ₹.");
      return;
    }

    const newPayment = {
      id: generateTransactionId(),
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim() || "N/A",
      amount: numericAmount,
      paymentMethod: form.paymentMethod,
      paymentStatus: form.paymentStatus,
      category: form.category,
      referenceId: form.referenceId.trim() || `REF-${Date.now().toString(36).toUpperCase()}`,
      notes: form.notes.trim() || `Recorded by ${adminEmail}`,
      date: new Date().toISOString(),
      cashier: adminEmail,
    };

    const updated = [newPayment, ...manualPayments];
    setManualPayments(updated);
    saveLocalPayments(updated);

    setIsRecordModalOpen(false);
    setForm(initialForm);
    setSuccess(`Payment of ${formatINR(numericAmount)} successfully recorded!`);
    setTimeout(() => setSuccess(""), 4000);
  };

  // Quick Action: Update payment status (e.g. Mark Paid / Refund)
  const handleUpdateStatus = async (tx, newStatus) => {
    try {
      if (tx.rawBill) {
        // Update in POS bills history
        const updatedBills = posBills.map((b) =>
          b.invoiceNumber === tx.rawBill.invoiceNumber ? { ...b, paymentStatus: newStatus } : b
        );
        setPosBills(updatedBills);
        saveLocalBills(updatedBills);
      } else if (tx.rawOrder) {
        // Update Supabase order status
        const { error: updErr } = await supabase
          .from("orders")
          .update({ payment_status: newStatus })
          .eq("id", tx.rawOrder.id);

        if (updErr) {
          console.warn("Could not update Supabase order, updating in local view:", updErr.message);
        }

        setCloudOrders((prev) =>
          prev.map((o) => (o.id === tx.rawOrder.id ? { ...o, payment_status: newStatus } : o))
        );
      } else if (tx.rawManual) {
        // Update in manual payments
        const updatedManual = manualPayments.map((p) =>
          p.id === tx.rawManual.id ? { ...p, paymentStatus: newStatus } : p
        );
        setManualPayments(updatedManual);
        saveLocalPayments(updatedManual);
      }

      setSuccess(`Transaction ${tx.id} marked as ${newStatus}.`);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      console.error("Status update error:", err);
      setError("Failed to update payment status.");
    }
  };

  // Save cash shift closing record
  const handleSaveShiftClosure = () => {
    if (countedNum === null) {
      setError("Please count and enter physical cash in drawer.");
      return;
    }

    const shiftRecord = {
      id: `SHIFT-${Date.now().toString(36).toUpperCase()}`,
      date: new Date().toISOString(),
      cashier: adminEmail,
      openingFloat: floatNum,
      cashSales: todayCashSales,
      expectedCash: expectedClosingCash,
      actualCash: countedNum,
      variance: variance,
      notes: shiftNotes.trim(),
    };

    const updated = [shiftRecord, ...cashShifts];
    setCashShifts(updated);
    try {
      localStorage.setItem(CASH_DRAWER_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("Could not save shift closing:", e);
    }

    setSuccess(`Cash drawer shift reconciled and closed. Variance: ${variance >= 0 ? `+${formatINR(variance)}` : `-${formatINR(Math.abs(variance))}`}`);
    setCountedCash("");
    setShiftNotes("");
    setTimeout(() => setSuccess(""), 5000);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      setError("No transaction records to export.");
      return;
    }

    const headers = [
      "Transaction ID",
      "Date",
      "Customer Name",
      "Phone",
      "Source",
      "Category",
      "Payment Method",
      "Amount (INR)",
      "Status",
      "Reference ID",
      "Notes",
    ];

    const rows = filteredTransactions.map((tx) => [
      `"${tx.id}"`,
      `"${tx.date}"`,
      `"${(tx.customerName || "").replace(/"/g, '""')}"`,
      `"${tx.customerPhone || ""}"`,
      `"${tx.source}"`,
      `"${tx.category}"`,
      `"${tx.paymentMethod}"`,
      tx.amount,
      `"${tx.paymentStatus}"`,
      `"${tx.referenceId || ""}"`,
      `"${(tx.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `TheGoldenCrust_Payments_${getTodayDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="payments-page">
      {/* Page Header */}
      <div className="payments-header">
        <div>
          <div className="payments-header-brand">
            <span className="payments-header-badge">Financial Operations · Real-Time Ledger</span>
          </div>
          <h1 className="payments-title">Bakery Payment Tracking & Drawer</h1>
          <p className="payments-subtitle">
            Live reconciliation of counter bills, UPI collections, card transactions, and customer credit dues.
          </p>
        </div>

        <div className="payments-header-actions">
          <button
            type="button"
            className="payments-btn payments-btn-secondary"
            onClick={fetchData}
            title="Reload latest payments"
          >
            🔄 Sync Data
          </button>
          <button
            type="button"
            className="payments-btn payments-btn-secondary"
            onClick={handleExportCSV}
            title="Download CSV report"
          >
            📥 Export CSV
          </button>
          <button
            type="button"
            className="payments-btn payments-btn-primary"
            onClick={() => setIsRecordModalOpen(true)}
          >
            + Record Payment
          </button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="payments-banner payments-banner-success">
          <span>✓ {success}</span>
          <button type="button" className="payments-banner-close" onClick={() => setSuccess("")}>
            ✕
          </button>
        </div>
      )}
      {error && (
        <div className="payments-banner payments-banner-error">
          <span>⚠️ {error}</span>
          <button type="button" className="payments-banner-close" onClick={() => setError("")}>
            ✕
          </button>
        </div>
      )}

      {/* Key Metric KPI Cards */}
      <div className="payments-kpi-grid">
        {/* Total Collected */}
        <div className="payments-kpi-card">
          <div className="payments-kpi-header">
            <span className="payments-kpi-title">Total Collected</span>
            <span className="payments-kpi-icon">💰</span>
          </div>
          <p className="payments-kpi-value" style={{ color: "#2e7d32" }}>
            {formatINR(stats.totalCollected)}
          </p>
          <span className="payments-kpi-desc">{stats.countPaid} paid transactions settled</span>
        </div>

        {/* Cash in Drawer */}
        <div className="payments-kpi-card">
          <div className="payments-kpi-header">
            <span className="payments-kpi-title">Cash in Till</span>
            <span className="payments-kpi-icon">💵</span>
          </div>
          <p className="payments-kpi-value">{formatINR(stats.cashCollected)}</p>
          <span className="payments-kpi-desc">Physical counter register collection</span>
        </div>

        {/* UPI & Digital QR */}
        <div className="payments-kpi-card">
          <div className="payments-kpi-header">
            <span className="payments-kpi-title">UPI & Digital</span>
            <span className="payments-kpi-icon">📱</span>
          </div>
          <p className="payments-kpi-value" style={{ color: "#1565c0" }}>
            {formatINR(stats.upiCollected)}
          </p>
          <span className="payments-kpi-desc">Google Pay, PhonePe & QR codes</span>
        </div>

        {/* Card Swipes */}
        <div className="payments-kpi-card">
          <div className="payments-kpi-header">
            <span className="payments-kpi-title">Card Swipes</span>
            <span className="payments-kpi-icon">💳</span>
          </div>
          <p className="payments-kpi-value" style={{ color: "#6a1b9a" }}>
            {formatINR(stats.cardCollected)}
          </p>
          <span className="payments-kpi-desc">POS machine debit & credit</span>
        </div>

        {/* Pending Receivables */}
        <div className="payments-kpi-card">
          <div className="payments-kpi-header">
            <span className="payments-kpi-title">Pending Dues</span>
            <span className="payments-kpi-icon">⏳</span>
          </div>
          <p className="payments-kpi-value" style={{ color: "#e65100" }}>
            {formatINR(stats.pendingAmount)}
          </p>
          <span className="payments-kpi-desc">{stats.countPending} unpaid / advance balance</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="payments-tabs-row">
        <button
          type="button"
          className={`payments-tab-btn ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          💳 All Transactions <span className="payments-tab-badge">{unifiedTransactions.length}</span>
        </button>
        <button
          type="button"
          className={`payments-tab-btn ${activeTab === "cash" ? "active" : ""}`}
          onClick={() => setActiveTab("cash")}
        >
          💵 Cash Drawer & Register
        </button>
        <button
          type="button"
          className={`payments-tab-btn ${activeTab === "upi" ? "active" : ""}`}
          onClick={() => setActiveTab("upi")}
        >
          📱 UPI & QR Collections
        </button>
        <button
          type="button"
          className={`payments-tab-btn ${activeTab === "pending" ? "active" : ""}`}
          onClick={() => setActiveTab("pending")}
        >
          ⏳ Pending Receivables / Khata <span className="payments-tab-badge">{stats.countPending}</span>
        </button>
        <button
          type="button"
          className={`payments-tab-btn ${activeTab === "refunds" ? "active" : ""}`}
          onClick={() => setActiveTab("refunds")}
        >
          🔄 Refunds & Adjustments
        </button>
      </div>

      {/* Cash Drawer Reconciliation Tab View */}
      {activeTab === "cash" && (
        <div className="payments-till-card">
          <div className="payments-till-header">
            <div>
              <h3 className="payments-till-title">💵 Cash Drawer Shift & Till Reconciliation</h3>
              <p style={{ margin: "4px 0 0 0", color: "#8c7365", fontSize: "14px" }}>
                Verify physical cash in your counter till against recorded cash sales for today.
              </p>
            </div>
            <button
              type="button"
              className="payments-btn payments-btn-accent"
              onClick={handleSaveShiftClosure}
            >
              🔒 Close & Log Cash Shift
            </button>
          </div>

          <div className="payments-till-grid">
            <div className="payments-till-box">
              <span className="payments-till-box-label">Opening Cash Float</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px", fontWeight: "bold" }}>₹</span>
                <input
                  type="number"
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  className="payments-form-input"
                  style={{ width: "120px", fontWeight: 700 }}
                  placeholder="2000"
                />
              </div>
            </div>

            <div className="payments-till-box">
              <span className="payments-till-box-label">Today's Cash Sales</span>
              <p className="payments-till-box-value" style={{ color: "#2e7d32" }}>
                {formatINR(todayCashSales)}
              </p>
            </div>

            <div className="payments-till-box">
              <span className="payments-till-box-label">Expected Drawer Cash</span>
              <p className="payments-till-box-value">{formatINR(expectedClosingCash)}</p>
            </div>

            <div className="payments-till-box" style={{ background: variance === 0 ? "#e8f5e9" : variance < 0 ? "#ffebee" : "#e3f2fd" }}>
              <span className="payments-till-box-label">Cash Variance</span>
              <p className="payments-till-box-value" style={{ color: variance === 0 ? "#2e7d32" : variance < 0 ? "#c62828" : "#1565c0" }}>
                {countedNum === null ? "—" : variance === 0 ? "✓ Balanced" : variance < 0 ? `-${formatINR(Math.abs(variance))} Short` : `+${formatINR(variance)} Over`}
              </p>
            </div>
          </div>

          <div className="payments-till-reconcile-wrap">
            <div>
              <strong style={{ display: "block", color: "#543310", fontSize: "15px", marginBottom: "4px" }}>
                Physical Count of Cash in Hand
              </strong>
              <span style={{ fontSize: "13px", color: "#8c7365" }}>
                Count 500s, 200s, 100s, and coins in the till at shift change or day end.
              </span>
            </div>

            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <input
                type="number"
                placeholder="Counted Cash (₹)"
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                className="payments-till-count-input"
              />
              <input
                type="text"
                placeholder="Optional Shift Notes / Cashier"
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                className="payments-form-input"
                style={{ width: "240px" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Filter Card */}
      <div className="payments-filter-card">
        <div className="payments-filter-row">
          {/* Search */}
          <div className="payments-search-wrap">
            <span className="payments-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by transaction ID, bill #, customer name, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="payments-search-input"
            />
          </div>

          {/* Payment Method Filter */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="payments-select"
          >
            <option value="all">All Payment Methods</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.icon} {m.label}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="payments-select"
          >
            <option value="all">All Statuses</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.icon} {s.label}
              </option>
            ))}
          </select>

          {/* Date Range Pills */}
          <div className="payments-date-pills">
            {[
              { id: "all", label: "All Time" },
              { id: "today", label: "Today" },
              { id: "yesterday", label: "Yesterday" },
              { id: "this_week", label: "This Week" },
              { id: "this_month", label: "This Month" },
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                className={`payments-date-pill ${dateFilter === d.id ? "active" : ""}`}
                onClick={() => setDateFilter(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions Ledger Table */}
      <div className="payments-table-container">
        <div className="payments-table-header">
          <h2 className="payments-table-title">
            Payment Transaction Ledger
          </h2>
          <span className="payments-table-count">
            Showing {filteredTransactions.length} of {unifiedTransactions.length} records
          </span>
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#8c7365" }}>
            ⏳ Loading payment transactions...
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="payments-empty-state">
            <span className="payments-empty-icon">🧾</span>
            <h3 className="payments-empty-title">No Payment Records Found</h3>
            <p className="payments-empty-desc">
              {unifiedTransactions.length === 0
                ? "No payments logged yet. Complete a counter sale in Billing or record a new customer payment above."
                : "No transactions match your current search and filter criteria."}
            </p>
            {unifiedTransactions.length === 0 && (
              <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                <button
                  type="button"
                  className="payments-btn payments-btn-primary"
                  onClick={() => setIsRecordModalOpen(true)}
                >
                  + Record First Payment
                </button>
                <button
                  type="button"
                  className="payments-btn payments-btn-secondary"
                  onClick={() => navigate("/admin/billing")}
                >
                  Go to Billing & POS →
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="payments-table-scroll">
            <table className="payments-table">
              <thead>
                <tr>
                  <th>Receipt / ID</th>
                  <th>Date & Time</th>
                  <th>Customer</th>
                  <th>Source</th>
                  <th>Method</th>
                  <th>Amount (₹)</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => {
                  const methodClass = tx.paymentMethod.toLowerCase().includes("cash")
                    ? "cash"
                    : tx.paymentMethod.toLowerCase().includes("upi")
                    ? "upi"
                    : tx.paymentMethod.toLowerCase().includes("card")
                    ? "card"
                    : "bank";

                  const statusClass = (tx.paymentStatus || "paid").toLowerCase();

                  return (
                    <tr key={tx.id}>
                      <td>
                        <span className="payments-ref-tag">{tx.id}</span>
                        {tx.referenceId && tx.referenceId !== tx.id && (
                          <div style={{ fontSize: "11px", color: "#8c7365", marginTop: "2px" }}>
                            Ref: {tx.referenceId}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {new Date(tx.date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                        <div style={{ fontSize: "12px", color: "#8c7365" }}>
                          {new Date(tx.date).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                      <td>
                        <div className="payments-cust-name">{tx.customerName}</div>
                        <span className="payments-cust-phone">{tx.customerPhone}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: "13px", color: "#543310" }}>
                          {tx.sourceIcon} {tx.source}
                        </span>
                      </td>
                      <td>
                        <span className={`payments-method-badge ${methodClass}`}>
                          {tx.paymentMethod === "Cash" && "💵"}
                          {tx.paymentMethod.includes("UPI") && "📱"}
                          {tx.paymentMethod === "Card" && "💳"}
                          {tx.paymentMethod === "Bank Transfer" && "🏦"}
                          {" "}{tx.paymentMethod}
                        </span>
                      </td>
                      <td style={{ fontWeight: 800, fontSize: "15px", color: tx.paymentStatus === "Refunded" ? "#c62828" : "#2e7d32" }}>
                        {formatINR(tx.amount)}
                      </td>
                      <td>
                        <span className={`payments-status-pill ${statusClass}`}>
                          {tx.paymentStatus === "Paid" && "✓"}
                          {tx.paymentStatus === "Pending" && "⏳"}
                          {tx.paymentStatus === "Partial" && "⚠️"}
                          {tx.paymentStatus === "Refunded" && "🔄"}
                          {" "}{tx.paymentStatus}
                        </span>
                      </td>
                      <td>
                        <div className="payments-row-actions">
                          {/* Settle / Mark Paid Button for pending dues */}
                          {(tx.paymentStatus === "Pending" || tx.paymentStatus === "Partial") && (
                            <button
                              type="button"
                              className="payments-action-icon-btn mark-paid"
                              onClick={() => handleUpdateStatus(tx, "Paid")}
                              title="Mark full payment as received"
                            >
                              ✓ Settle
                            </button>
                          )}

                          {/* View Receipt */}
                          <button
                            type="button"
                            className="payments-action-icon-btn"
                            onClick={() => setActiveReceipt(tx)}
                            title="View / Print Receipt Slip"
                          >
                            📄 Slip
                          </button>

                          {/* Quick WhatsApp Reminder */}
                          {tx.customerPhone && tx.customerPhone !== "N/A" && (
                            <a
                              href={`https://wa.me/91${tx.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                                `Hello ${tx.customerName}! Thank you for choosing The Golden Crust Bakery. Regarding transaction ${tx.id} of ${formatINR(tx.amount)} (${tx.paymentStatus}).`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="payments-action-icon-btn"
                              title="WhatsApp confirmation"
                              style={{ color: "#2e7d32" }}
                            >
                              💬
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Record New Payment */}
      {isRecordModalOpen && (
        <div className="payments-modal-overlay" onClick={() => setIsRecordModalOpen(false)}>
          <div className="payments-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="payments-modal-header">
              <h3>+ Record New Customer Payment</h3>
              <button
                type="button"
                className="payments-modal-close"
                onClick={() => setIsRecordModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div className="payments-modal-body">
                <div className="payments-form-row">
                  <div className="payments-form-group">
                    <label>Customer Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={form.customerName}
                      onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                      className="payments-form-input"
                    />
                  </div>
                  <div className="payments-form-group">
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={form.customerPhone}
                      onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                      className="payments-form-input"
                    />
                  </div>
                </div>

                <div className="payments-form-row">
                  <div className="payments-form-group">
                    <label>Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      placeholder="e.g. 1500"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      className="payments-form-input"
                    />
                  </div>
                  <div className="payments-form-group">
                    <label>Payment Method</label>
                    <select
                      value={form.paymentMethod}
                      onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                      className="payments-form-input"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.icon} {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="payments-form-row">
                  <div className="payments-form-group">
                    <label>Payment Status</label>
                    <select
                      value={form.paymentStatus}
                      onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}
                      className="payments-form-input"
                    >
                      {PAYMENT_STATUSES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.icon} {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="payments-form-group">
                    <label>Purpose / Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="payments-form-input"
                    >
                      {PAYMENT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="payments-form-group">
                  <label>Reference / UTR / Transaction ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. UPI Ref 328912903492 or Card Slip #"
                    value={form.referenceId}
                    onChange={(e) => setForm({ ...form, referenceId: e.target.value })}
                    className="payments-form-input"
                  />
                </div>

                <div className="payments-form-group">
                  <label>Notes / Order Details</label>
                  <input
                    type="text"
                    placeholder="e.g. 50% advance for 2kg Red Velvet Birthday Cake"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="payments-form-input"
                  />
                </div>
              </div>

              <div className="payments-modal-footer">
                <button
                  type="button"
                  className="payments-btn payments-btn-secondary"
                  onClick={() => setIsRecordModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="payments-btn payments-btn-primary">
                  Save Payment Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Printable Receipt Slip */}
      {activeReceipt && (
        <div className="payments-modal-overlay" onClick={() => setActiveReceipt(null)}>
          <div className="payments-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="payments-modal-header">
              <h3>📄 Official Payment Receipt Slip</h3>
              <button
                type="button"
                className="payments-modal-close"
                onClick={() => setActiveReceipt(null)}
              >
                ✕
              </button>
            </div>

            <div className="payments-modal-body">
              <div className="payments-receipt-paper">
                <div className="payments-receipt-header">
                  <div className="payments-receipt-logo">🥖</div>
                  <div className="payments-receipt-brand">THE GOLDEN CRUST BAKERY</div>
                  <div style={{ fontSize: "11px", color: "#666" }}>
                    Artisan Breads, Custom Cakes & Confectionery
                  </div>
                  <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>
                    GSTIN: 33ABCDE1234F1Z5 · Phone: +91 98765 43210
                  </div>
                </div>

                <div className="payments-receipt-row">
                  <span>RECEIPT NO:</span>
                  <strong>{activeReceipt.id}</strong>
                </div>
                <div className="payments-receipt-row">
                  <span>DATE & TIME:</span>
                  <span>{new Date(activeReceipt.date).toLocaleString("en-IN")}</span>
                </div>
                <div className="payments-receipt-row">
                  <span>CUSTOMER:</span>
                  <span>{activeReceipt.customerName}</span>
                </div>
                {activeReceipt.customerPhone !== "N/A" && (
                  <div className="payments-receipt-row">
                    <span>PHONE:</span>
                    <span>{activeReceipt.customerPhone}</span>
                  </div>
                )}
                <div className="payments-receipt-row">
                  <span>CATEGORY:</span>
                  <span>{activeReceipt.category}</span>
                </div>

                <div className="payments-receipt-divider" />

                <div className="payments-receipt-row bold" style={{ fontSize: "15px" }}>
                  <span>AMOUNT SETTLED:</span>
                  <span>{formatINR(activeReceipt.amount)}</span>
                </div>
                <div className="payments-receipt-row">
                  <span>PAYMENT MODE:</span>
                  <span>{activeReceipt.paymentMethod}</span>
                </div>
                {activeReceipt.paymentMethod === "Cash" && activeReceipt.tendered > activeReceipt.amount && (
                  <>
                    <div className="payments-receipt-row">
                      <span>Cash Tendered:</span>
                      <span>{formatINR(activeReceipt.tendered)}</span>
                    </div>
                    <div className="payments-receipt-row">
                      <span>Change Returned:</span>
                      <span>{formatINR(activeReceipt.changeDue)}</span>
                    </div>
                  </>
                )}
                <div className="payments-receipt-row">
                  <span>PAYMENT STATUS:</span>
                  <strong style={{ color: activeReceipt.paymentStatus === "Paid" ? "#2e7d32" : "#e65100" }}>
                    {activeReceipt.paymentStatus.toUpperCase()}
                  </strong>
                </div>

                {activeReceipt.referenceId && (
                  <div className="payments-receipt-row">
                    <span>REF / UTR:</span>
                    <span>{activeReceipt.referenceId}</span>
                  </div>
                )}

                {activeReceipt.notes && (
                  <div style={{ fontSize: "11px", color: "#666", marginTop: "8px" }}>
                    Note: {activeReceipt.notes}
                  </div>
                )}

                <div className="payments-receipt-divider" />

                <div style={{ textAlign: "center", fontSize: "11px", color: "#888" }}>
                  Thank you for your business! Fresh bakes baked daily with love.
                </div>
              </div>
            </div>

            <div className="payments-modal-footer">
              <button
                type="button"
                className="payments-btn payments-btn-secondary"
                onClick={() => setActiveReceipt(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="payments-btn payments-btn-primary"
                onClick={() => window.print()}
              >
                🖨️ Print Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Payments;
