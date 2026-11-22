
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../styles/Products.css";

function Products() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const emptyForm = {
    name: "",
    description: "",
    price: "",
    category: "",
    image: null,
  };

  const [form, setForm] = useState(emptyForm);

  const fetchProducts = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setProducts(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const getStoragePath = (imageUrl) => {
    const marker = "/product-images/";

    if (!imageUrl || !imageUrl.includes(marker)) {
      return null;
    }

    return decodeURIComponent(
      imageUrl.split(marker)[1].split("?")[0]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      let imageUrl = null;

      const existingProduct = products.find(
        (product) => product.id === editingId
      );

      if (form.image) {
        const fileExt = form.image.name.split(".").pop();

        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${fileExt}`;

        const filePath = `products/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(filePath, form.image);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("product-images")
          .getPublicUrl(filePath);

        imageUrl = publicUrlData.publicUrl;
      } else if (editingId) {
        imageUrl = existingProduct?.image_url || null;
      }

      const productData = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        category: form.category,
        image_url: imageUrl,
      };

      let result;

      if (editingId) {
        result = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingId);
      } else {
        result = await supabase
          .from("products")
          .insert([productData]);
      }

      if (result.error) throw result.error;

      // Remove old image after successful replacement
      if (form.image && existingProduct?.image_url) {
        const oldPath = getStoragePath(
          existingProduct.image_url
        );

        if (oldPath) {
          const { error: removeError } = await supabase.storage
            .from("product-images")
            .remove([oldPath]);

          if (removeError) {
            console.error("Old image cleanup failed:", removeError);
          }
        }
      }

      setSuccess(
        editingId
          ? "Product updated successfully!"
          : "Product added successfully!"
      );

      setForm(emptyForm);
      setEditingId(null);

      await fetchProducts();
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (product) => {
    setForm({
      name: product.name,
      description: product.description || "",
      price: product.price,
      category: product.category,
      image: null,
    });

    setEditingId(product.id);
    setError("");
    setSuccess("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleDeleteImage = async (product) => {
    const confirmed = window.confirm(
      `Delete the image for ${product.name}?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const imagePath = getStoragePath(product.image_url);

      if (imagePath) {
        const { error: storageError } = await supabase.storage
          .from("product-images")
          .remove([imagePath]);

        if (storageError) throw storageError;
      }

      const { error: databaseError } = await supabase
        .from("products")
        .update({ image_url: null })
        .eq("id", product.id);

      if (databaseError) throw databaseError;

      setSuccess("Product image deleted successfully!");

      await fetchProducts();
    } catch (err) {
      setError(err.message || "Unable to delete image.");
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this product?"
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    const product = products.find(
      (item) => item.id === id
    );

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Remove associated image from Storage
      if (product?.image_url) {
        const imagePath = getStoragePath(
          product.image_url
        );

        if (imagePath) {
          const { error: storageError } = await supabase.storage
            .from("product-images")
            .remove([imagePath]);

          if (storageError) {
            console.error("Image cleanup failed:", storageError);
          }
        }
      }

      setSuccess("Product deleted successfully!");

      await fetchProducts();
    } catch (err) {
      setError(err.message || "Unable to delete product.");
    }
  };

  const cancelEdit = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setSuccess("");
  };

  return (
    <div className="products-page">

      {/* Header */}
      <div className="products-header">
        <div>
          <h1>Product Management</h1>
          <p>Manage your bakery products here.</p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/admin/dashboard")}
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Add / Edit Product */}
      <section>
        <h2>{editingId ? "Edit Product" : "Add New Product"}</h2>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="name"
            placeholder="Product Name"
            value={form.name}
            onChange={handleChange}
            required
          />

          <textarea
            name="description"
            placeholder="Product Description"
            value={form.description}
            onChange={handleChange}
          />

          <input
            type="number"
            name="price"
            placeholder="Product Price"
            min="0.01"
            step="0.01"
            value={form.price}
            onChange={handleChange}
            required
          />

          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            required
          >
            <option value="">Select Category</option>
            <option value="CAKES">Cakes</option>
            <option value="PASTRIES">Pastries</option>
            <option value="BREADS">Breads</option>
            <option value="COOKIES">Cookies</option>
          </select>

          <label>Product Image</label>

          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              setForm({
                ...form,
                image: e.target.files[0] || null,
              })
            }
          />

          <button type="submit" disabled={saving}>
            {saving
              ? "Saving..."
              : editingId
                ? "Update Product"
                : "Add Product"}
          </button>

          {editingId && (
            <button type="button" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </form>

        {error && <p style={{ color: "red" }}>{error}</p>}
        {success && <p style={{ color: "green" }}>{success}</p>}
      </section>

      {/* All Products */}
      <section>
        <h2>All Products ({products.length})</h2>

        {loading ? (
          <p>Loading products...</p>
        ) : products.length === 0 ? (
          <p>No products added yet.</p>
        ) : (
          products.map((product) => (
            <div key={product.id}>
              {product.image_url && (
                <div>
                  <img
                    src={product.image_url}
                    alt={product.name}
                    style={{
                      width: "150px",
                      height: "120px",
                      objectFit: "cover",
                    }}
                  />

                  <br />

                  <button
                    type="button"
                    onClick={() => handleDeleteImage(product)}
                  >
                    Delete Image
                  </button>
                </div>
              )}

              <h3>{product.name}</h3>
              <p>{product.description}</p>
              <p>Price: ₹{product.price}</p>
              <p>Category: {product.category}</p>

              <button onClick={() => handleEdit(product)}>
                Edit
              </button>

              <button onClick={() => handleDelete(product.id)}>
                Delete
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

export default Products;
