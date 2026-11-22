
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function Categories() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [categoryName, setCategoryName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchCategories = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name");

    if (error) {
      setError(error.message);
    } else {
      setCategories(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const name = categoryName.trim().toUpperCase();

    if (!name) return;

    setError("");
    setSuccess("");

    if (editingId) {
      const { error } = await supabase
        .from("categories")
        .update({ name })
        .eq("id", editingId);

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess("Category updated successfully!");
    } else {
      const { error } = await supabase
        .from("categories")
        .insert([{ name }]);

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess("Category added successfully!");
    }

    setCategoryName("");
    setEditingId(null);

    await fetchCategories();
  };

  const handleEdit = (category) => {
    setCategoryName(category.name);
    setEditingId(category.id);
    setError("");
    setSuccess("");
  };

  const handleDelete = async (category) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${category.name}"?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", category.id);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess("Category deleted successfully!");

    if (editingId === category.id) {
      setCategoryName("");
      setEditingId(null);
    }

    await fetchCategories();
  };

  const cancelEdit = () => {
    setCategoryName("");
    setEditingId(null);
    setError("");
    setSuccess("");
  };

  return (
    <div className="categories-page">

      <div className="categories-header">
        <div>
          <h1>Category Management</h1>
          <p>Add, edit and manage product categories.</p>
        </div>

        <button
          onClick={() => navigate("/admin/dashboard")}
        >
          ← Back to Dashboard
        </button>
      </div>

      <section className="category-form-section">
        <h2>{editingId ? "Edit Category" : "Add New Category"}</h2>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Enter category name"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            required
          />

          <button type="submit">
            {editingId ? "Update Category" : "Add Category"}
          </button>

          {editingId && (
            <button type="button" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </form>

        {error && (
          <p className="categories-error">{error}</p>
        )}

        {success && (
          <p className="categories-success">{success}</p>
        )}
      </section>

      <section className="categories-list-section">
        <h2>All Categories ({categories.length})</h2>

        {loading ? (
          <p>Loading categories...</p>
        ) : categories.length === 0 ? (
          <p>No categories found.</p>
        ) : (
          <div className="categories-list">
            {categories.map((category) => (
              <div className="category-card" key={category.id}>
                <h3>{category.name}</h3>

                <div className="category-actions">
                  <button onClick={() => handleEdit(category)}>
                    Edit
                  </button>

                  <button
                    className="category-delete-btn"
                    onClick={() => handleDelete(category)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}

export default Categories;
