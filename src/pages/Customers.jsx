
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../styles/Customers.css";

function Customers() {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchCustomers = async () => {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("orders")
      .select("customer_name, phone, total_amount, created_at");

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const customerMap = {};

    (data || []).forEach((order) => {
      const phone = order.phone;

      if (!customerMap[phone]) {
        customerMap[phone] = {
          name: order.customer_name,
          phone: phone,
          totalOrders: 0,
          totalSpent: 0,
          lastOrder: order.created_at,
        };
      }

      customerMap[phone].totalOrders += 1;
      customerMap[phone].totalSpent += Number(order.total_amount || 0);

      if (
        new Date(order.created_at) >
        new Date(customerMap[phone].lastOrder)
      ) {
        customerMap[phone].lastOrder = order.created_at;
        customerMap[phone].name = order.customer_name;
      }
    });

    setCustomers(
      Object.values(customerMap).sort(
        (a, b) =>
          new Date(b.lastOrder) - new Date(a.lastOrder)
      )
    );

    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  return (
    <div className="customers-page">

      {/* Header */}
      <div className="customers-header">
        <div>
          <h1>Customers</h1>
          <p>Manage your bakery customers.</p>
        </div>

        <div className="customers-header-actions">
          <button
            type="button"
            onClick={() => navigate("/admin/dashboard")}
            className="customers-back-button"
          >
            ← Back to Dashboard
          </button>

          <button
            type="button"
            onClick={fetchCustomers}
            className="customers-refresh-button"
          >
            Refresh Customers
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="customers-error">{error}</p>
      )}

      {/* Customer Data */}
      {loading ? (
        <p>Loading customers...</p>
      ) : customers.length === 0 ? (
        <div className="customers-empty">
          <h2>No Customers Yet</h2>
          <p>Customers will appear when orders are received.</p>
        </div>
      ) : (
        <div className="customers-table-container">
          <table className="customers-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Total Orders</th>
                <th>Total Spent</th>
                <th>Last Order</th>
              </tr>
            </thead>

            <tbody>
              {customers.map((customer) => (
                <tr key={customer.phone}>
                  <td>{customer.name}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.totalOrders}</td>
                  <td>
                    ₹{customer.totalSpent.toLocaleString("en-IN")}
                  </td>
                  <td>
                    {new Date(customer.lastOrder).toLocaleDateString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}

export default Customers;
