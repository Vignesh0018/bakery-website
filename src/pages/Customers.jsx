import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../styles/Customers.css";

function Customers() {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("all"); // 'all' | 'repeat' | 'single'
  const [sortBy, setSortBy] = useState("orders_desc");

  // Fetch and aggregate customers from orders
  const fetchCustomers = async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: fetchErr } = await supabase
        .from("orders")
        .select("id, customer_name, phone, total_amount, created_at, order_status");

      if (fetchErr) throw fetchErr;

      const customerMap = {};

      (data || []).forEach((order) => {
        const phone = order.phone || "Unknown Phone";

        if (!customerMap[phone]) {
          customerMap[phone] = {
            name: order.customer_name || "Guest Customer",
            phone: phone,
            totalOrders: 0,
            totalSpent: 0,
            lastOrder: order.created_at,
            orderIds: [],
          };
        }

        customerMap[phone].totalOrders += 1;
        customerMap[phone].totalSpent += Number(order.total_amount || 0);
        customerMap[phone].orderIds.push(order.id);

        if (
          new Date(order.created_at) > new Date(customerMap[phone].lastOrder)
        ) {
          customerMap[phone].lastOrder = order.created_at;
          if (order.customer_name) {
            customerMap[phone].name = order.customer_name;
          }
        }
      });

      setCustomers(Object.values(customerMap));
    } catch (err) {
      setError(err.message || "Failed to load customer profiles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadData = async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from("orders")
          .select("id, customer_name, phone, total_amount, created_at, order_status");

        if (!ignore) {
          if (fetchErr) throw fetchErr;

          const customerMap = {};

          (data || []).forEach((order) => {
            const phone = order.phone || "Unknown Phone";

            if (!customerMap[phone]) {
              customerMap[phone] = {
                name: order.customer_name || "Guest Customer",
                phone: phone,
                totalOrders: 0,
                totalSpent: 0,
                lastOrder: order.created_at,
                orderIds: [],
              };
            }

            customerMap[phone].totalOrders += 1;
            customerMap[phone].totalSpent += Number(order.total_amount || 0);
            customerMap[phone].orderIds.push(order.id);

            if (
              new Date(order.created_at) > new Date(customerMap[phone].lastOrder)
            ) {
              customerMap[phone].lastOrder = order.created_at;
              if (order.customer_name) {
                customerMap[phone].name = order.customer_name;
              }
            }
          });

          setCustomers(Object.values(customerMap));
        }
      } catch (err) {
        if (!ignore) setError(err.message || "Failed to load customer profiles.");
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadData();

    return () => {
      ignore = true;
    };
  }, []);

  // CRM Metrics computation
  const metrics = useMemo(() => {
    let repeatCount = 0;
    let totalSpentSum = 0;

    customers.forEach((c) => {
      if (c.totalOrders > 1) {
        repeatCount += 1;
      }
      totalSpentSum += c.totalSpent;
    });

    const totalCust = customers.length;
    const avgLtv = totalCust > 0 ? Math.round(totalSpentSum / totalCust) : 0;
    const repeatRate =
      totalCust > 0 ? Math.round((repeatCount / totalCust) * 100) : 0;

    return {
      total: totalCust,
      repeat: repeatCount,
      repeatRate,
      totalSpent: totalSpentSum,
      avgLtv,
    };
  }, [customers]);

  // Filtered and sorted customers
  const filteredCustomers = useMemo(() => {
    let list = [...customers];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q)
      );
    }

    // Tier filter
    if (tierFilter === "repeat") {
      list = list.filter((c) => c.totalOrders > 1);
    } else if (tierFilter === "single") {
      list = list.filter((c) => c.totalOrders === 1);
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === "orders_desc") {
        return b.totalOrders - a.totalOrders;
      }
      if (sortBy === "spent_desc") {
        return b.totalSpent - a.totalSpent;
      }
      if (sortBy === "recent") {
        return new Date(b.lastOrder) - new Date(a.lastOrder);
      }
      if (sortBy === "name_asc") {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

    return list;
  }, [customers, searchQuery, tierFilter, sortBy]);

  // Helper for customer tier badge
  const getCustomerTier = (totalOrders) => {
    if (totalOrders >= 3) {
      return {
        label: "VIP Buyer",
        className: "customer-tier-vip",
        icon: "👑",
        avatarClass: "customer-avatar-vip",
      };
    }
    if (totalOrders >= 2) {
      return {
        label: "Repeat Buyer",
        className: "customer-tier-repeat",
        icon: "⭐",
        avatarClass: "customer-avatar-repeat",
      };
    }
    return {
      label: "New Customer",
      className: "customer-tier-new",
      icon: "👤",
      avatarClass: "",
    };
  };

  // Helper to get initials
  const getInitials = (name) => {
    if (!name) return "GC";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="customers-page">
      {/* Header */}
      <div className="customers-header">
        <div className="customers-header-left">
          <h1>Customer Management</h1>
          <p>Analyze buyer frequency, lifetime spending, and customer loyalty.</p>
        </div>

        <div className="customers-header-actions">
          <button
            type="button"
            className="customers-btn customers-btn-secondary"
            onClick={() => navigate("/admin/dashboard")}
          >
            ← Back to Dashboard
          </button>

          <button
            type="button"
            className="customers-btn customers-btn-secondary"
            onClick={fetchCustomers}
            disabled={loading}
          >
            🔄 {loading ? "Refreshing..." : "Refresh Customers"}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="customers-banner-error">
          <span>⚠️ {error}</span>
          <button
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit" }}
            onClick={() => setError("")}
          >
            ✕
          </button>
        </div>
      )}

      {/* CRM Stats Grid */}
      <div className="customers-stats-grid">
        <div
          className={`customers-stat-card ${tierFilter === "all" ? "active-filter" : ""}`}
          onClick={() => setTierFilter("all")}
        >
          <div className="customers-stat-header">
            <span className="customers-stat-title">Total Customers</span>
            <span className="customers-stat-icon">👥</span>
          </div>
          <p className="customers-stat-value">{metrics.total}</p>
          <span className="customers-stat-desc">Unique customers on record</span>
        </div>

        <div
          className={`customers-stat-card ${tierFilter === "repeat" ? "active-filter" : ""}`}
          onClick={() => setTierFilter("repeat")}
        >
          <div className="customers-stat-header">
            <span className="customers-stat-title">Repeat Buyers</span>
            <span className="customers-stat-icon">👑</span>
          </div>
          <p className="customers-stat-value" style={{ color: "#8b5e3c" }}>
            {metrics.repeat}
          </p>
          <span className="customers-stat-desc">
            {metrics.repeatRate}% retention rate
          </span>
        </div>

        <div className="customers-stat-card">
          <div className="customers-stat-header">
            <span className="customers-stat-title">Customer Revenue</span>
            <span className="customers-stat-icon">💰</span>
          </div>
          <p className="customers-stat-value" style={{ color: "#2e7d32", fontSize: "28px" }}>
            ₹{metrics.totalSpent.toLocaleString("en-IN")}
          </p>
          <span className="customers-stat-desc">Gross customer lifetime value</span>
        </div>

        <div className="customers-stat-card">
          <div className="customers-stat-header">
            <span className="customers-stat-title">Avg Spend / Customer</span>
            <span className="customers-stat-icon">📈</span>
          </div>
          <p className="customers-stat-value" style={{ color: "#2e7d32", fontSize: "28px" }}>
            ₹{metrics.avgLtv.toLocaleString("en-IN")}
          </p>
          <span className="customers-stat-desc">Average lifetime order value</span>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="customers-controls-bar">
        {/* Search */}
        <div className="customers-search-box">
          <input
            type="text"
            className="customers-search-input"
            placeholder="🔍 Search customer name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="customers-search-clear"
              onClick={() => setSearchQuery("")}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Pills & Sort */}
        <div className="customers-filters-group">
          <div className="customers-filter-pills">
            <button
              type="button"
              className={`customers-pill-btn ${tierFilter === "all" ? "active" : ""}`}
              onClick={() => setTierFilter("all")}
            >
              All ({metrics.total})
            </button>
            <button
              type="button"
              className={`customers-pill-btn ${tierFilter === "repeat" ? "active" : ""}`}
              onClick={() => setTierFilter("repeat")}
            >
              Repeat Buyers ({metrics.repeat})
            </button>
            <button
              type="button"
              className={`customers-pill-btn ${tierFilter === "single" ? "active" : ""}`}
              onClick={() => setTierFilter("single")}
            >
              First-time Buyers ({metrics.total - metrics.repeat})
            </button>
          </div>

          <select
            className="customers-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="orders_desc">Sort: Most Orders</option>
            <option value="spent_desc">Sort: Highest Spender</option>
            <option value="recent">Sort: Most Recently Active</option>
            <option value="name_asc">Sort: Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Main Customers Section */}
      <section className="customers-section">
        <div className="customers-section-header">
          <h2>Customer Directory ({filteredCustomers.length})</h2>
          <span style={{ fontSize: "13px", color: "#8a6b58" }}>
            Auto-compiled from incoming orders
          </span>
        </div>

        {loading ? (
          <div className="customers-empty-state">
            <div className="customers-empty-icon">⏳</div>
            <h3>Loading Bakery Customers...</h3>
            <p>Compiling customer history and purchase frequencies.</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="customers-empty-state">
            <div className="customers-empty-icon">👥</div>
            {customers.length === 0 ? (
              <>
                <h3>No Customers on Record Yet</h3>
                <p>
                  As customers place orders through your bakery storefront, their contact details, order totals, and frequency will automatically aggregate here.
                </p>
                <button
                  type="button"
                  className="customers-btn customers-btn-primary"
                  onClick={() => navigate("/")}
                >
                  Visit Storefront
                </button>
              </>
            ) : (
              <>
                <h3>No Customers Match Your Filters</h3>
                <p>
                  No customer records matched &ldquo;{searchQuery}&rdquo;.
                </p>
                <button
                  type="button"
                  className="customers-btn customers-btn-secondary"
                  onClick={() => {
                    setSearchQuery("");
                    setTierFilter("all");
                  }}
                >
                  Clear Filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="customers-table-container">
            <table className="customers-table">
              <thead>
                <tr>
                  <th>Customer Profile</th>
                  <th>Contact Phone</th>
                  <th>Orders Count</th>
                  <th>Lifetime Spend</th>
                  <th>Avg. Order</th>
                  <th>Last Order Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => {
                  const tier = getCustomerTier(customer.totalOrders);
                  const avgSpend =
                    customer.totalOrders > 0
                      ? Math.round(customer.totalSpent / customer.totalOrders)
                      : 0;

                  return (
                    <tr key={customer.phone}>
                      {/* Name & Tier */}
                      <td>
                        <div className="customer-profile-cell">
                          <div className={`customer-avatar ${tier.avatarClass}`}>
                            {getInitials(customer.name)}
                          </div>
                          <div>
                            <div className="customer-info-title">
                              <span className="customer-name">{customer.name}</span>
                              <span className={`customer-tier-badge ${tier.className}`}>
                                {tier.icon} {tier.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td>
                        <a
                          href={`tel:${customer.phone}`}
                          className="customer-phone-link"
                          title="Click to call customer"
                        >
                          📞 {customer.phone}
                        </a>
                      </td>

                      {/* Orders Count */}
                      <td>
                        <span className="customer-orders-pill">
                          {customer.totalOrders} {customer.totalOrders === 1 ? "order" : "orders"}
                        </span>
                      </td>

                      {/* Lifetime Spend */}
                      <td>
                        <span className="customer-spent-amount">
                          ₹{customer.totalSpent.toLocaleString("en-IN")}
                        </span>
                      </td>

                      {/* Avg Spend */}
                      <td>
                        <span style={{ fontWeight: 600, color: "#654b3a" }}>
                          ₹{avgSpend.toLocaleString("en-IN")}
                        </span>
                      </td>

                      {/* Last Order Date */}
                      <td>
                        <span style={{ color: "#8a6b58", fontSize: "13px" }}>
                          📅 {new Date(customer.lastOrder).toLocaleDateString("en-IN", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
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

export default Customers;
