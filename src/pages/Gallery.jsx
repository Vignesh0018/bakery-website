import "../styles/Gallery.css";

const galleryImages = [
  {
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800",
    title: "Belgian Chocolate Truffle Cake",
  },
  {
    image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800",
    title: "Flaky Butter Croissants",
  },
  {
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800",
    title: "Artisan Sourdough Loaf",
  },
  {
    image: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800",
    title: "Chunky Chocolate Chip Cookies",
  },
  {
    image: "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=800",
    title: "Vanilla Swirl Cupcakes",
  },
  {
    image: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800",
    title: "Custom Birthday Cake",
  },
];

function Gallery() {
  return (
    <section className="gallery-section" id="gallery">
      <div className="gallery-heading">
        <p>OUR GALLERY</p>
        <h2>A Feast for Your Eyes</h2>
        <span>Explore our handcrafted daily bakery creations.</span>
      </div>

      <div className="gallery-grid">
        {galleryImages.map((item, index) => (
          <div className="gallery-card" key={index}>
            <img src={item.image} alt={item.title} loading="lazy" />
            <div className="gallery-overlay">
              <h3>{item.title}</h3>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Gallery;
