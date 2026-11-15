
import React from "react";
import "../styles/Order.css";

function Order() {

  const handleSubmit = (event) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const name = form.get("name");
    const phone = form.get("phone");
    const flavour = form.get("flavour");
    const weight = form.get("weight");
    const date = form.get("date");
    const message = form.get("message");
    const delivery = form.get("delivery");

    const whatsappNumber = "919876543210";

    const orderMessage = `
Hello The Golden Crust!

I would like to place a custom cake order.

Customer Name: ${name}
Phone Number: ${phone}
Cake Flavour: ${flavour}
Cake Weight: ${weight}
Required Date: ${date}
Cake Message: ${message || "No message"}
Order Type: ${delivery}
`;

    const whatsappURL =
      `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(orderMessage)}`;

    window.open(whatsappURL, "_blank");
  };

  return (
    <section className="order-section" id="contact">

      <div className="order-heading">
        <p>CUSTOM CAKE ORDERS</p>
        <h2>Make Your Celebration Special</h2>
        <span>
          Tell us your dream cake. We'll make it happen.
        </span>
      </div>

      <form className="order-form" onSubmit={handleSubmit}>

        <div className="form-group">
          <label>Customer Name</label>
          <input
            type="text"
            name="name"
            placeholder="Enter your name"
            required
          />
        </div>

        <div className="form-group">
          <label>Phone Number</label>
          <input
            type="tel"
            name="phone"
            placeholder="Enter your phone number"
            pattern="[0-9]{10}"
            title="Enter a 10-digit phone number"
            required
          />
        </div>

        <div className="form-group">
          <label>Cake Flavour</label>
          <select name="flavour" required>
            <option value="">Choose flavour</option>
            <option>Chocolate</option>
            <option>Black Forest</option>
            <option>White Forest</option>
            <option>Butterscotch</option>
            <option>Vanilla</option>
            <option>Red Velvet</option>
          </select>
        </div>

        <div className="form-group">
          <label>Cake Weight</label>
          <select name="weight" required>
            <option value="">Choose weight</option>
            <option>500 Grams</option>
            <option>1 KG</option>
            <option>1.5 KG</option>
            <option>2 KG</option>
            <option>3 KG</option>
          </select>
        </div>

        <div className="form-group">
          <label>Required Date</label>
          <input
            type="date"
            name="date"
            min={new Date().toLocaleDateString("en-CA")}
            required
          />
        </div>

        <div className="form-group">
          <label>Message on Cake</label>
          <input
            type="text"
            name="message"
            placeholder="Example: Happy Birthday!"
          />
        </div>

<div className="form-group full-width">
  <label>Upload Cake Reference Image</label>

  <input
    type="file"
    name="reference"
    accept="image/*"
  />
</div>


        <div className="form-group full-width">
          <label>Pickup or Delivery</label>
          <select name="delivery" required>
            <option value="">Choose an option</option>
            <option>Store Pickup</option>
            <option>Home Delivery</option>
          </select>
        </div>

        <button type="submit" className="submit-order">
          Order Now
        </button>

      </form>

    </section>
  );
}

export default Order;
