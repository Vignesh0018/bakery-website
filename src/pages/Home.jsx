
import React from "react";
import "../styles/Home.css";

function Home() {
  const scrollToSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="home" id="home">

      <section className="hero">

        <div className="hero-content">

          <p className="subtitle">
            FRESHLY BAKED, EVERY DAY
          </p>

          <h1>
            A Little Joy
            <br />
            In Every Bite.
          </h1>

          <p className="description">
            Experience the magic of freshly baked cakes,
            delicious pastries and handcrafted treats
            made with love.
          </p>

          <div className="hero-buttons">
            <button type="button" onClick={() => scrollToSection("menu")}>
              Explore Menu
            </button>
            <button type="button" onClick={() => scrollToSection("contact")}>
              Order Now
            </button>
          </div>

          <div className="opening">>
            <p>MONDAY TO SATURDAY: 10:00 AM - 9:00 PM</p>
           <p> SUNDAY: 9:00 AM - 9:00 PM</p>
          <

        </div>

      </section>

    </div>
  );
}

export default Home;
