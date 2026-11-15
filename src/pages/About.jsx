
import React from "react";
import "../styles/About.css";

function About() {
  return (
    <section className="about-section" id="about">

      <div className="about-image">
        <img
          src="https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800"
          alt="Fresh bakery products"
        />
      </div>

      <div className="about-content">

        <p className="about-subtitle">
          OUR STORY
        </p>

        <h2>
          Baking Happiness,
          One Bite at a Time.
        </h2>

        <p>
          Welcome to The Golden Crust, where every product
          is prepared with passion, care and quality
          ingredients.
        </p>

        <p>
          From freshly baked breads to delicious cakes
          and pastries, we believe every occasion deserves
          something special.
        </p>

        <div className="about-features">
          <div>
            <h3>100%</h3>
            <span>Freshly Baked</span>
          </div>

          <div>
            <h3>Made With</h3>
            <span>Love & Care</span>
          </div>
        </div>

      </div>

    </section>
  );
}

export default About;
