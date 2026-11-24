import { useEffect, useState, useMemo } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../styles/Billing.css";

const HELD_BILLS_STORAGE_KEY = "golden_crust_held_bills";
const BILLS_HISTORY_STORAGE_KEY = "golden_crust_billing_history";

function generateInvoiceNumber() {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `GCB-${dateStr}-${randomSuffix}`;
}

function Billing() {
  const navigate = useNavigate();
  const outletCtx = useOutletContext() || {};
  const adminEmail = outletCtx.adminEmail || "Bakery Admin";

  // Data from database: products and categories
  const [products, setProducts] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState("pos"); // 'pos' | 'register'

  // Search & category filter for catalog
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Cart / Terminal state
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderType, setOrderType] = useState("Takeaway"); // 'Takeaway' | 'Dine-in' | 'Delivery'
  const [orderNotes, setOrderNotes] = useState("");

  // Payment & Discount state
  const [paymentMethod, setPaymentMethod] = useState("Cash"); // 'Cash' | 'UPI / QR' | 'Card'
  const [tenderedAmount, setTenderedAmount] = useState("");
  const [discountType, setDiscountType] = useState("flat"); // 'flat' (₹) | 'pct' (%)
  const [discountValue, setDiscountValue] = useState("");
  const [applyGst, setApplyGst] = useState(true); // 5% GST (2.5% CGST + 2.5% SGST)

  // Modals & UI state
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customItemForm, setCustomItemForm] = useState({ name: "", price: "", category: "CUSTOM" });
  const [activeReceipt, setActiveReceipt] = useState(null); // When open, shows printable receipt
  const [submittingBill, setSubmittingBill] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");
  const [successBanner, setSuccessBanner] = useState("");

  // Held Bills queue (purges legacy mock items)
  const [heldBills, setHeldBills] = useState(() => {
    try {
      const stored = localStorage.getItem(HELD_BILLS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(
            (b) => !b.cart?.some((i) => i.id?.startsWith("def-") || i.name === "Classic Chocolate Fudge Cake")
          );
          if (cleaned.length !== parsed.length) {
            localStorage.setItem(HELD_BILLS_STORAGE_KEY, JSON.stringify(cleaned));
          }
          return cleaned;
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  // Today's Billing History (purges legacy mock items)
  const [billsHistory, setBillsHistory] = useState(() => {
    try {
      const stored = localStorage.getItem(BILLS_HISTORY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(
            (b) => !b.items?.some((i) => i.id?.startsWith?.("def-") || i.product === "Classic Chocolate Fudge Cake")
          );
          if (cleaned.length !== parsed.length) {
            localStorage.setItem(BILLS_HISTORY_STORAGE_KEY, JSON.stringify(cleaned));
          }
          return cleaned;
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  // Fetch actual products & categories from Supabase
  const fetchCatalogAndCategories = async () => {
    setSyncing(true);
    setErrorBanner("");

    try {
      const [prodRes, catRes] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .order("name", { ascending: true }),
        supabase
          .from("categories")
          .select("*")
          .order("name", { ascending: true }),
      ]);

      if (prodRes.error) {
        console.warn("Products sync notice:", prodRes.error.message);
      }
      if (catRes.error) {
        console.warn("Categories sync notice:", catRes.error.message);
      }

      // Sync only real products present in database (filtered by availability)
      const availableProds = (prodRes.data || []).filter((p) => p.is_available !== false);
      setProducts(availableProds);
      setDbCategories(catRes.data || []);
      setSuccessBanner(`Catalog synced: ${availableProds.length} products, ${(catRes.data || []).length} categories.`);
      setTimeout(() => setSuccessBanner(""), 3000);
    } catch (err) {
      console.error("Catalog sync error:", err);
      setErrorBanner("Failed to sync catalog from database.");
    } finally {
      setSyncing(false);
      setLoadingProducts(false);
    }
  };

  // Initial load
  useEffect(() => {
    let ignore = false;

    const loadInitial = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          supabase
            .from("products")
            .select("*")
            .order("name", { ascending: true }),
          supabase
            .from("categories")
            .select("*")
            .order("name", { ascending: true }),
        ]);

        if (!ignore) {
          const availableProds = (prodRes.data || []).filter((p) => p.is_available !== false);
          setProducts(availableProds);
          setDbCategories(catRes.data || []);
        }
      } catch (err) {
        console.warn("Initial catalog fetch notice:", err);
        if (!ignore) {
          setProducts([]);
          setDbCategories([]);
        }
      } finally {
        if (!ignore) setLoadingProducts(false);
      }
    };

    loadInitial();

    return () => {
      ignore = true;
    };
  }, []);

  // Save held bills to localStorage
  const saveHeldBills = (updated) => {
    setHeldBills(updated);
    try {
      localStorage.setItem(HELD_BILLS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("Could not save held bills:", e);
    }
  };

  // Save billing history to localStorage
  const saveBillsHistory = (updated) => {
    setBillsHistory(updated);
    try {
      localStorage.setItem(BILLS_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("Could not save bills history:", e);
    }
  };

  // Extract categories directly from categories table & present products only
  const categories = useMemo(() => {
    const set = new Set();
    // 1. From categories table
    dbCategories.forEach((c) => {
      if (c.name) set.add(c.name.trim().toUpperCase());
    });
    // 2. From actual products
    products.forEach((p) => {
      if (p.category) set.add(p.category.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [dbCategories, products]);

  // Filtered products for quick picker
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase().trim()));

      const matchesCat =
        selectedCategory === "all" ||
        (p.category && p.category.toUpperCase() === selectedCategory.toUpperCase());

      return matchesSearch && matchesCat;
    });
  }, [products, searchQuery, selectedCategory]);

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + Number(item.price || 0) * Number(item.quantity || 1), 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    const val = Number(discountValue) || 0;
    if (val <= 0 || subtotal <= 0) return 0;
    if (discountType === "pct") {
      return Math.min(subtotal, Math.round((subtotal * val) / 100));
    }
    return Math.min(subtotal, val);
  }, [subtotal, discountType, discountValue]);

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const gstAmount = applyGst ? Math.round(taxableAmount * 0.05 * 100) / 100 : 0;
  const cgstAmount = applyGst ? Math.round((gstAmount / 2) * 100) / 100 : 0;
  const sgstAmount = applyGst ? Math.round((gstAmount / 2) * 100) / 100 : 0;
  const rawTotal = taxableAmount + gstAmount;
  const grandTotal = Math.round(rawTotal);
  const roundOff = Math.round((grandTotal - rawTotal) * 100) / 100;

  const numericTendered = Number(tenderedAmount) || 0;
  const changeDue = numericTendered > grandTotal ? numericTendered - grandTotal : 0;

  // Cart operations
  const addToCart = (product) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === product.id);
      if (existingIndex > -1) {
        return prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: Number(product.price) || 0,
          quantity: 1,
          category: product.category || "General",
        },
      ];
    });
  };

  const updateQuantity = (id, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const setDirectQuantity = (id, newQty) => {
    const parsed = parseInt(newQty, 10);
    if (isNaN(parsed) || parsed <= 0) {
      removeFromCart(id);
    } else {
      setCart((prev) =>
        prev.map((item) => (item.id === id ? { ...item, quantity: parsed } : item))
      );
    }
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = (confirm = true) => {
    if (confirm && cart.length > 0) {
      const ok = window.confirm("Clear all items from this order cart?");
      if (!ok) return;
    }
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setOrderNotes("");
    setTenderedAmount("");
    setDiscountValue("");
    setErrorBanner("");
  };

  // Add custom item
  const handleAddCustomItem = (e) => {
    e.preventDefault();
    if (!customItemForm.name.trim() || Number(customItemForm.price) <= 0) {
      alert("Please provide a valid item name and positive price.");
      return;
    }

    const newItem = {
      id: `custom-${Date.now()}`,
      name: customItemForm.name.trim(),
      price: Number(customItemForm.price),
      quantity: 1,
      category: customItemForm.category || "CUSTOM",
    };

    addToCart(newItem);
    setCustomItemForm({ name: "", price: "", category: "CUSTOM" });
    setIsCustomModalOpen(false);
  };

  // Hold current order
  const handleHoldBill = () => {
    if (cart.length === 0) {
      setErrorBanner("Cart is empty! Add items before holding.");
      return;
    }

    const billToHold = {
      holdId: `HOLD-${Date.now()}`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      customerName: customerName.trim() || "Walk-in Guest",
      customerPhone: customerPhone.trim(),
      orderType,
      cart,
      subtotal,
      grandTotal,
    };

    saveHeldBills([billToHold, ...heldBills]);
    clearCart(false);
    setSuccessBanner(`Bill saved to held queue (#${billToHold.holdId}). Counter is ready for next customer!`);
    setTimeout(() => setSuccessBanner(""), 4000);
  };

  // Recall held order
  const handleRecallBill = (holdId) => {
    const target = heldBills.find((b) => b.holdId === holdId);
    if (!target) return;

    if (cart.length > 0) {
      const ok = window.confirm("Your active cart has items. Replace it with the held bill?");
      if (!ok) return;
    }

    setCart(target.cart);
    setCustomerName(target.customerName === "Walk-in Guest" ? "" : target.customerName);
    setCustomerPhone(target.customerPhone || "");
    setOrderType(target.orderType || "Takeaway");

    saveHeldBills(heldBills.filter((b) => b.holdId !== holdId));
    setSuccessBanner(`Restored held bill for ${target.customerName}.`);
    setTimeout(() => setSuccessBanner(""), 3000);
  };

  const handleDiscardHeldBill = (holdId) => {
    saveHeldBills(heldBills.filter((b) => b.holdId !== holdId));
  };

  // Generate & Save Bill
  const handleCheckoutAndGenerateBill = async (shouldPrint = true) => {
    if (cart.length === 0) {
      setErrorBanner("Please add at least one product to the bill.");
      return;
    }

    setSubmittingBill(true);
    setErrorBanner("");

    const invoiceNumber = generateInvoiceNumber();
    const finalCustomerName = customerName.trim() || "Walk-in Customer";
    const finalCustomerPhone = customerPhone.trim() || "9999999999";
    const billTimestamp = new Date().toISOString();

    const formattedItems = cart.map((item) => ({
      product: item.name,
      price: item.price,
      quantity: item.quantity,
      line_total: item.price * item.quantity,
      category: item.category,
    }));

    const billData = {
      invoiceNumber,
      customerName: finalCustomerName,
      customerPhone: finalCustomerPhone,
      orderType,
      items: formattedItems,
      subtotal,
      discountType,
      discountValue: Number(discountValue) || 0,
      discountAmount,
      taxableAmount,
      gstAmount,
      cgstAmount,
      sgstAmount,
      roundOff,
      totalAmount: grandTotal,
      paymentMethod,
      tenderedAmount: numericTendered > 0 ? numericTendered : grandTotal,
      changeDue: changeDue,
      orderNotes: orderNotes.trim(),
      cashier: adminEmail,
      createdAt: billTimestamp,
    };

    try {
      // 1. Insert into Supabase 'orders' table
      const { data: insertedOrder, error: insertErr } = await supabase
        .from("orders")
        .insert([
          {
            customer_name: finalCustomerName,
            phone: finalCustomerPhone,
            address: `Counter Sale (${orderType})`,
            items: formattedItems,
            total_amount: grandTotal,
            payment_method: paymentMethod,
            order_status: "Delivered", // Immediately fulfilled at the counter
            notes: `POS Bill: ${invoiceNumber} | Cashier: ${adminEmail} | Type: ${orderType}${
              orderNotes.trim() ? ` | Notes: ${orderNotes.trim()}` : ""
            }`,
          },
        ])
        .select()
        .maybeSingle();

      if (insertErr) {
        console.warn("Could not insert order into Supabase, saving to local POS registry:", insertErr);
      }

      const completedRecord = {
        ...billData,
        orderId: insertedOrder?.id || `LOCAL-${Date.now()}`,
      };

      // 2. Save in local bills registry
      saveBillsHistory([completedRecord, ...billsHistory]);

      // 3. Clear cart & show receipt
      clearCart(false);
      setActiveReceipt(completedRecord);
      setSuccessBanner(`Bill ${invoiceNumber} generated successfully!`);
      setTimeout(() => setSuccessBanner(""), 4000);

      if (shouldPrint) {
        setTimeout(() => {
          window.print();
        }, 300);
      }
    } catch (err) {
      console.error("Billing processing error:", err);
      const offlineRecord = {
        ...billData,
        orderId: `LOCAL-${Date.now()}`,
      };
      saveBillsHistory([offlineRecord, ...billsHistory]);
      clearCart(false);
      setActiveReceipt(offlineRecord);
      setSuccessBanner(`Bill ${invoiceNumber} recorded locally.`);
    } finally {
      setSubmittingBill(false);
    }
  };

  // Quick tender amount helpers
  const handleQuickTender = (amt) => {
    setTenderedAmount(String(amt));
  };

  return (
    <div className="billing-page">
      {/* Top Header */}
      <div className="billing-header no-print">
        <div className="billing-header-left">
          <div className="billing-title-row">
            <h1>Bakery Billing & POS Terminal</h1>
            <span className="billing-badge">Walk-In & Counter</span>
          </div>
          <p>Live synchronized counter register with your products and categories catalog.</p>
        </div>

        <div className="billing-header-actions">
          <div className="billing-tab-pills">
            <button
              type="button"
              className={`billing-tab-btn ${activeTab === "pos" ? "active" : ""}`}
              onClick={() => setActiveTab("pos")}
            >
              🛒 Counter Terminal
            </button>
            <button
              type="button"
              className={`billing-tab-btn ${activeTab === "register" ? "active" : ""}`}
              onClick={() => setActiveTab("register")}
            >
              📑 Today's Sales Register ({billsHistory.length})
            </button>
          </div>

          <button
            type="button"
            className="billing-btn billing-btn-secondary"
            onClick={() => navigate("/admin/orders")}
          >
            📦 All Orders
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorBanner && (
        <div className="billing-banner billing-banner-error no-print">
          <span>⚠️ {errorBanner}</span>
          <button type="button" onClick={() => setErrorBanner("")}>✕</button>
        </div>
      )}

      {successBanner && (
        <div className="billing-banner billing-banner-success no-print">
          <span>✓ {successBanner}</span>
          <button type="button" onClick={() => setSuccessBanner("")}>✕</button>
        </div>
      )}

      {/* TAB 1: Counter Terminal (Split Screen) */}
      {activeTab === "pos" && (
        <div className="billing-pos-container no-print">
          {/* LEFT: Product Catalog & Quick Picker */}
          <div className="billing-catalog-section">
            <div className="billing-catalog-toolbar">
              {/* Search */}
              <div className="billing-search-box">
                <input
                  type="text"
                  placeholder="🔍 Search items by name or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery("")}>✕</button>
                )}
              </div>

              {/* Sync Catalog Button */}
              <button
                type="button"
                className="billing-btn billing-btn-secondary billing-btn-sync"
                onClick={fetchCatalogAndCategories}
                disabled={syncing}
                title="Sync products and categories from database"
              >
                🔄 {syncing ? "Syncing..." : "Sync"}
              </button>

              {/* Add Custom Item Button */}
              <button
                type="button"
                className="billing-btn billing-btn-custom-item"
                onClick={() => setIsCustomModalOpen(true)}
                title="Add a custom item or bespoke cake"
              >
                + Custom Item
              </button>
            </div>

            {/* Category Filter Pills (synchronized with categories table) */}
            {categories.length > 0 && (
              <div className="billing-category-pills">
                <button
                  type="button"
                  className={`billing-cat-pill ${selectedCategory === "all" ? "active" : ""}`}
                  onClick={() => setSelectedCategory("all")}
                >
                  All Items ({products.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`billing-cat-pill ${selectedCategory === cat ? "active" : ""}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Product Cards Grid or Empty State */}
            {loadingProducts ? (
              <div className="billing-catalog-loading">
                <span>⏳ Loading bakery catalog...</span>
              </div>
            ) : products.length === 0 ? (
              <div className="billing-catalog-empty-store">
                <span className="billing-empty-store-icon">🧁</span>
                <h3>Your Product Catalog is Empty</h3>
                <p>
                  No products found in your bakery catalog. Add your cakes, breads, pastries, and items in <strong>Products</strong> and <strong>Categories</strong> to begin counter billing.
                </p>
                <div className="billing-empty-store-actions">
                  <button
                    type="button"
                    className="billing-btn billing-btn-primary"
                    onClick={() => navigate("/admin/products")}
                  >
                    🍰 Manage Products
                  </button>
                  <button
                    type="button"
                    className="billing-btn billing-btn-secondary"
                    onClick={() => navigate("/admin/categories")}
                  >
                    🏷️ Manage Categories
                  </button>
                  <button
                    type="button"
                    className="billing-btn billing-btn-secondary"
                    onClick={fetchCatalogAndCategories}
                    disabled={syncing}
                  >
                    🔄 {syncing ? "Syncing..." : "Sync Catalog"}
                  </button>
                </div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="billing-catalog-empty">
                <span>🔍 No items match your search "{searchQuery}".</span>
                <button
                  type="button"
                  className="billing-btn billing-btn-secondary"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                  }}
                >
                  Reset Filter
                </button>
              </div>
            ) : (
              <div className="billing-products-grid">
                {filteredProducts.map((p) => {
                  const inCartItem = cart.find((i) => i.id === p.id);
                  return (
                    <div
                      key={p.id}
                      className={`billing-product-card ${inCartItem ? "in-cart" : ""}`}
                      onClick={() => addToCart(p)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") addToCart(p);
                      }}
                    >
                      <div className="billing-product-card-top">
                        <span className="billing-product-cat-tag">{p.category || "General"}</span>
                        {inCartItem && (
                          <span className="billing-product-qty-badge">
                            ×{inCartItem.quantity}
                          </span>
                        )}
                      </div>
                      <h4 className="billing-product-name">{p.name}</h4>
                      <div className="billing-product-card-bottom">
                        <span className="billing-product-price">₹{Number(p.price).toLocaleString("en-IN")}</span>
                        <button
                          type="button"
                          className="billing-product-add-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(p);
                          }}
                          title="Add item"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: Live POS Terminal / Order Bill Summary */}
          <div className="billing-terminal-section">
            {/* Terminal Header */}
            <div className="billing-terminal-header">
              <div className="billing-terminal-title">
                <h3>Current Bill</h3>
                <span className="billing-items-count">({cart.length} items)</span>
              </div>

              <div className="billing-terminal-quick-actions">
                {heldBills.length > 0 && (
                  <span className="billing-held-badge" title="Bills on hold">
                    ⏸️ {heldBills.length} Held
                  </span>
                )}
                {cart.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="billing-btn-tiny"
                      onClick={handleHoldBill}
                      title="Hold this bill and take next customer"
                    >
                      ⏸️ Hold
                    </button>
                    <button
                      type="button"
                      className="billing-btn-tiny billing-btn-tiny-danger"
                      onClick={() => clearCart(true)}
                      title="Clear bill"
                    >
                      🧹 Clear
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Customer Inputs */}
            <div className="billing-customer-bar">
              <div className="billing-customer-field">
                <label>Customer Name</label>
                <input
                  type="text"
                  placeholder="Walk-in Guest"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              <div className="billing-customer-field">
                <label>Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>

              <div className="billing-customer-field full-width">
                <label>Order Type</label>
                <div className="billing-type-pills">
                  {[
                    { id: "Takeaway", label: "🥡 Takeaway" },
                    { id: "Dine-in", label: "🍽️ Dine-in" },
                    { id: "Counter Pickup", label: "🛍️ Pickup" },
                    { id: "Home Delivery", label: "🛵 Delivery" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`billing-type-pill ${orderType === t.id ? "active" : ""}`}
                      onClick={() => setOrderType(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Cart Items Table */}
            <div className="billing-cart-table-wrapper">
              {cart.length === 0 ? (
                <div className="billing-cart-empty">
                  <span className="billing-cart-empty-icon">🧾</span>
                  <h4>Terminal Empty</h4>
                  <p>
                    {products.length === 0
                      ? "Use '+ Custom Item' above to bill custom items, or add products in Products management."
                      : "Click any item on the menu catalog to start building customer bill."}
                  </p>
                </div>
              ) : (
                <table className="billing-cart-table">
                  <thead>
                    <tr>
                      <th style={{ width: "42%" }}>Item</th>
                      <th style={{ textAlign: "center", width: "28%" }}>Qty</th>
                      <th style={{ textAlign: "right", width: "20%" }}>Price</th>
                      <th style={{ textAlign: "center", width: "10%" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="billing-item-name">{item.name}</div>
                          <div className="billing-item-unit-rate">₹{item.price} each</div>
                        </td>
                        <td>
                          <div className="billing-qty-stepper">
                            <button
                              type="button"
                              className="billing-stepper-btn"
                              onClick={() => updateQuantity(item.id, -1)}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              className="billing-qty-input"
                              value={item.quantity}
                              onChange={(e) => setDirectQuantity(item.id, e.target.value)}
                              min="1"
                            />
                            <button
                              type="button"
                              className="billing-stepper-btn"
                              onClick={() => updateQuantity(item.id, 1)}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="billing-remove-btn"
                            onClick={() => removeFromCart(item.id)}
                            title="Remove item"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Bill Summary, Taxes, Discount & Payments */}
            {cart.length > 0 && (
              <div className="billing-footer-section">
                {/* Discount & GST Controls */}
                <div className="billing-discounts-row">
                  <div className="billing-discount-group">
                    <span className="billing-ctrl-label">Discount:</span>
                    <input
                      type="number"
                      placeholder="0"
                      min="0"
                      className="billing-discount-input"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                    />
                    <select
                      className="billing-discount-select"
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value)}
                    >
                      <option value="flat">₹ Flat</option>
                      <option value="pct">% Off</option>
                    </select>
                  </div>

                  <label className="billing-gst-toggle" title="Apply standard 5% bakery confection tax">
                    <input
                      type="checkbox"
                      checked={applyGst}
                      onChange={(e) => setApplyGst(e.target.checked)}
                    />
                    <span>5% GST (CGST+SGST)</span>
                  </label>
                </div>

                {/* Totals Breakdown */}
                <div className="billing-totals-box">
                  <div className="billing-total-line">
                    <span>Items Subtotal:</span>
                    <span>₹{subtotal.toLocaleString("en-IN")}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="billing-total-line discount">
                      <span>Discount ({discountType === "pct" ? `${discountValue}%` : "Flat"}):</span>
                      <span>− ₹{discountAmount.toLocaleString("en-IN")}</span>
                    </div>
                  )}

                  {applyGst && (
                    <>
                      <div className="billing-total-line tax">
                        <span>CGST (2.5%):</span>
                        <span>+ ₹{cgstAmount.toFixed(2)}</span>
                      </div>
                      <div className="billing-total-line tax">
                        <span>SGST (2.5%):</span>
                        <span>+ ₹{sgstAmount.toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  {roundOff !== 0 && (
                    <div className="billing-total-line roundoff">
                      <span>Round Off:</span>
                      <span>{roundOff > 0 ? `+ ₹${roundOff}` : `− ₹${Math.abs(roundOff)}`}</span>
                    </div>
                  )}

                  <div className="billing-grand-total-row">
                    <span>GRAND TOTAL</span>
                    <span className="billing-grand-amount">₹{grandTotal.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="billing-payment-modes">
                  <button
                    type="button"
                    className={`billing-pay-pill ${paymentMethod === "Cash" ? "active" : ""}`}
                    onClick={() => setPaymentMethod("Cash")}
                  >
                    💵 Cash
                  </button>
                  <button
                    type="button"
                    className={`billing-pay-pill ${paymentMethod === "UPI / QR" ? "active" : ""}`}
                    onClick={() => setPaymentMethod("UPI / QR")}
                  >
                    📱 UPI / QR
                  </button>
                  <button
                    type="button"
                    className={`billing-pay-pill ${paymentMethod === "Card" ? "active" : ""}`}
                    onClick={() => setPaymentMethod("Card")}
                  >
                    💳 Card
                  </button>
                </div>

                {/* Cash Tender & Change Calculator */}
                {paymentMethod === "Cash" && (
                  <div className="billing-cash-tender-box">
                    <div className="billing-tender-inputs">
                      <div className="billing-tender-field">
                        <label>Tendered Cash (₹)</label>
                        <input
                          type="number"
                          placeholder={`Exact ₹${grandTotal}`}
                          value={tenderedAmount}
                          onChange={(e) => setTenderedAmount(e.target.value)}
                        />
                      </div>
                      <div className="billing-tender-field">
                        <label>Change Return</label>
                        <div className={`billing-change-display ${changeDue > 0 ? "has-change" : ""}`}>
                          ₹{changeDue.toLocaleString("en-IN")}
                        </div>
                      </div>
                    </div>

                    {/* Quick Cash Buttons */}
                    <div className="billing-quick-cash-pills">
                      <button type="button" onClick={() => handleQuickTender(grandTotal)}>
                        Exact
                      </button>
                      <button type="button" onClick={() => handleQuickTender(Math.ceil(grandTotal / 100) * 100)}>
                        ₹{Math.ceil(grandTotal / 100) * 100}
                      </button>
                      <button type="button" onClick={() => handleQuickTender(500)}>
                        ₹500
                      </button>
                      <button type="button" onClick={() => handleQuickTender(1000)}>
                        ₹1000
                      </button>
                    </div>
                  </div>
                )}

                {/* Order Notes Field */}
                <input
                  type="text"
                  className="billing-notes-input"
                  placeholder="Optional customer instruction or packing note..."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                />

                {/* Primary Action Buttons */}
                <div className="billing-checkout-actions">
                  <button
                    type="button"
                    className="billing-checkout-btn print"
                    onClick={() => handleCheckoutAndGenerateBill(true)}
                    disabled={submittingBill}
                  >
                    {submittingBill ? "Processing..." : "⚡ Complete & Print Bill"}
                  </button>

                  <button
                    type="button"
                    className="billing-checkout-btn save"
                    onClick={() => handleCheckoutAndGenerateBill(false)}
                    disabled={submittingBill}
                    title="Complete sale and save without printing receipt"
                  >
                    💾 Save Only
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Sales Register & Past Bills */}
      {activeTab === "register" && (
        <div className="billing-register-section no-print">
          <div className="billing-register-stats-grid">
            <div className="billing-register-stat">
              <span className="stat-label">Bills Generated Today</span>
              <span className="stat-value">{billsHistory.length}</span>
            </div>
            <div className="billing-register-stat">
              <span className="stat-label">Total Counter Sales</span>
              <span className="stat-value" style={{ color: "#2e7d32" }}>
                ₹{billsHistory.reduce((s, b) => s + (b.totalAmount || 0), 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="billing-register-stat">
              <span className="stat-label">Cash Collected</span>
              <span className="stat-value">
                ₹{billsHistory
                  .filter((b) => b.paymentMethod === "Cash")
                  .reduce((s, b) => s + (b.totalAmount || 0), 0)
                  .toLocaleString("en-IN")}
              </span>
            </div>
            <div className="billing-register-stat">
              <span className="stat-label">UPI / Digital Payments</span>
              <span className="stat-value" style={{ color: "#1565c0" }}>
                ₹{billsHistory
                  .filter((b) => b.paymentMethod !== "Cash")
                  .reduce((s, b) => s + (b.totalAmount || 0), 0)
                  .toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <div className="billing-register-table-wrapper">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0 }}>Recent Counter Receipts</h3>
              {billsHistory.length > 0 && (
                <button
                  type="button"
                  className="billing-btn billing-btn-secondary"
                  style={{ fontSize: "12px", padding: "6px 12px" }}
                  onClick={() => {
                    if (window.confirm("Clear today's counter receipts log?")) {
                      saveBillsHistory([]);
                    }
                  }}
                >
                  Clear Register History
                </button>
              )}
            </div>

            {billsHistory.length === 0 ? (
              <div className="billing-register-empty">
                <p>No counter bills recorded today yet.</p>
              </div>
            ) : (
              <table className="billing-register-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Time</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Mode</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                    <th style={{ textAlign: "center" }}>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {billsHistory.map((bill) => (
                    <tr key={bill.invoiceNumber}>
                      <td className="invoice-cell">
                        <strong>{bill.invoiceNumber}</strong>
                      </td>
                      <td>{new Date(bill.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                      <td>
                        <strong>{bill.customerName}</strong>
                        {bill.customerPhone && <div className="phone-sub">{bill.customerPhone}</div>}
                      </td>
                      <td>
                        {bill.items.map((i) => `${i.product} (×${i.quantity})`).join(", ")}
                      </td>
                      <td>
                        <span className={`billing-payment-tag ${bill.paymentMethod.toLowerCase().replace(/[^a-z]/g, "")}`}>
                          {bill.paymentMethod}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#2e7d32" }}>
                        ₹{bill.totalAmount.toLocaleString("en-IN")}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="billing-reprint-btn"
                          onClick={() => setActiveReceipt(bill)}
                        >
                          🖨️ View Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Held Bills Bottom Drawer */}
      {heldBills.length > 0 && activeTab === "pos" && (
        <div className="billing-held-bar no-print">
          <div className="billing-held-header">
            <span>⏸️ Held Orders Queue ({heldBills.length})</span>
          </div>
          <div className="billing-held-list">
            {heldBills.map((b) => (
              <div key={b.holdId} className="billing-held-card">
                <div className="held-info">
                  <strong>{b.customerName}</strong>
                  <span>{b.time} • ₹{b.grandTotal}</span>
                </div>
                <div className="held-actions">
                  <button
                    type="button"
                    className="billing-btn-tiny"
                    onClick={() => handleRecallBill(b.holdId)}
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    className="billing-btn-tiny billing-btn-tiny-danger"
                    onClick={() => handleDiscardHeldBill(b.holdId)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: Custom Item Dialog */}
      {isCustomModalOpen && (
        <div className="billing-modal-backdrop no-print">
          <div className="billing-modal-box">
            <div className="billing-modal-header">
              <h3>+ Add Custom Item</h3>
              <button type="button" onClick={() => setIsCustomModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleAddCustomItem} className="billing-custom-form">
              <div className="billing-form-field">
                <label>Item Name / Description *</label>
                <input
                  type="text"
                  placeholder="e.g. 1kg Belgian Truffle Cake with Custom Message"
                  value={customItemForm.name}
                  onChange={(e) => setCustomItemForm({ ...customItemForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="billing-form-field">
                <label>Price (₹) *</label>
                <input
                  type="number"
                  placeholder="e.g. 850"
                  min="1"
                  step="1"
                  value={customItemForm.price}
                  onChange={(e) => setCustomItemForm({ ...customItemForm, price: e.target.value })}
                  required
                />
              </div>

              <div className="billing-form-field">
                <label>Category</label>
                <input
                  type="text"
                  placeholder="CUSTOM"
                  value={customItemForm.category}
                  onChange={(e) => setCustomItemForm({ ...customItemForm, category: e.target.value })}
                />
              </div>

              <div className="billing-modal-actions">
                <button
                  type="button"
                  className="billing-btn billing-btn-secondary"
                  onClick={() => setIsCustomModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="billing-btn billing-btn-primary">
                  Add to Cart
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Authentic Printable Thermal Receipt */}
      {activeReceipt && (
        <div className="billing-modal-backdrop receipt-backdrop">
          <div className="billing-receipt-modal-container">
            {/* Modal Controls (Not Printed) */}
            <div className="billing-receipt-actions-bar no-print">
              <button
                type="button"
                className="billing-btn billing-btn-primary"
                onClick={() => window.print()}
              >
                🖨️ Print Receipt
              </button>
              <button
                type="button"
                className="billing-btn billing-btn-secondary"
                onClick={() => setActiveReceipt(null)}
              >
                ✕ Close
              </button>
            </div>

            {/* PRINTABLE THERMAL RECEIPT AREA */}
            <div className="billing-thermal-receipt" id="printable-receipt">
              <div className="receipt-header">
                <div className="receipt-logo">🥖</div>
                <h2 className="receipt-store-name">THE GOLDEN CRUST</h2>
                <p className="receipt-store-tagline">Artisan Bakery & Fresh Confections</p>
                <p className="receipt-store-address">
                  42 Heritage High Street, Baker's Square<br />
                  Phone: +91 98765 43210 • FSSAI Lic #10020043000189
                </p>
              </div>

              <div className="receipt-divider">================================</div>

              <div className="receipt-meta">
                <div className="meta-row">
                  <span>INVOICE:</span>
                  <strong>{activeReceipt.invoiceNumber}</strong>
                </div>
                <div className="meta-row">
                  <span>DATE/TIME:</span>
                  <span>{new Date(activeReceipt.createdAt).toLocaleString("en-IN")}</span>
                </div>
                <div className="meta-row">
                  <span>CUSTOMER:</span>
                  <span>{activeReceipt.customerName}</span>
                </div>
                {activeReceipt.customerPhone && (
                  <div className="meta-row">
                    <span>PHONE:</span>
                    <span>{activeReceipt.customerPhone}</span>
                  </div>
                )}
                <div className="meta-row">
                  <span>ORDER TYPE:</span>
                  <span>{activeReceipt.orderType}</span>
                </div>
                <div className="meta-row">
                  <span>CASHIER:</span>
                  <span>{activeReceipt.cashier}</span>
                </div>
              </div>

              <div className="receipt-divider">--------------------------------</div>

              {/* Items List */}
              <table className="receipt-items-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>ITEM</th>
                    <th style={{ textAlign: "center" }}>QTY</th>
                    <th style={{ textAlign: "right" }}>RATE</th>
                    <th style={{ textAlign: "right" }}>AMT</th>
                  </tr>
                </thead>
                <tbody>
                  {activeReceipt.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="item-name-cell">{item.product}</td>
                      <td style={{ textAlign: "center" }}>{item.quantity}</td>
                      <td style={{ textAlign: "right" }}>₹{item.price}</td>
                      <td style={{ textAlign: "right" }}>₹{item.line_total || item.price * item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="receipt-divider">--------------------------------</div>

              {/* Totals */}
              <div className="receipt-totals">
                <div className="total-row">
                  <span>Subtotal:</span>
                  <span>₹{activeReceipt.subtotal.toLocaleString("en-IN")}</span>
                </div>

                {activeReceipt.discountAmount > 0 && (
                  <div className="total-row">
                    <span>Discount:</span>
                    <span>− ₹{activeReceipt.discountAmount.toLocaleString("en-IN")}</span>
                  </div>
                )}

                {activeReceipt.gstAmount > 0 && (
                  <>
                    <div className="total-row">
                      <span>CGST (2.5%):</span>
                      <span>₹{activeReceipt.cgstAmount.toFixed(2)}</span>
                    </div>
                    <div className="total-row">
                      <span>SGST (2.5%):</span>
                      <span>₹{activeReceipt.sgstAmount.toFixed(2)}</span>
                    </div>
                  </>
                )}

                {activeReceipt.roundOff !== 0 && (
                  <div className="total-row">
                    <span>Round Off:</span>
                    <span>{activeReceipt.roundOff > 0 ? `+ ₹${activeReceipt.roundOff}` : `− ₹${Math.abs(activeReceipt.roundOff)}`}</span>
                  </div>
                )}

                <div className="receipt-divider">================================</div>

                <div className="total-row grand">
                  <span>NET PAYABLE:</span>
                  <span className="grand-val">₹{activeReceipt.totalAmount.toLocaleString("en-IN")}</span>
                </div>

                <div className="receipt-divider">================================</div>

                <div className="total-row">
                  <span>PAYMENT MODE:</span>
                  <strong>{activeReceipt.paymentMethod}</strong>
                </div>

                {activeReceipt.paymentMethod === "Cash" && (
                  <>
                    <div className="total-row">
                      <span>Cash Tendered:</span>
                      <span>₹{activeReceipt.tenderedAmount.toLocaleString("en-IN")}</span>
                    </div>
                    {activeReceipt.changeDue > 0 && (
                      <div className="total-row">
                        <span>Change Returned:</span>
                        <span>₹{activeReceipt.changeDue.toLocaleString("en-IN")}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {activeReceipt.orderNotes && (
                <div className="receipt-notes">
                  Note: {activeReceipt.orderNotes}
                </div>
              )}

              <div className="receipt-footer">
                <p>*** THANK YOU FOR VISITING! ***</p>
                <p>Baked Fresh Daily With Traditional Passion</p>
                <p>Visit us: thegoldencrust.com</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Billing;
