import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "../styles/Menu.css";

function Menu() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch products from Supabase
  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_available", true)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setProducts(data || []);
      setError("");
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Dynamic categories
  const categories = [
    "All",
    ...new Set(products.map((product) => product.category)),
  ];

  // Filter products
  const filteredProducts =
    selectedCategory === "All"
      ? products
      : products.filter(
          (product) => product.category === selectedCategory
        );

  return (
    <section className="menu-section" id="menu">
      <p className="menu-subtitle">OUR SPECIALITIES</p>

      <h2>Fresh From Our Oven</h2>

      <p className="menu-description">
        Discover our freshly prepared bakery favourites.
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

      {/* Products */}
      <div className="product-grid">
        {loading ? (
          <p>Loading products...</p>
        ) : error ? (
          <p>Unable to load products: {error}</p>
        ) : filteredProducts.length === 0 ? (
          <p>No products available in this category.</p>
        ) : (
          filteredProducts.map((product) => (
            <div className="product-card" key={product.id}>
              {product.image_url && (
                <img
                  src={product.image_url}
                  alt={product.name}
                />
              )}

              <div className="product-info">
                <p>{product.category}</p>

                <h3>{product.name}</h3>

                <h4>
                  ₹{Number(product.price).toLocaleString("en-IN")}
                </h4>

                {product.description && (
                  <span className="dietary-label">
                    {product.description}
                  </span>
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