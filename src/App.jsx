import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Menu from "./pages/Menu";
import Order from "./pages/Order";
import About from "./pages/About";
import Gallery from "./pages/Gallery";
import Contact from "./pages/Contact";
import Footer from "./components/Footer";

import AdminLayout from "./layouts/AdminLayout";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import Billing from "./pages/Billing";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import Categories from "./pages/Categories";
import Customers from "./pages/Customers";
import Inventory from "./pages/Inventory";
import Expenses from "./pages/Expenses";
import ProfitLoss from "./pages/ProfitLoss";
import Staff from "./pages/Staff";
import Notifications from "./pages/Notifications";

function CustomerWebsite() {
  return (
    <>
      <Navbar />
      <Home />
      <Menu />
      <Order />
      <About />
      <Gallery />
      <Contact />
      <Footer />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Customer Public Storefront */}
        <Route path="/" element={<CustomerWebsite />} />

        {/* Standalone Admin Login */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Persistent Admin Layout for all Admin Views */}
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/billing" element={<Billing />} />
          <Route path="/admin/products" element={<Products />} />
          <Route path="/admin/categories" element={<Categories />} />
          <Route path="/admin/orders" element={<Orders />} />
          <Route path="/admin/customers" element={<Customers />} />
          <Route path="/admin/inventory" element={<Inventory />} />
          <Route path="/admin/expenses" element={<Expenses />} />
          <Route path="/admin/profit-loss" element={<ProfitLoss />} />
          <Route path="/admin/staff" element={<Staff />} />
          <Route path="/admin/notifications" element={<Notifications />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
