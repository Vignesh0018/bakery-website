
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Menu from "./pages/Menu";
import Order from "./pages/Order";
import About from "./pages/About";
import Gallery from "./pages/Gallery";
import Contact from "./pages/Contact";
import Footer from "./components/Footer";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import Categories from "./pages/Categories";
import Inventory from "./pages/Inventory";
import Expenses from "./pages/Expenses";
import ProfitLoss from "./pages/ProfitLoss";

import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import Adminproducts from "./pages/Customers";


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
        <Route path="/" element={<CustomerWebsite />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/products" element={<Products />} />
        <Route path="/admin/orders" element={<Orders />} />
        <Route path="/admin/categories" element={<Categories />} />
        <Route path="/admin/customers" element={<Adminproducts />} />
        <Route path="/admin/inventory" element={<Inventory />} />
        <Route path="/admin/expenses" element={<Expenses />} />
        <Route path="/admin/profit-loss" element={<ProfitLoss />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
