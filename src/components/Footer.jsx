
import "../styles/Footer.css";

function Footer() {
  return (
    <footer className="footer">

      <div className="footer-container">

        <div className="footer-brand">
          <h2>THE GOLDEN CRUST</h2>
          <p>
            Freshly baked happiness, made with love
            and served with a smile.
          </p>
        </div>

        <div className="footer-links">
          <h3>Quick Links</h3>
          <a href="#home">Home</a>
          <a href="#menu">Menu</a>
          <a href="#about">About Us</a>
          <a href="#gallery">Gallery</a>
          <a href="#contact-us">Contact</a>
        </div>

        <div className="footer-contact">
          <h3>Contact Us</h3>
          <p>Thiruthani, Tamil Nadu</p>
          <p>+91 98765 43210</p>
          <p>Open: 9 AM – 10 PM</p>
        </div>

        <div className="footer-social">
          <h3>Follow Us</h3>
          <a href="https://www.instagram.com/"
             target="_blank" rel="noreferrer">
            Instagram
          </a>
          <a href="https://www.facebook.com/"
             target="_blank" rel="noreferrer">
            Facebook
          </a>
        </div>

      </div>

      <div className="footer-bottom">
        <p>
          © {new Date().getFullYear()} The Golden Crust.
          All Rights Reserved.
        </p>
      </div>

    </footer>
  );
}

export default Footer;
