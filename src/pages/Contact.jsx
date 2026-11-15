
import React from "react";
import "../styles/Contact.css";

function Contact() {
  return (
    <section className="contact-section" id="contact-us">

      <div className="contact-heading">
        <p>GET IN TOUCH</p>
        <h2>We'd Love to See You</h2>
        <span>Visit us or get in touch for your next treat.</span>
      </div>

      <div className="contact-container">

        <div className="contact-details">

          <div className="contact-item">
            <h3>Our Location</h3>
            <p>123 Main Road, Your Town, Tamil Nadu</p>
          </div>

          <div className="contact-item">
            <h3>Call Us</h3>
            <p>+91 98765 43210</p>
            <a href="tel:+919876543210">Call Now</a>
          </div>

          <div className="contact-item">
            <h3>Opening Hours</h3>
            <p>Monday – Sunday</p>
            <p>9:00 AM – 10:00 PM</p>
          </div>

          <div className="contact-item">
            <h3>Follow Us</h3>
            <a
              href="https://www.instagram.com/"
              target="_blank"
              rel="noreferrer"
            >
              Instagram
            </a>
          </div>

          <a
            className="contact-whatsapp"
            href="https://wa.me/919876543210"
            target="_blank"
            rel="noreferrer"
          >
            Contact Us on WhatsApp
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
