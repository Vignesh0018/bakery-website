import "../styles/About.css";

function About() {
  return (
    <section className="about-section" id="about">
      <div className="about-image">
        <img
          src="https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800"
          alt="Fresh artisan bakery products"
        />
        <div className="about-image-badge">
          <span>🌾 Traditional Stoneground Baking</span>
        </div>
      </div>

      <div className="about-content">
        <p className="about-subtitle">OUR STORY</p>

        <h2>Baking Happiness, One Bite at a Time.</h2>

        <p>
          Welcome to The Golden Crust, where old-world baking traditions meet fresh, artisanal passion. Every morning before dawn, our ovens heat up to bake crusty sourdoughs, melt-in-your-mouth pastries, and celebration cakes from scratch.
        </p>

        <p>
          We source pure dairy butter, rich Belgian chocolates, and organic stone-milled grains without artificial preservatives. From everyday morning coffee treats to milestone wedding cakes, we believe every occasion deserves something truly special.
        </p>

        <div className="about-features">
          <div className="about-feature-item">
            <h3>100%</h3>
            <span>Freshly Baked Daily</span>
          </div>

          <div className="about-feature-item">
            <h3>0%</h3>
            <span>Artificial Additives</span>
          </div>

          <div className="about-feature-item">
            <h3>10+</h3>
            <span>Master Recipes</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default About;
