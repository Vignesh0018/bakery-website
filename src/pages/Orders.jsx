
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "../styles/Orders.css";

function Orders() {
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
      <h1>Orders Management</h1>
      <p>View and manage customer orders.</p>

      <button onClick={fetchOrders}>
        Refresh Orders
      </button>

      {error && (
        <p style={{ color: "red" }}>{error}</p>
      )}

      {loading ? (
        <p>Loading orders...</p>
      ) : orders.length === 0 ? (
        <p>No orders found yet.</p>
      ) : (
        orders.map((order) => (
          <div
            key={order.id}
            style={{
              border: "1px solid #ddd",
              padding: "20px",
              margin: "15px 0",
              borderRadius: "10px",
            }}
          >
            <h2>Order #{order.id}</h2>

            <p>
              Customer: {order.customer_name}
            </p>

            <p>
              Phone: {order.phone}
            </p>

            <p>
              Address: {order.address || "Not provided"}
            </p>

            <h3>Ordered Items</h3>

            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(order.items, null, 2)}
            </pre>

            <p>
              Total: ₹{order.total_amount}
            </p>

            <p>
              Payment: {order.payment_method}
            </p>

            <p>
              Notes: {order.notes || "None"}
            </p>

            <p>
              Date: {new Date(order.created_at).toLocaleString("en-IN")}
            </p>

            <label>Order Status: </label>

            <select
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

            <br />
            <br />

            <button
              onClick={() => deleteOrder(order.id)}
            >
              Delete Order
            </button>
          </div>
        ))
      )}
    </div>
  );
}

export default Orders;
