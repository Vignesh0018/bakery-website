import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "../styles/Menu.css";

function Menu() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    const loadProducts = async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from("products")
          .select("*")
          .eq("is_available", true)
          .order("created_at", { ascending: false });

        if (!ignore) {
          if (fetchErr) {
            setError(fetchErr.message);
          } else {
            setProducts(data || []);
            setError("");
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Failed to load products.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadProducts();

    return () => {
      ignore = true;
    };
  }, []);

  // Dynamic categories
  const categories = [
    "All",
    ...new Set(
      products
        .map((product) => product.category)
        .filter(Boolean)
    ),
  ];

  // Filter products
  const filteredProducts =
    selectedCategory === "All"
      ? products
      : products.filter(
          (product) => product.category === selectedCategory
        );

  const getProductIcon = (category) => {
    const c = (category || "").toUpperCase();
    if (c.includes("CAKE")) return "🎂";
    if (c.includes("BREAD")) return "🥖";
    if (c.includes("COOKIE")) return "🍪";
    if (c.includes("PASTR")) return "🥐";
    return "🍰";
  };

  return (
    <section className="menu-section" id="menu">
      <p className="menu-subtitle">OUR SPECIALITIES</p>

      <h2>Fresh From Our Oven</h2>

      <p className="menu-description">
        Discover our artisanal sourdough breads, handcrafted celebration cakes, and delicate European pastries baked fresh daily.
      </p>

      {/* Category filters */}
      <div className="category-filters">
        {categories.map((category) => (
          <button
            key={category}
            className={selectedCategory === category ? "active" : ""}
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <div className="product-grid">
        {loading ? (
          <p>Loading fresh bakery creations...</p>
        ) : error ? (
          <p>Unable to load products: {error}</p>
        ) : filteredProducts.length === 0 ? (
          <p>No products currently available in this category.</p>
        ) : (
          filteredProducts.map((product) => (
            <div className="product-card" key={product.id}>
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} />
              ) : (
                <div className="product-card-placeholder">
                  {getProductIcon(product.category)}
                </div>
              )}

              <div className="product-info">
                <p>{product.category || "Artisan Specialty"}</p>

                <h3>{product.name}</h3>

                <h4>₹{Number(product.price).toLocaleString("en-IN")}</h4>

                {product.description && (
                  <span className="dietary-label">{product.description}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default Menu;
