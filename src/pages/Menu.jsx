
import React, { useState } from "react";
import "../styles/Menu.css";

function Menu() {
  const [selectedCategory, setSelectedCategory] = useState("All");

  const products = [
    
    {
      name: "Chocolate Cake",
      category: "CAKES",
      price: "₹450",
      dietary: "Eggless Available",
      image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600",
    },
    {
      name: "Butter Croissant",
      category: "PASTRIES",
      price: "₹80",
      dietary: "Contains Dairy",
      image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600",
    },
    {
      name: "Fresh Bread",
      category: "BREADS",
      price: "₹60",
      dietary: "Vegetarian",
      image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600",
    },
    {
      name: "Chocolate Cookies",
      category: "COOKIES",
      price: "₹120",
      dietary: "Contains Gluten",
      image: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600",
    },
  ];

  const categories = ["All", "CAKES", "PASTRIES", "BREADS", "COOKIES"];

  const filteredProducts =
    selectedCategory === "All"
      ? products
      : products.filter((product) => product.category === selectedCategory);

  return (
    <section className="menu-section" id="menu">
      <p className="menu-subtitle">OUR SPECIALITIES</p>

      <h2>Fresh From Our Oven</h2>

      <p className="menu-description">
        Discover our freshly prepared bakery favourites.
      </p>

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

      <div className="product-grid">
        {filteredProducts.map((product, index) => (
          <div className="product-card" key={index}>
            <img src={product.image} alt={product.name} />

            <div className="product-info">
              <p>{product.category}</p>
              <h3>{product.name}</h3>
              <h4>{product.price}</h4>

              <span className="dietary-label">{product.dietary}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Menu;
