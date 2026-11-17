
import React, { useState } from "react";
import "../styles/Navbar.css";

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="navbar">
      <div className="logo">
        THE GOLDEN CRUST.
      </div>

      <button
        className="menu-toggle"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle navigation menu"
        aria-expanded={menuOpen}
      >
        {menuOpen ? "✕" : "☰"}
      </button>

      <ul className={`nav-links ${menuOpen ? "active" : ""}`}>
        <li><a href="#home" onClick={closeMenu}>Home</a></li>
        <li><a href="#menu" onClick={closeMenu}>Menu</a></li>
        <li><a href="#about" onClick={closeMenu}>About</a></li>
        <li><a href="#gallery" onClick={closeMenu}>Gallery</a></li>
        <li><a href="#contact-us" onClick={closeMenu}>Contact</a></li>
      </ul>

      <a href="#order" className="order-btn">
        Order Now
      </a>
    </nav>
  );
}

export default Navbar;
