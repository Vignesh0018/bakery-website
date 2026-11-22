import "../styles/Contact.css";

function Contact() {
  return (
    <section className="contact-section" id="contact-us">
      <div className="contact-heading">
        <p>GET IN TOUCH</p>
        <h2>We'd Love to See You</h2>
        <span>Visit our bakehouse or get in touch for custom cakes and fresh treats.</span>
      </div>

      <div className="contact-container">
        <div className="contact-details">
          <div className="contact-item">
            <div className="contact-item-title-row">
              <span className="contact-item-icon">📍</span>
              <h3>Our Bakehouse Location</h3>
            </div>
            <p>123 Main Road, Thiruthani, Tamil Nadu, India</p>
          </div>

          <div className="contact-item">
            <div className="contact-item-title-row">
              <span className="contact-item-icon">📞</span>
              <h3>Call the Bakery</h3>
            </div>
            <p>Have an inquiry or urgent request?</p>
            <a href="tel:+919876543210" className="contact-phone-btn">
              +91 98765 43210
            </a>
          </div>

          <div className="contact-item">
            <div className="contact-item-title-row">
              <span className="contact-item-icon">⏰</span>
              <h3>Opening Hours</h3>
            </div>
            <p>Monday – Saturday: 10:00 AM – 9:00 PM</p>
            <p>Sunday: 9:00 AM – 9:00 PM</p>
          </div>

          <div className="contact-item">
            <div className="contact-item-title-row">
              <span className="contact-item-icon">📸</span>
              <h3>Follow Our Bakes</h3>
            </div>
            <a
              href="https://www.instagram.com/"
              target="_blank"
              rel="noreferrer"
              className="contact-phone-btn"
            >
              Instagram @thegoldencrust
            </a>
          </div>

          <a
            className="contact-whatsapp"
            href="https://wa.me/919876543210"
            target="_blank"
            rel="noreferrer"
          >
            <span>💬 Chat With Us on WhatsApp</span>
          </a>
        </div>

        <div className="map-container">
          <iframe
            title="Bakery Location"
            src="https://maps.google.com/maps?q=Thiruthani%2C%20Tamil%20Nadu&t=&z=13&ie=UTF8&iwloc=&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          ></iframe>
        </div>
      </div>
    </section>
  );
}

export default Contact;
