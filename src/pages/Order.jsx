import { useState } from "react";
import { supabase } from "../lib/supabase";
import "../styles/Order.css";

function Order() {
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    setSuccessMessage("");
    setErrorMessage("");
    setSubmitting(true);

    try {
      const form = new FormData(event.currentTarget);

      const name = form.get("name").trim();
      const phone = form.get("phone").trim();
      const flavour = form.get("flavour");
      const weight = form.get("weight");
      const date = form.get("date");
      const message = form.get("message");
      const delivery = form.get("delivery");

      const orderItems = [
        {
          product: "Custom Cake",
          flavour,
          weight,
          required_date: date,
          cake_message: message || "No message",
          delivery_type: delivery,
          quantity: 1,
        },
      ];

      // Save order to Supabase
      const { error } = await supabase.from("orders").insert([
        {
          customer_name: name,
          phone: phone,
          address: null,
          items: orderItems,
          total_amount: 0,
          payment_method: "WhatsApp / Direct Confirmation",
          order_status: "Pending",
          notes: `Custom cake order | Date: ${date} | Type: ${delivery}`,
        },
      ]);

      if (error) {
        console.error("Order database error:", error);
        setErrorMessage("Unable to save your order to our system. Please reach out via WhatsApp directly.");
        return;
      }

      // Format WhatsApp message
      const whatsappNumber = "919876543210";

      const orderMessage = `Hello The Golden Crust!

I would like to place a custom cake order:
Customer Name: ${name}
Phone Number: ${phone}
Cake Flavour: ${flavour}
Cake Weight: ${weight}
Required Date: ${date}
Cake Message: ${message || "No message"}
Delivery Type: ${delivery}

Please confirm price and availability. Thank you!`;

      const whatsappURL = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
        orderMessage
      )}`;

      window.open(whatsappURL, "_blank");

      setSuccessMessage(
        "🎉 Your cake request has been submitted! WhatsApp has been opened to finalize your details."
      );

      event.target.reset();
    } catch (err) {
      console.error("Unexpected order error:", err);
      setErrorMessage("Something went wrong. Please call or WhatsApp us directly.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="order-section" id="order">
      <div className="order-heading">
        <p>CUSTOM CAKE ORDERS</p>
        <h2>Make Your Celebration Special</h2>
        <span>Tell us your dream cake. We&apos;ll bake it fresh for your special day.</span>
      </div>

      <div className="order-form-container">
        {successMessage && (
          <div className="order-banner-success">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="order-banner-error">
            {errorMessage}
          </div>
        )}

        <form className="order-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="order-cust-name">Customer Name</label>
            <input
              id="order-cust-name"
              type="text"
              name="name"
              placeholder="e.g. Ananya Sharma"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="order-cust-phone">Phone Number</label>
            <input
              id="order-cust-phone"
              type="tel"
              name="phone"
              placeholder="10-digit mobile number"
              pattern="[0-9]{10}"
              title="Enter a 10-digit phone number"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="order-cake-flavour">Cake Flavour</label>
            <select id="order-cake-flavour" name="flavour" required>
              <option value="">Choose a signature flavour</option>
              <option>Belgian Dark Chocolate</option>
              <option>Classic Black Forest</option>
              <option>White Forest & Berry</option>
              <option>Caramel Butterscotch</option>
              <option>Madagascar Vanilla</option>
              <option>Red Velvet Cream Cheese</option>
              <option>Fresh Fruit Gateau</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="order-cake-weight">Cake Weight / Size</label>
            <select id="order-cake-weight" name="weight" required>
              <option value="">Choose weight</option>
              <option>500 Grams (Serves 4–6)</option>
              <option>1 KG (Serves 8–10)</option>
              <option>1.5 KG (Serves 12–15)</option>
              <option>2 KG (Serves 16–20)</option>
              <option>3 KG (Serves 25+)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="order-cake-date">Required Date</label>
            <input
              id="order-cake-date"
              type="date"
              name="date"
              min={new Date().toLocaleDateString("en-CA")}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="order-cake-message">Message on Cake (Optional)</label>
            <input
              id="order-cake-message"
              type="text"
              name="message"
              placeholder="e.g. Happy Birthday Arjun! 🎂"
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="order-cake-delivery">Order Fulfillment</label>
            <select id="order-cake-delivery" name="delivery" required>
              <option value="">Choose pickup or delivery</option>
              <option>Store Pickup (Thiruthani Bakehouse)</option>
              <option>Home Delivery</option>
            </select>
          </div>

          <button
            type="submit"
            className="submit-order"
            disabled={submitting}
          >
            {submitting ? "Submitting Order Request..." : "🎂 Send Cake Order via WhatsApp"}
          </button>
        </form>

        <div className="order-trust-badges">
          <div className="order-trust-item">
            <span>✨ 100% Fresh Daily Bake</span>
          </div>
          <div className="order-trust-item">
            <span>🌱 Eggless Options Available</span>
          </div>
          <div className="order-trust-item">
            <span>💬 Instant WhatsApp Confirmation</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Order;
