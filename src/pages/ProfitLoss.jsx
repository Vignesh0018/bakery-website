import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { EXPENSE_CATEGORIES } from "../constants/expenses";
import "../styles/ProfitLoss.css";

const LOCAL_STORAGE_KEY = "golden_crust_expenses";

function ProfitLoss() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Timeframe filter: 'all' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year'
  const [timeframe, setTimeframe] = useState("all");

  // Load expenses from local storage if needed
  const getLocalExpenses = () => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Filter out any legacy auto-seeded sample data that user did not add
          const realExpenses = parsed.filter(
            (item) => !item.id?.startsWith("sample-exp-")
          );
          // If stored contained sample data, clean it up from localStorage
          if (realExpenses.length !== parsed.length) {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(realExpenses));
          }
          return realExpenses;
        }
      }
    } catch (e) {
      console.warn("Could not read local expenses:", e);
    }
    return [];
  };

  const fetchData = async () => {
    setLoading(true);
    setError("");

    try {
      const [ordersRes, expensesRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, total_amount, order_status, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("expenses")
          .select("*")
          .order("expense_date", { ascending: false }),
      ]);

      if (ordersRes.error) {
        console.warn("Orders fetch warning:", ordersRes.error.message);
      }
      setOrders(ordersRes.data || []);

      if (expensesRes.error) {
        // Fallback to real user local storage expenses
        setExpenses(getLocalExpenses());
      } else {
        const dbExpenses = (expensesRes.data || []).filter(
          (item) => !item.id?.startsWith?.("sample-exp-")
        );
        if (dbExpenses.length > 0) {
          setExpenses(dbExpenses);
        } else {
          // Table exists in Supabase but has 0 records; check local storage for real user expenses
          setExpenses(getLocalExpenses());
        }
      }
    } catch (err) {
      setError(err.message || "Failed to load financial records.");
      setExpenses(getLocalExpenses());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadInitial = async () => {
      try {
        const [ordersRes, expensesRes] = await Promise.all([
          supabase
            .from("orders")
            .select("id, total_amount, order_status, created_at")
            .order("created_at", { ascending: false }),
          supabase
            .from("expenses")
            .select("*")
            .order("expense_date", { ascending: false }),
        ]);

        if (!ignore) {
          if (ordersRes.error) {
            console.warn("Orders fetch notice:", ordersRes.error.message);
          }
          setOrders(ordersRes.data || []);

          if (expensesRes.error) {
            setExpenses(getLocalExpenses());
          } else {
            const dbExpenses = (expensesRes.data || []).filter(
              (item) => !item.id?.startsWith?.("sample-exp-")
            );
            if (dbExpenses.length > 0) {
              setExpenses(dbExpenses);
            } else {
              setExpenses(getLocalExpenses());
            }
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Failed to load financial records.");
          setExpenses(getLocalExpenses());
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadInitial();

    return () => {
      ignore = true;
    };
  }, []);

  // Filter orders and expenses based on selected timeframe
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentQuarter = Math.floor(currentMonth / 3);

  const isMatch = (dateStr) => {
    if (!dateStr) return false;
    if (timeframe === "all") return true;

    const d = new Date(dateStr);
    const dYear = d.getFullYear();
    const dMonth = d.getMonth();

    if (timeframe === "this_month") {
      return dYear === currentYear && dMonth === currentMonth;
    }

    if (timeframe === "last_month") {
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      return dYear === lastMonthYear && dMonth === lastMonth;
    }

    if (timeframe === "this_quarter") {
      const dQuarter = Math.floor(dMonth / 3);
      return dYear === currentYear && dQuarter === currentQuarter;
    }

    if (timeframe === "this_year") {
      return dYear === currentYear;
    }

    return true;
  };

  const filteredOrders = orders.filter((o) => isMatch(o.created_at) && o.order_status !== "Cancelled");
  const filteredExpenses = expenses.filter((e) => isMatch(e.expense_date || e.created_at));

  // 1. Revenue
  let deliveredRevenue = 0;
  let pendingOrInPrepRevenue = 0;
  let totalRevenue = 0;

  filteredOrders.forEach((o) => {
    const amt = Number(o.total_amount || 0);
    totalRevenue += amt;
    if (o.order_status === "Delivered") {
      deliveredRevenue += amt;
    } else {
      pendingOrInPrepRevenue += amt;
    }
  });

  // 2. Expenses breakdown by category
  const catMap = {};
  let cogsTotal = 0;
  let opexTotal = 0;
  let totalExpenses = 0;

  filteredExpenses.forEach((exp) => {
    const amt = Number(exp.amount || 0);
    totalExpenses += amt;
    catMap[exp.category] = (catMap[exp.category] || 0) + amt;

    const catDef = EXPENSE_CATEGORIES.find((c) => c.name === exp.category);
    if (catDef?.type === "COGS") {
      cogsTotal += amt;
    } else {
      opexTotal += amt;
    }
  });

  // 3. Profit calculations
  const grossProfit = totalRevenue - cogsTotal;
  const grossMarginPct = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : "0.0";

  const netProfit = grossProfit - opexTotal;
  const netMarginPct = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0.0";

  // 4. Key Financial Ratios
  const foodCostRatio = totalRevenue > 0 ? (((catMap["Raw Ingredients"] || 0) / totalRevenue) * 100).toFixed(1) : "0.0";
  const laborRatio = totalRevenue > 0 ? (((catMap["Staff & Wages"] || 0) / totalRevenue) * 100).toFixed(1) : "0.0";
  const rentPowerRatio = totalRevenue > 0 ? ((((catMap["Rent & Kitchen Lease"] || 0) + (catMap["Utilities & Fuel"] || 0)) / totalRevenue) * 100).toFixed(1) : "0.0";
  const opexRatio = totalRevenue > 0 ? ((opexTotal / totalRevenue) * 100).toFixed(1) : "0.0";

  const metrics = {
    totalRevenue,
    deliveredRevenue,
    pendingOrInPrepRevenue,
    totalOrdersCount: filteredOrders.length,
    cogsTotal,
    opexTotal,
    totalExpenses,
    grossProfit,
    grossMarginPct,
    netProfit,
    netMarginPct,
    catMap,
    foodCostRatio,
    laborRatio,
    rentPowerRatio,
    opexRatio,
    isProfitable: netProfit >= 0,
  };

  const handlePrint = () => {
    window.print();
  };

  const timeframeLabels = {
    all: "All Time",
    this_month: "This Month",
    last_month: "Last Month",
    this_quarter: "This Quarter",
    this_year: "This Year",
  };

  return (
    <div className="profitloss-page">
      {/* Header */}
      <div className="profitloss-header">
        <div className="profitloss-header-left">
          <div className="profitloss-title-row">
            <h1>Profit & Loss Statement</h1>
            <span className={`profitloss-health-badge ${metrics.totalExpenses === 0 ? "zero-expenses" : metrics.isProfitable ? "profitable" : "loss"}`}>
              {metrics.totalExpenses === 0
                ? (metrics.totalRevenue > 0 ? "● Gross Sales (0 Expenses)" : "● No Data Yet")
                : metrics.isProfitable
                ? "● Net Profitable"
                : "● Operating at Loss"}
            </span>
          </div>
          <p>
            Real-time bakery financial health: Gross Sales, Cost of Goods Sold (COGS), Operating Overheads, and Net Margins.
          </p>
        </div>

        <div className="profitloss-header-actions no-print">
          <button
            type="button"
            className="profitloss-btn profitloss-btn-secondary"
            onClick={() => navigate("/admin/dashboard")}
          >
            ← Dashboard
          </button>

          <button
            type="button"
            className="profitloss-btn profitloss-btn-secondary"
            onClick={() => navigate("/admin/expenses")}
          >
            💸 Manage Expenses
          </button>

          <button
            type="button"
            className="profitloss-btn profitloss-btn-secondary"
            onClick={() => navigate("/admin/orders")}
          >
            📦 View Orders
          </button>

          <button
            type="button"
            className="profitloss-btn profitloss-btn-secondary"
            onClick={fetchData}
            disabled={loading}
          >
            🔄 {loading ? "Updating..." : "Refresh"}
          </button>

          <button
            type="button"
            className="profitloss-btn profitloss-btn-primary"
            onClick={handlePrint}
          >
            🖨️ Print P&L Report
          </button>
        </div>
      </div>

      {/* Timeframe Controls Bar */}
      <div className="profitloss-timeframe-bar no-print">
        <span className="profitloss-timeframe-label">Statement Timeframe:</span>
        <div className="profitloss-timeframe-pills">
          {Object.entries(timeframeLabels).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`profitloss-time-pill ${timeframe === key ? "active" : ""}`}
              onClick={() => setTimeframe(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="profitloss-banner profitloss-banner-error">
          ⚠️ {error}
        </div>
      )}

      {/* Informational banner when user has not added expenses */}
      {metrics.totalExpenses === 0 && (
        <div className="profitloss-empty-banner no-print">
          <div className="profitloss-empty-left">
            <span className="profitloss-empty-icon">💡</span>
            <div className="profitloss-empty-info">
              <h4>No Operating Expenses Recorded Yet</h4>
              <p>
                You haven't logged any ingredient costs, packaging, utilities, rent, or staff wages yet.
                All customer order revenue currently reflects 100% gross margin without expense deductions.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="profitloss-btn profitloss-btn-primary"
            onClick={() => navigate("/admin/expenses")}
          >
            + Add Operating Expenses
          </button>
        </div>
      )}

      {/* Financial Executive Summary Cards */}
      <div className="profitloss-kpi-grid">
        {/* Gross Revenue */}
        <div className="profitloss-kpi-card revenue">
          <div className="profitloss-kpi-header">
            <span className="profitloss-kpi-title">Gross Revenue</span>
            <span className="profitloss-kpi-icon">💰</span>
          </div>
          <p className="profitloss-kpi-val" style={{ color: "#2e7d32" }}>
            ₹{metrics.totalRevenue.toLocaleString("en-IN")}
          </p>
          <span className="profitloss-kpi-desc">
            From {metrics.totalOrdersCount} customer orders
          </span>
        </div>

        {/* COGS (Direct Costs) */}
        <div className="profitloss-kpi-card cogs">
          <div className="profitloss-kpi-header">
            <span className="profitloss-kpi-title">Cost of Goods (COGS)</span>
            <span className="profitloss-kpi-icon">🌾</span>
          </div>
          <p className="profitloss-kpi-val" style={{ color: "#e65100" }}>
            ₹{metrics.cogsTotal.toLocaleString("en-IN")}
          </p>
          <span className="profitloss-kpi-desc">
            {metrics.cogsTotal === 0
              ? "No ingredient or packaging expenses recorded"
              : "Raw ingredients & packaging supplies"}
          </span>
        </div>

        {/* Gross Profit */}
        <div className="profitloss-kpi-card">
          <div className="profitloss-kpi-header">
            <span className="profitloss-kpi-title">Gross Profit</span>
            <span className="profitloss-kpi-icon">📈</span>
          </div>
          <p className="profitloss-kpi-val" style={{ color: metrics.grossProfit >= 0 ? "#1b5e20" : "#c62828" }}>
            ₹{metrics.grossProfit.toLocaleString("en-IN")}
          </p>
          <span className="profitloss-kpi-desc">
            {metrics.cogsTotal === 0
              ? "Gross Margin: 100.0% (Zero COGS deducted)"
              : (
                <>Gross Margin: <strong>{metrics.grossMarginPct}%</strong></>
              )}
          </span>
        </div>

        {/* Operating Expenses */}
        <div className="profitloss-kpi-card opex">
          <div className="profitloss-kpi-header">
            <span className="profitloss-kpi-title">Operating Expenses</span>
            <span className="profitloss-kpi-icon">🏢</span>
          </div>
          <p className="profitloss-kpi-val" style={{ color: "#6a1b9a" }}>
            ₹{metrics.opexTotal.toLocaleString("en-IN")}
          </p>
          <span className="profitloss-kpi-desc">
            {metrics.opexTotal === 0
              ? "No utilities, wages, or rent recorded"
              : "Wages, utilities, rent & overheads"}
          </span>
        </div>

        {/* Net Profit / Loss */}
        <div className={`profitloss-kpi-card net ${metrics.isProfitable ? "profit" : "loss"}`}>
          <div className="profitloss-kpi-header">
            <span className="profitloss-kpi-title">Net Operating Profit</span>
            <span className="profitloss-kpi-icon">{metrics.isProfitable ? "🏆" : "⚠️"}</span>
          </div>
          <p className="profitloss-kpi-val">
            ₹{metrics.netProfit.toLocaleString("en-IN")}
          </p>
          <span className="profitloss-kpi-desc">
            {metrics.totalExpenses === 0 ? (
              "Net Margin: 100.0% (Awaiting expense entries)"
            ) : (
              <>Net Margin: <strong>{metrics.netMarginPct}%</strong> ({metrics.isProfitable ? "Surplus" : "Deficit"})</>
            )}
          </span>
        </div>
      </div>

      {/* Main Financial Statement */}
      <section className="profitloss-section">
        <div className="profitloss-statement-header">
          <div>
            <h2>Statement of Income and Expenses</h2>
            <p className="profitloss-statement-subtitle">
              Period: <strong>{timeframeLabels[timeframe]}</strong> • The Golden Crust Bakery
            </p>
          </div>

          <div className="profitloss-quick-ratios">
            <div className="ratio-item">
              <span className="ratio-label">Food Cost:</span>
              <span className="ratio-val">{metrics.foodCostRatio}%</span>
            </div>
            <div className="ratio-item">
              <span className="ratio-label">Labor Cost:</span>
              <span className="ratio-val">{metrics.laborRatio}%</span>
            </div>
            <div className="ratio-item">
              <span className="ratio-label">Net Margin:</span>
              <span className="ratio-val" style={{ color: metrics.isProfitable ? "#2e7d32" : "#c62828" }}>
                {metrics.netMarginPct}%
              </span>
            </div>
          </div>
        </div>

        <div className="profitloss-table-wrapper">
          <table className="profitloss-table">
            <thead>
              <tr>
                <th style={{ width: "60%" }}>Accounting Category / Line Item</th>
                <th style={{ textAlign: "right", width: "20%" }}>Amount (₹)</th>
                <th style={{ textAlign: "right", width: "20%" }}>% of Revenue</th>
              </tr>
            </thead>
            <tbody>
              {/* SECTION 1: REVENUE */}
              <tr className="pl-section-row">
                <td colSpan={3}>1. OPERATING REVENUE (INCOME)</td>
              </tr>
              <tr className="pl-sub-row">
                <td>
                  <span className="pl-indent">Fulfilled & Delivered Orders</span>
                </td>
                <td className="pl-amt">₹{metrics.deliveredRevenue.toLocaleString("en-IN")}</td>
                <td className="pl-pct">
                  {metrics.totalRevenue > 0
                    ? ((metrics.deliveredRevenue / metrics.totalRevenue) * 100).toFixed(1)
                    : "0.0"}%
                </td>
              </tr>
              <tr className="pl-sub-row">
                <td>
                  <span className="pl-indent">Active / In-Kitchen Orders (Confirmed, Preparing, Ready)</span>
                </td>
                <td className="pl-amt">₹{metrics.pendingOrInPrepRevenue.toLocaleString("en-IN")}</td>
                <td className="pl-pct">
                  {metrics.totalRevenue > 0
                    ? ((metrics.pendingOrInPrepRevenue / metrics.totalRevenue) * 100).toFixed(1)
                    : "0.0"}%
                </td>
              </tr>
              <tr className="pl-total-row revenue-total">
                <td>
                  <strong>Total Operating Revenue</strong>
                </td>
                <td className="pl-amt bold" style={{ color: "#2e7d32" }}>
                  ₹{metrics.totalRevenue.toLocaleString("en-IN")}
                </td>
                <td className="pl-pct bold">100.0%</td>
              </tr>

              {/* SECTION 2: COGS */}
              <tr className="pl-section-row">
                <td colSpan={3}>2. COST OF GOODS SOLD (DIRECT PRODUCTION COSTS)</td>
              </tr>
              <tr className="pl-sub-row">
                <td>
                  <span className="pl-indent">🌾 Raw Ingredients (Flour, Butter, Sugar, Yeast, Dairy, Cocoa)</span>
                </td>
                <td className="pl-amt">₹{(metrics.catMap["Raw Ingredients"] || 0).toLocaleString("en-IN")}</td>
                <td className="pl-pct">{metrics.foodCostRatio}%</td>
              </tr>
              <tr className="pl-sub-row">
                <td>
                  <span className="pl-indent">📦 Packaging & Boxes (Cake boxes, pastry bags, liners, ribbons)</span>
                </td>
                <td className="pl-amt">₹{(metrics.catMap["Packaging & Boxes"] || 0).toLocaleString("en-IN")}</td>
                <td className="pl-pct">
                  {metrics.totalRevenue > 0
                    ? (((metrics.catMap["Packaging & Boxes"] || 0) / metrics.totalRevenue) * 100).toFixed(1)
                    : "0.0"}%
                </td>
              </tr>
              <tr className="pl-total-row cogs-total">
                <td>
                  <strong>Total Cost of Goods Sold (COGS)</strong>
                </td>
                <td className="pl-amt bold" style={{ color: "#e65100" }}>
                  ₹{metrics.cogsTotal.toLocaleString("en-IN")}
                </td>
                <td className="pl-pct bold">
                  {metrics.totalRevenue > 0
                    ? ((metrics.cogsTotal / metrics.totalRevenue) * 100).toFixed(1)
                    : "0.0"}%
                </td>
              </tr>

              {/* GROSS PROFIT */}
              <tr className="pl-grand-row gross-profit-row">
                <td>
                  <strong>= GROSS PROFIT (Revenue - COGS)</strong>
                </td>
                <td className="pl-amt grand-val" style={{ color: metrics.grossProfit >= 0 ? "#1b5e20" : "#c62828" }}>
                  ₹{metrics.grossProfit.toLocaleString("en-IN")}
                </td>
                <td className="pl-pct grand-val">{metrics.grossMarginPct}%</td>
              </tr>

              {/* SECTION 3: OPERATING EXPENSES */}
              <tr className="pl-section-row">
                <td colSpan={3}>3. OPERATING EXPENSES (OVERHEADS & FACILITY)</td>
              </tr>
              <tr className="pl-sub-row">
                <td>
                  <span className="pl-indent">👨‍🍳 Staff Wages & Kitchen Payroll</span>
                </td>
                <td className="pl-amt">₹{(metrics.catMap["Staff & Wages"] || 0).toLocaleString("en-IN")}</td>
                <td className="pl-pct">{metrics.laborRatio}%</td>
              </tr>
              <tr className="pl-sub-row">
                <td>
                  <span className="pl-indent">⚡ Utilities & Fuel (Commercial Electric Ovens, Power, Gas)</span>
                </td>
                <td className="pl-amt">₹{(metrics.catMap["Utilities & Fuel"] || 0).toLocaleString("en-IN")}</td>
                <td className="pl-pct">
                  {metrics.totalRevenue > 0
                    ? (((metrics.catMap["Utilities & Fuel"] || 0) / metrics.totalRevenue) * 100).toFixed(1)
                    : "0.0"}%
                </td>
              </tr>
              <tr className="pl-sub-row">
                <td>
                  <span className="pl-indent">🏠 Storefront & Kitchen Facility Lease / Rent</span>
                </td>
                <td className="pl-amt">₹{(metrics.catMap["Rent & Kitchen Lease"] || 0).toLocaleString("en-IN")}</td>
                <td className="pl-pct">
                  {metrics.totalRevenue > 0
                    ? (((metrics.catMap["Rent & Kitchen Lease"] || 0) / metrics.totalRevenue) * 100).toFixed(1)
                    : "0.0"}%
                </td>
              </tr>
              <tr className="pl-sub-row">
                <td>
                  <span className="pl-indent">🔧 Equipment Maintenance & Mixer / Oven Servicing</span>
                </td>
                <td className="pl-amt">₹{(metrics.catMap["Equipment & Maintenance"] || 0).toLocaleString("en-IN")}</td>
                <td className="pl-pct">
                  {metrics.totalRevenue > 0
                    ? (((metrics.catMap["Equipment & Maintenance"] || 0) / metrics.totalRevenue) * 100).toFixed(1)
                    : "0.0"}%
                </td>
              </tr>
              <tr className="pl-sub-row">
                <td>
                  <span className="pl-indent">📢 Marketing, Social Ads & POS Software</span>
                </td>
                <td className="pl-amt">₹{(metrics.catMap["Marketing & Tech"] || 0).toLocaleString("en-IN")}</td>
                <td className="pl-pct">
                  {metrics.totalRevenue > 0
                    ? (((metrics.catMap["Marketing & Tech"] || 0) / metrics.totalRevenue) * 100).toFixed(1)
                    : "0.0"}%
                </td>
              </tr>
              <tr className="pl-sub-row">
                <td>
                  <span className="pl-indent">🧾 Miscellaneous Overhead & Cleaning Supplies</span>
                </td>
                <td className="pl-amt">₹{(metrics.catMap["Miscellaneous"] || 0).toLocaleString("en-IN")}</td>
                <td className="pl-pct">
                  {metrics.totalRevenue > 0
                    ? (((metrics.catMap["Miscellaneous"] || 0) / metrics.totalRevenue) * 100).toFixed(1)
                    : "0.0"}%
                </td>
              </tr>
              <tr className="pl-total-row opex-total">
                <td>
                  <strong>Total Operating Expenses (OpEx)</strong>
                </td>
                <td className="pl-amt bold" style={{ color: "#6a1b9a" }}>
                  ₹{metrics.opexTotal.toLocaleString("en-IN")}
                </td>
                <td className="pl-pct bold">{metrics.opexRatio}%</td>
              </tr>

              {/* NET PROFIT BOTTOM LINE */}
              <tr className={`pl-grand-row net-profit-row ${metrics.isProfitable ? "profit" : "loss"}`}>
                <td>
                  <strong>= NET OPERATING PROFIT / (LOSS)</strong>
                  <div className="pl-bottom-note">
                    {metrics.isProfitable
                      ? "Healthy bakery profitability after all ingredient, packaging, and operating costs."
                      : "Outflows exceed sales in this period. Review food cost portions or promotional pricing."}
                  </div>
                </td>
                <td className="pl-amt grand-val" style={{ color: metrics.isProfitable ? "#1b5e20" : "#c62828" }}>
                  ₹{metrics.netProfit.toLocaleString("en-IN")}
                </td>
                <td className="pl-pct grand-val" style={{ color: metrics.isProfitable ? "#1b5e20" : "#c62828" }}>
                  {metrics.netMarginPct}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Visual Cost Allocation Breakdown */}
      <section className="profitloss-section no-print">
        <div className="profitloss-section-header">
          <h2>Bakery Financial Health & Industry Benchmarks</h2>
          <span className="profitloss-badge">Pro Insights</span>
        </div>

        <div className="profitloss-benchmarks-grid">
          {/* Food Cost Benchmark */}
          <div className="benchmark-card">
            <div className="benchmark-header">
              <span className="benchmark-title">Food Cost Ratio (Ingredients)</span>
              <span className="benchmark-score">{metrics.foodCostRatio}%</span>
            </div>
            <div className="benchmark-progress-bar">
              <div
                className="benchmark-progress-fill"
                style={{
                  width: `${Math.min(Number(metrics.foodCostRatio), 100)}%`,
                  background: Number(metrics.foodCostRatio) <= 35 ? "#2e7d32" : "#d84315",
                }}
              />
            </div>
            <p className="benchmark-desc">
              Bakery Industry Benchmark: <strong>28% - 35%</strong>.
              {metrics.totalExpenses === 0 || (metrics.catMap["Raw Ingredients"] || 0) === 0
                ? " ℹ️ Awaiting ingredient expense entries to calculate your live food cost ratio."
                : Number(metrics.foodCostRatio) <= 35
                ? " ✨ Excellent ingredient portion control."
                : " ⚠️ Higher than target. Consider bulk purchasing or batch yield optimization."}
            </p>
          </div>

          {/* Labor Cost Benchmark */}
          <div className="benchmark-card">
            <div className="benchmark-header">
              <span className="benchmark-title">Kitchen Labor & Wages</span>
              <span className="benchmark-score">{metrics.laborRatio}%</span>
            </div>
            <div className="benchmark-progress-bar">
              <div
                className="benchmark-progress-fill"
                style={{
                  width: `${Math.min(Number(metrics.laborRatio), 100)}%`,
                  background: Number(metrics.laborRatio) <= 32 ? "#2e7d32" : "#f57c00",
                }}
              />
            </div>
            <p className="benchmark-desc">
              Bakery Industry Benchmark: <strong>25% - 32%</strong>.
              {metrics.totalExpenses === 0 || (metrics.catMap["Staff & Wages"] || 0) === 0
                ? " ℹ️ Awaiting kitchen payroll entries to calculate labor cost percentage."
                : Number(metrics.laborRatio) <= 32
                ? " ✨ Balanced payroll efficiency."
                : " ⚠️ High labor percentage. Scale order volume to absorb staff fixed hours."}
            </p>
          </div>

          {/* Rent & Utilities Benchmark */}
          <div className="benchmark-card">
            <div className="benchmark-header">
              <span className="benchmark-title">Rent & Power Tariff</span>
              <span className="benchmark-score">{metrics.rentPowerRatio}%</span>
            </div>
            <div className="benchmark-progress-bar">
              <div
                className="benchmark-progress-fill"
                style={{
                  width: `${Math.min(Number(metrics.rentPowerRatio), 100)}%`,
                  background: Number(metrics.rentPowerRatio) <= 18 ? "#2e7d32" : "#6a1b9a",
                }}
              />
            </div>
            <p className="benchmark-desc">
              Bakery Industry Benchmark: <strong>under 15% - 18%</strong> of gross sales.
              {metrics.totalExpenses === 0 || ((metrics.catMap["Rent & Kitchen Lease"] || 0) + (metrics.catMap["Utilities & Fuel"] || 0)) === 0
                ? " ℹ️ Awaiting lease and utility bills to evaluate overhead burden."
                : ""}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ProfitLoss;
