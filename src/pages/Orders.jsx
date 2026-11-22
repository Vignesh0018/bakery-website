
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../styles/Orders.css";

function Orders() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOrders = async () => {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setOrders(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const updateStatus = async (id, status) => {
    const { error } = await supabase
      .from("orders")
      .update({ order_status: status })
      .eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    await fetchOrders();
  };

  const deleteOrder = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this order?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    await fetchOrders();
  };

  return (
    <div className="orders-page">

      {/* Header */}
      <div className="orders-header">
        <div>
          <h1>Orders Management</h1>
          <p>View and manage customer orders.</p>
        </div>

        <div className="orders-header-buttons">
          <button onClick={() => navigate("/admin/dashboard")}>
            ← Back to Dashboard
          </button>

          <button onClick={fetchOrders}>
            Refresh Orders
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="orders-error">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="no-orders">
          Loading orders...
        </div>
      ) : orders.length === 0 ? (
        <div className="no-orders">
          <h2>No Orders Yet</h2>
          <p>Customer orders will appear here.</p>
        </div>
      ) : (

        <div className="orders-list">
          {orders.map((order) => {
            const items = Array.isArray(order.items)
              ? order.items
              : [];

            return (
              <div className="order-card" key={order.id}>

                <div className="order-card-header">
                  <h3>Order #{order.id}</h3>

                  <select
                    className="order-status"
                    value={order.order_status}
                    onChange={(e) =>
                      updateStatus(order.id, e.target.value)
                    }
                  >
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Preparing">Preparing</option>
                    <option value="Ready">Ready</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="order-details">
                  <div>
                    <p>
                      <strong>Customer:</strong>{" "}
                      {order.customer_name}
                    </p>

                    <p>
                      <strong>Phone:</strong> {order.phone}
                    </p>

                    <p>
                      <strong>Address:</strong>{" "}
                      {order.address || "Not provided"}
                    </p>
                  </div>

                  <div>
                    <p>
                      <strong>Order Date:</strong>{" "}
                      {new Date(order.created_at).toLocaleString("en-IN")}
                    </p>

                    <p>
                      <strong>Payment:</strong> {order.payment_method}
                    </p>

                    <p>
                      <strong>Total:</strong>{" "}
                      ₹{Number(order.total_amount || 0).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>

                <div className="order-items">
                  <h4>Ordered Items</h4>

                  {items.length === 0 ? (
                    <p>No item details available.</p>
                  ) : (
                    items.map((item, index) => (
                      <div className="order-item" key={index}>
                        <h5>{item.product || "Custom Cake"}</h5>

                        <p>
                          <strong>Flavour:</strong>{" "}
                          {item.flavour || "Not specified"}
                        </p>

                        <p>
                          <strong>Weight:</strong>{" "}
                          {item.weight || "Not specified"}
                        </p>

                        <p>
                          <strong>Quantity:</strong>{" "}
                          {item.quantity || 1}
                        </p>

                        <p>
                          <strong>Required Date:</strong>{" "}
                          {item.required_date || "Not specified"}
                        </p>

                        <p>
                          <strong>Cake Message:</strong>{" "}
                          {item.cake_message || "No message"}
                        </p>

                        <p>
                          <strong>Order Type:</strong>{" "}
                          {item.delivery_type || "Not specified"}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="order-notes">
                  <strong>Notes:</strong>{" "}
                  {order.notes || "None"}
                </div>

                <div className="order-actions">
                  <button
                    className="delete-order-btn"
                    onClick={() => deleteOrder(order.id)}
                  >
                    Delete Order
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Orders;
