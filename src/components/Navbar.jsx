
import React from "react";
import "../styles/Navbar.css";

function Navbar() {
  return (
    <nav className="navbar">

      <div className="logo">
        THE GOLDEN CRUST.
      </div>

      <ul className="nav-links">
        <li><a href="#home">Home</a></li>
        <li><a href="#menu">Menu</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#gallery">Gallery</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>

      <a href="#contact" className="order-btn">
        Order Now
      </a>

    </nav>
  );
}

export default Navbar;
