import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../styles/Products.css";

// Bakery starters to populate if empty
const BAKERY_SAMPLE_PRODUCTS = [
  {
    name: "Classic Chocolate Fudge Cake",
    description: "Rich, multi-layered Belgian chocolate cake with velvety dark chocolate ganache frosting.",
    price: 650,
    category: "CAKES",
    is_available: true,
  },
  {
    name: "French Butter Croissant",
    description: "Flaky, golden-brown all-butter layered croissant baked fresh daily with Normandy butter.",
    price: 95,
    category: "PASTRIES",
    is_available: true,
  },
  {
    name: "Blueberry Glazed Danish",
    description: "Crispy puff pastry filled with creamy vanilla custard and organic wild blueberry compote.",
    price: 130,
    category: "PASTRIES",
    is_available: true,
  },
  {
    name: "Rustic Sourdough Boule",
    description: "Naturally fermented 36-hour sourdough loaf with a thick crunchy crust and airy crumb.",
    price: 180,
    category: "BREADS",
    is_available: true,
  },
  {
    name: "Triple Chocolate Chunk Cookies",
    description: "Soft-baked gourmet cookies loaded with dark, milk, and white chocolate chunks.",
    price: 120,
    category: "COOKIES",
    is_available: true,
  },
];

function Products() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [updatingAvailability, setUpdatingAvailability] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'available' | 'unavailable'
  const [sortBy, setSortBy] = useState("newest");

  // Local image preview URL
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

  const emptyForm = {
    name: "",
    description: "",
    price: "",
    category: "",
    image: null,
  };

  const [form, setForm] = useState(emptyForm);

  // Fetch products
  const fetchProducts = async () => {
    setLoading(true);
    const { data, error: prodErr } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (prodErr) {
      setError(prodErr.message);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  // Fetch categories
  const fetchCategories = async () => {
    setCategoriesLoading(true);
    const { data, error: catErr } = await supabase
      .from("categories")
      .select("*")
      .order("name", { ascending: true });

    if (catErr) {
      console.error("Categories error:", catErr.message);
    } else {
      setCategories(data || []);
    }
    setCategoriesLoading(false);
  };

  // Refresh all products and categories
  const refreshAll = async () => {
    await Promise.all([fetchProducts(), fetchCategories()]);
  };

  // Initial load
  useEffect(() => {
    let ignore = false;

    const loadAll = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          supabase
            .from("products")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("categories")
            .select("*")
            .order("name", { ascending: true }),
        ]);

        if (!ignore) {
          if (prodRes.error) setError(prodRes.error.message);
          else setProducts(prodRes.data || []);

          if (catRes.error) console.error("Categories load failed:", catRes.error.message);
          else setCategories(catRes.data || []);
        }
      } catch (err) {
        if (!ignore) setError(err.message || "Failed to load products.");
      } finally {
        if (!ignore) {
          setLoading(false);
          setCategoriesLoading(false);
        }
      }
    };

    loadAll();

    return () => {
      ignore = true;
    };
  }, []);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // Handle image file selection with preview
  const handleImageChange = (e) => {
    const file = e.target.files?.[0] || null;
    setForm((prev) => ({ ...prev, image: file }));

    if (file) {
      const preview = URL.createObjectURL(file);
      setImagePreviewUrl(preview);
    } else {
      setImagePreviewUrl(null);
    }
  };

  const clearSelectedImage = () => {
    setForm((prev) => ({ ...prev, image: null }));
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
  };

  const getStoragePath = (imageUrl) => {
    const marker = "/product-images/";
    if (!imageUrl || !imageUrl.includes(marker)) {
      return null;
    }
    return decodeURIComponent(imageUrl.split(marker)[1].split("?")[0]);
  };

  // Add or update product
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      let imageUrl = null;
      const existingProduct = products.find((p) => p.id === editingId);

      if (form.image) {
        const fileExt = form.image.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `products/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(filePath, form.image);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("product-images")
          .getPublicUrl(filePath);

        imageUrl = publicUrlData.publicUrl;
      } else if (editingId) {
        imageUrl = existingProduct?.image_url || null;
      }

      const productData = {
        name: form.name.trim(),
        description: form.description ? form.description.trim() : "",
        price: Number(form.price),
        category: form.category,
        image_url: imageUrl,
      };

      let result;
      if (editingId) {
        result = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingId);
      } else {
        result = await supabase
          .from("products")
          .insert([productData]);
      }

      if (result.error) throw result.error;

      // Remove old image if replaced
      if (form.image && existingProduct?.image_url) {
        const oldPath = getStoragePath(existingProduct.image_url);
        if (oldPath) {
          await supabase.storage.from("product-images").remove([oldPath]);
        }
      }

      setSuccess(
        editingId ? "Product updated successfully!" : "Product added successfully!"
      );

      clearSelectedImage();
      setForm(emptyForm);
      setEditingId(null);
      setIsFormOpen(false);
      await fetchProducts();
    } catch (err) {
      if (err.code === "42501" || err.message?.includes("security policy")) {
        setError(
          "Permission denied: Please ensure you are logged in as an administrator to save products."
        );
      } else {
        setError(err.message || "Something went wrong.");
      }
    } finally {
      setSaving(false);
    }
  };

  // Toggle product availability
  const handleToggleAvailability = async (product) => {
    setError("");
    const newAvailability = product.is_available === false ? true : false;
    setUpdatingAvailability(product.id);

    try {
      const { error: updateErr } = await supabase
        .from("products")
        .update({ is_available: newAvailability })
        .eq("id", product.id);

      if (updateErr) throw updateErr;

      setProducts((prev) =>
        prev.map((item) =>
          item.id === product.id ? { ...item, is_available: newAvailability } : item
        )
      );

      setSuccess(
        `"${product.name}" is now ${newAvailability ? "Available" : "Unavailable"}.`
      );
    } catch (err) {
      if (err.code === "42501" || err.message?.includes("security policy")) {
        setError("Permission denied: Admin login required to change availability.");
      } else {
        setError(err.message || "Unable to update availability.");
      }
    } finally {
      setUpdatingAvailability(null);
    }
  };

  // Edit product
  const handleEdit = (product) => {
    setForm({
      name: product.name,
      description: product.description || "",
      price: product.price,
      category: product.category,
      image: null,
    });
    setImagePreviewUrl(product.image_url || null);
    setEditingId(product.id);
    setIsFormOpen(true);
    setError("");
    setSuccess("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Delete product image
  const handleDeleteImage = async (product) => {
    const confirmed = window.confirm(`Delete the image for "${product.name}"?`);
    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const imagePath = getStoragePath(product.image_url);
      if (imagePath) {
        await supabase.storage.from("product-images").remove([imagePath]);
      }

      const { error: dbError } = await supabase
        .from("products")
        .update({ image_url: null })
        .eq("id", product.id);

      if (dbError) throw dbError;

      setProducts((prev) =>
        prev.map((item) =>
          item.id === product.id ? { ...item, image_url: null } : item
        )
      );

      if (editingId === product.id) {
        clearSelectedImage();
      }

      setSuccess("Product image removed successfully!");
    } catch (err) {
      setError(err.message || "Unable to delete image.");
    }
  };

  // Delete entire product
  const handleDelete = async (id) => {
    const product = products.find((p) => p.id === id);
    const confirmed = window.confirm(
      `Are you sure you want to delete "${product?.name || "this product"}"?`
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const { error: delErr } = await supabase
        .from("products")
        .delete()
        .eq("id", id);

      if (delErr) throw delErr;

      if (product?.image_url) {
        const imagePath = getStoragePath(product.image_url);
        if (imagePath) {
          await supabase.storage.from("product-images").remove([imagePath]);
        }
      }

      setSuccess("Product deleted successfully!");
      if (editingId === id) {
        cancelEdit();
      }
      await fetchProducts();
    } catch (err) {
      if (err.code === "42501" || err.message?.includes("security policy")) {
        setError("Permission denied: Admin login required to delete products.");
      } else {
        setError(err.message || "Unable to delete product.");
      }
    }
  };

  // Cancel edit
  const cancelEdit = () => {
    clearSelectedImage();
    setForm(emptyForm);
    setEditingId(null);
    setIsFormOpen(false);
    setError("");
    setSuccess("");
  };

  // Seed sample products
  const handleSeedProducts = async () => {
    const confirmed = window.confirm(
      "Load standard bakery menu items (Cakes, Pastries, Breads, Cookies) into products?"
    );
    if (!confirmed) return;

    setSeeding(true);
    setError("");
    setSuccess("");

    try {
      const { error: seedErr } = await supabase
        .from("products")
        .insert(BAKERY_SAMPLE_PRODUCTS);

      if (seedErr) throw seedErr;

      setSuccess("Sample bakery products loaded successfully!");
      await fetchProducts();
    } catch (err) {
      if (err.code === "42501" || err.message?.includes("security policy")) {
        setError("Permission denied: Admin login required to seed products.");
      } else {
        setError(err.message || "Failed to load sample products.");
      }
    } finally {
      setSeeding(false);
    }
  };

  // Stats computation
  const stats = useMemo(() => {
    let availableCount = 0;
    let unavailableCount = 0;
    const catSet = new Set();

    products.forEach((p) => {
      if (p.is_available === false) {
        unavailableCount += 1;
      } else {
        availableCount += 1;
      }
      if (p.category) catSet.add(p.category);
    });

    return {
      total: products.length,
      available: availableCount,
      unavailable: unavailableCount,
      categoriesCount: catSet.size,
    };
  }, [products]);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (selectedCategory !== "all") {
      list = list.filter((p) => p.category === selectedCategory);
    }

    // Status filter
    if (statusFilter === "available") {
      list = list.filter((p) => p.is_available !== false);
    } else if (statusFilter === "unavailable") {
      list = list.filter((p) => p.is_available === false);
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === "name_asc") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "name_desc") {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === "price_asc") {
        return Number(a.price) - Number(b.price);
      }
      if (sortBy === "price_desc") {
        return Number(b.price) - Number(a.price);
      }
      if (sortBy === "newest") {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      return 0;
    });

    return list;
  }, [products, searchQuery, selectedCategory, statusFilter, sortBy]);

  return (
    <div className="products-page">
      {/* Header */}
      <div className="products-header">
        <div className="products-header-left">
          <h1>Product Management</h1>
          <p>Create, price, and curate fresh bakery items for your online storefront.</p>
        </div>

        <div className="products-header-actions">
          <button
            type="button"
            className="products-btn products-btn-secondary"
            onClick={() => navigate("/admin/dashboard")}
          >
            ← Back to Dashboard
          </button>

          <button
            type="button"
            className="products-btn products-btn-secondary"
            onClick={refreshAll}
            disabled={loading}
          >
            🔄 {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            className="products-btn products-btn-primary"
            onClick={() => {
              if (isFormOpen && !editingId) {
                cancelEdit();
              } else {
                setForm(emptyForm);
                setEditingId(null);
                setImagePreviewUrl(null);
                setIsFormOpen(true);
              }
            }}
          >
            {isFormOpen && !editingId ? "✕ Close Form" : "+ Add New Product"}
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {success && (
        <div className="products-banner products-banner-success">
          <span>✓ {success}</span>
          <button
            className="products-banner-close"
            onClick={() => setSuccess("")}
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="products-banner products-banner-error">
          <span>⚠️ {error}</span>
          <button
            className="products-banner-close"
            onClick={() => setError("")}
          >
            ✕
          </button>
        </div>
      )}

      {/* Metrics / Stats Cards */}
      <div className="products-stats-grid">
        <div
          className={`products-stat-card ${statusFilter === "all" && selectedCategory === "all" ? "active-filter" : ""}`}
          onClick={() => {
            setStatusFilter("all");
            setSelectedCategory("all");
          }}
        >
          <div className="products-stat-header">
            <span className="products-stat-title">Total Products</span>
            <span className="products-stat-icon">🍰</span>
          </div>
          <p className="products-stat-value">{stats.total}</p>
          <span className="products-stat-desc">All products on menu</span>
        </div>

        <div
          className={`products-stat-card ${statusFilter === "available" ? "active-filter" : ""}`}
          onClick={() => setStatusFilter("available")}
        >
          <div className="products-stat-header">
            <span className="products-stat-title">Available</span>
            <span className="products-stat-icon">🟢</span>
          </div>
          <p className="products-stat-value" style={{ color: "#2e7d32" }}>
            {stats.available}
          </p>
          <span className="products-stat-desc">Ready for customer orders</span>
        </div>

        <div
          className={`products-stat-card ${statusFilter === "unavailable" ? "active-filter" : ""}`}
          onClick={() => setStatusFilter("unavailable")}
        >
          <div className="products-stat-header">
            <span className="products-stat-title">Unavailable</span>
            <span className="products-stat-icon">🔴</span>
          </div>
          <p className="products-stat-value" style={{ color: "#c62828" }}>
            {stats.unavailable}
          </p>
          <span className="products-stat-desc">Hidden from online menu</span>
        </div>

        <div
          className="products-stat-card"
          onClick={() => navigate("/admin/categories")}
          title="Click to manage categories"
        >
          <div className="products-stat-header">
            <span className="products-stat-title">Categories</span>
            <span className="products-stat-icon">🏷️</span>
          </div>
          <p className="products-stat-value">{stats.categoriesCount}</p>
          <span className="products-stat-desc">Active bakery classifications</span>
        </div>
      </div>

      {/* Add / Edit Product Collapsible Section */}
      {isFormOpen && (
        <section className="products-section">
          <div className="products-section-header">
            <h2>{editingId ? "Edit Bakery Product" : "Add New Bakery Product"}</h2>
            <button
              type="button"
              className="products-btn products-btn-secondary"
              onClick={cancelEdit}
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="products-form">
            <div className="products-form-grid">
              {/* Product Name */}
              <div className="products-field">
                <label htmlFor="prod-name">
                  Product Name <span className="required">*</span>
                </label>
                <input
                  id="prod-name"
                  type="text"
                  name="name"
                  placeholder="e.g. Sourdough Boule, Strawberry Tart"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Price */}
              <div className="products-field">
                <label htmlFor="prod-price">
                  Price (₹) <span className="required">*</span>
                </label>
                <input
                  id="prod-price"
                  type="number"
                  name="price"
                  placeholder="e.g. 250"
                  min="0.01"
                  step="0.01"
                  value={form.price}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Category */}
              <div className="products-field">
                <label htmlFor="prod-cat">
                  Category <span className="required">*</span>
                </label>
                <select
                  id="prod-cat"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  required
                  disabled={categoriesLoading}
                >
                  <option value="">
                    {categoriesLoading ? "Loading categories..." : "Select Category"}
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  {form.category &&
                    !categories.some((c) => c.name === form.category) && (
                      <option value={form.category}>{form.category} (Current)</option>
                    )}
                </select>
                <span className="products-field-hint">
                  Need a new category? Manage them under Categories in Admin.
                </span>
              </div>

              {/* Description */}
              <div className="products-field products-field-full">
                <label htmlFor="prod-desc">Product Description</label>
                <textarea
                  id="prod-desc"
                  name="description"
                  placeholder="Taste profile, ingredients, allergy warnings, or dietary notes..."
                  value={form.description}
                  onChange={handleChange}
                />
              </div>

              {/* Product Image & Preview */}
              <div className="products-field products-field-full">
                <label>Product Image</label>
                <div className="products-image-upload-wrapper">
                  <div className="products-image-picker">
                    <input
                      type="file"
                      id="prod-image-file"
                      className="products-file-input"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                    <span className="products-field-hint">
                      Supported formats: PNG, JPG, WebP. Recommended: 800x600px or square.
                    </span>
                  </div>

                  {imagePreviewUrl && (
                    <div className="products-image-preview-card">
                      <img src={imagePreviewUrl} alt="Preview" />
                      <button
                        type="button"
                        className="products-remove-preview-btn"
                        onClick={clearSelectedImage}
                        title="Remove selected image"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="products-form-actions">
              <button
                type="submit"
                className="products-btn products-btn-primary"
                disabled={saving}
              >
                {saving
                  ? "Saving to Catalog..."
                  : editingId
                  ? "Update Product"
                  : "Add Product"}
              </button>

              <button
                type="button"
                className="products-btn products-btn-secondary"
                onClick={cancelEdit}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Main Products Catalog Section */}
      <section className="products-section">
        {/* Controls Bar */}
        <div className="products-controls-bar">
          {/* Search box */}
          <div className="products-search-box">
            <input
              type="text"
              className="products-search-input"
              placeholder="🔍 Search products or descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="products-search-clear"
                onClick={() => setSearchQuery("")}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category, Status & Sort Filters */}
          <div className="products-filters-group">
            {/* Category dropdown */}
            <select
              className="products-select-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Status pills */}
            <div className="products-filter-pills">
              <button
                type="button"
                className={`products-pill-btn ${statusFilter === "all" ? "active" : ""}`}
                onClick={() => setStatusFilter("all")}
              >
                All ({stats.total})
              </button>
              <button
                type="button"
                className={`products-pill-btn ${statusFilter === "available" ? "active" : ""}`}
                onClick={() => setStatusFilter("available")}
              >
                Available ({stats.available})
              </button>
              <button
                type="button"
                className={`products-pill-btn ${statusFilter === "unavailable" ? "active" : ""}`}
                onClick={() => setStatusFilter("unavailable")}
              >
                Unavailable ({stats.unavailable})
              </button>
            </div>

            {/* Sort */}
            <select
              className="products-select-filter"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Sort: Recently Added</option>
              <option value="name_asc">Sort: Name (A-Z)</option>
              <option value="name_desc">Sort: Name (Z-A)</option>
              <option value="price_asc">Sort: Price (Low to High)</option>
              <option value="price_desc">Sort: Price (High to Low)</option>
            </select>
          </div>
        </div>

        {/* Catalog Body */}
        {loading ? (
          <div className="products-empty-state">
            <div className="products-empty-icon">⏳</div>
            <h3>Loading Bakery Catalog...</h3>
            <p>Fetching menu items, pricing, and availability.</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="products-empty-state">
            <div className="products-empty-icon">🥐</div>
            {products.length === 0 ? (
              <>
                <h3>Your Product Menu is Empty</h3>
                <p>
                  Start adding handcrafted cakes, pastries, breads, and cookies to delight your online bakery customers.
                </p>
                <div className="products-empty-actions">
                  <button
                    type="button"
                    className="products-btn products-btn-primary"
                    onClick={() => {
                      setForm(emptyForm);
                      setEditingId(null);
                      setImagePreviewUrl(null);
                      setIsFormOpen(true);
                    }}
                  >
                    + Add Your First Product
                  </button>

                  <button
                    type="button"
                    className="products-btn products-btn-secondary"
                    onClick={handleSeedProducts}
                    disabled={seeding}
                  >
                    {seeding ? "Loading..." : "⚡ Load Menu Essentials"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>No Products Found</h3>
                <p>
                  No products match your current search and filter settings.
                </p>
                <button
                  type="button"
                  className="products-btn products-btn-secondary"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                    setStatusFilter("all");
                  }}
                >
                  Clear Filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="products-grid">
            {filteredProducts.map((product) => {
              const isUpdating = updatingAvailability === product.id;
              const isAvail = product.is_available !== false;

              return (
                <div className="product-card" key={product.id}>
                  {/* Media */}
                  <div className="product-card-media">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="product-card-img"
                      />
                    ) : (
                      <div className="product-card-img-placeholder">
                        {product.category?.includes("CAKE")
                          ? "🎂"
                          : product.category?.includes("BREAD")
                          ? "🥖"
                          : product.category?.includes("COOKIE")
                          ? "🍪"
                          : "🥐"}
                        <span>The Golden Crust</span>
                      </div>
                    )}

                    {/* Floating Badges */}
                    <div className="product-card-badges">
                      <span className="product-category-badge">
                        {product.category || "Bakery"}
                      </span>
                      <span
                        className={`product-status-badge ${
                          isAvail ? "available" : "unavailable"
                        }`}
                      >
                        <span className="product-status-dot" />
                        {isAvail ? "Available" : "Unavailable"}
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="product-card-body">
                    <div className="product-card-title-row">
                      <h3 className="product-card-title">{product.name}</h3>
                      <span className="product-card-price">
                        ₹{Number(product.price).toLocaleString("en-IN")}
                      </span>
                    </div>

                    <p className="product-card-desc">
                      {product.description || "Freshly baked in our ovens daily."}
                    </p>

                    {/* Actions */}
                    <div className="product-card-actions">
                      <button
                        type="button"
                        className="product-action-btn product-toggle-btn"
                        onClick={() => handleToggleAvailability(product)}
                        disabled={isUpdating}
                        title={
                          isAvail
                            ? "Click to mark out of stock"
                            : "Click to mark available"
                        }
                      >
                        {isUpdating
                          ? "Updating..."
                          : isAvail
                          ? "Pause Item"
                          : "Activate"}
                      </button>

                      {product.image_url && (
                        <button
                          type="button"
                          className="product-action-btn product-delete-img-btn"
                          onClick={() => handleDeleteImage(product)}
                          title="Delete photo"
                        >
                          Remove Photo
                        </button>
                      )}

                      <button
                        type="button"
                        className="product-action-btn product-edit-btn"
                        onClick={() => handleEdit(product)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="product-action-btn product-delete-btn"
                        onClick={() => handleDelete(product.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default Products;
