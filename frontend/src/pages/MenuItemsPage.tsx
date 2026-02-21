import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Ingredient, MenuItem, RecipeLine } from "../types";

interface MenuItemFormState {
  name: string;
  category: string;
  isActive: boolean;
}

interface RecipeLineInput {
  ingredientId: string;
  qtyPerMenuItem: string;
  unit: string;
}

const MenuItemsPage = () => {
  const { token } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [unmapped, setUnmapped] = useState<Array<{ menuItemName: string; records: number }>>([]);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string | null>(null);
  const [recipeLines, setRecipeLines] = useState<RecipeLineInput[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<MenuItemFormState>({ name: "", category: "", isActive: true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCore = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      const [menuData, ingredientData, unmappedData] = await Promise.all([
        apiRequest<{ items: MenuItem[] }>(`/menu-items?${params.toString()}`, { token }),
        apiRequest<{ items: Ingredient[] }>("/ingredients", { token }),
        apiRequest<{ items: Array<{ menuItemName: string; records: number }> }>("/menu-items/unmapped", {
          token,
        }),
      ]);
      setItems(menuData.items);
      setIngredients(ingredientData.items);
      setUnmapped(unmappedData.items);
    } finally {
      setLoading(false);
    }
  }, [query, token]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  const selectedMenuItem = useMemo(
    () => items.find((item) => item._id === selectedMenuItemId) ?? null,
    [items, selectedMenuItemId]
  );

  const loadRecipe = useCallback(
    async (menuItemId: string) => {
      if (!token) return;
      const data = await apiRequest<{ lines: RecipeLine[] }>(`/menu-items/${menuItemId}/recipe`, { token });
      const mapped = data.lines.map((line) => {
        const ingredient =
          typeof line.ingredientId === "string" ? ingredients.find((item) => item._id === line.ingredientId) : line.ingredientId;
        return {
          ingredientId:
            typeof line.ingredientId === "string" ? line.ingredientId : line.ingredientId._id,
          qtyPerMenuItem: String(line.qtyPerMenuItem),
          unit: line.unit || ingredient?.unit || "",
        };
      });
      setRecipeLines(mapped);
      setSelectedMenuItemId(menuItemId);
    },
    [ingredients, token]
  );

  const handleSaveMenuItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category.trim() || undefined,
        isActive: form.isActive,
      };
      if (editingId) {
        await apiRequest(`/menu-items/${editingId}`, {
          method: "PUT",
          body: payload,
          token,
        });
      } else {
        await apiRequest("/menu-items", { method: "POST", body: payload, token });
      }
      setForm({ name: "", category: "", isActive: true });
      setEditingId(null);
      await loadCore();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save menu item.");
    }
  };

  const handleEdit = (item: MenuItem) => {
    setEditingId(item._id);
    setForm({
      name: item.name,
      category: item.category ?? "",
      isActive: item.isActive,
    });
  };

  const handleDelete = async (id: string) => {
    if (!token || !confirm("Delete this menu item and its recipe mapping?")) return;
    try {
      await apiRequest(`/menu-items/${id}`, { method: "DELETE", token });
      if (selectedMenuItemId === id) {
        setSelectedMenuItemId(null);
        setRecipeLines([]);
      }
      await loadCore();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Delete failed.");
    }
  };

  const updateRecipeLine = (index: number, patch: Partial<RecipeLineInput>) => {
    setRecipeLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const addRecipeLine = () => {
    const ingredient = ingredients[0];
    setRecipeLines((prev) => [
      ...prev,
      {
        ingredientId: ingredient?._id ?? "",
        qtyPerMenuItem: "0",
        unit: ingredient?.unit ?? "",
      },
    ]);
  };

  const saveRecipe = async () => {
    if (!token || !selectedMenuItemId) return;
    try {
      await apiRequest(`/menu-items/${selectedMenuItemId}/recipe`, {
        method: "PUT",
        token,
        body: {
          lines: recipeLines.map((line) => ({
            ingredientId: line.ingredientId,
            qtyPerMenuItem: Number(line.qtyPerMenuItem),
            unit: line.unit,
          })),
        },
      });
      alert("Recipe saved.");
      await loadCore();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not save recipe.");
    }
  };

  if (loading) {
    return <div className="centered-state">Loading menu items...</div>;
  }

  return (
    <section className="stack-section">
      <div className="panel">
        <div className="panel-header">
          <h2>Menu Items</h2>
          <p>Maintain menu catalog + recipe/BOM mapping.</p>
        </div>
        <div className="inline-controls">
          <input
            placeholder="Search menu item or category"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="button" className="ghost-btn" onClick={() => void loadCore()}>
            Refresh
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id}>
                  <td>{item.name}</td>
                  <td>{item.category ?? "-"}</td>
                  <td>{item.isActive ? "Active" : "Inactive"}</td>
                  <td className="action-cell">
                    <button type="button" onClick={() => handleEdit(item)}>
                      Edit
                    </button>
                    <button type="button" onClick={() => void loadRecipe(item._id)}>
                      Recipe
                    </button>
                    <button type="button" className="danger-btn" onClick={() => void handleDelete(item._id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4}>No menu items yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <form className="panel stack-form" onSubmit={handleSaveMenuItem}>
        <div className="panel-header">
          <h3>{editingId ? "Edit Menu Item" : "Create Menu Item"}</h3>
          {editingId ? (
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                setEditingId(null);
                setForm({ name: "", category: "", isActive: true });
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>

        <div className="form-grid">
          <label>
            Name
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </label>
          <label>
            Category
            <input
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            Active
          </label>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary-btn" type="submit">
          {editingId ? "Update Menu Item" : "Create Menu Item"}
        </button>
      </form>

      <div className="panel">
        <div className="panel-header">
          <h3>
            Recipe Editor {selectedMenuItem ? `for ${selectedMenuItem.name}` : "(select a menu item)"}
          </h3>
          {selectedMenuItemId ? (
            <button type="button" className="ghost-btn" onClick={addRecipeLine}>
              Add Line
            </button>
          ) : null}
        </div>

        {selectedMenuItemId ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th>Qty per Item</th>
                    <th>Unit</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recipeLines.map((line, index) => {
                    const ingredient = ingredients.find((item) => item._id === line.ingredientId);
                    return (
                      <tr key={`${line.ingredientId}-${index}`}>
                        <td>
                          <select
                            value={line.ingredientId}
                            onChange={(event) => {
                              const next = ingredients.find((item) => item._id === event.target.value);
                              updateRecipeLine(index, {
                                ingredientId: event.target.value,
                                unit: next?.unit ?? "",
                              });
                            }}
                          >
                            {ingredients.map((ingredientItem) => (
                              <option value={ingredientItem._id} key={ingredientItem._id}>
                                {ingredientItem.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.001"
                            value={line.qtyPerMenuItem}
                            onChange={(event) =>
                              updateRecipeLine(index, { qtyPerMenuItem: event.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            value={line.unit}
                            onChange={(event) => updateRecipeLine(index, { unit: event.target.value })}
                          />
                          {ingredient ? <small className="muted">Ingredient unit: {ingredient.unit}</small> : null}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="danger-btn"
                            onClick={() =>
                              setRecipeLines((prev) => prev.filter((_, rowIndex) => rowIndex !== index))
                            }
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {recipeLines.length === 0 ? (
                    <tr>
                      <td colSpan={4}>No recipe lines yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <button type="button" className="primary-btn" onClick={saveRecipe}>
              Save Recipe
            </button>
          </>
        ) : (
          <div className="empty-state">
            <h4>Select a menu item to map ingredients</h4>
            <p>Usage calculations require complete recipe mappings for sold menu items.</p>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Unmapped Menu Items from Sales</h3>
        </div>
        {unmapped.length === 0 ? (
          <p className="muted">No unmapped menu item names detected.</p>
        ) : (
          <ul className="audit-list">
            {unmapped.map((item) => (
              <li key={item.menuItemName}>
                {item.menuItemName} ({item.records} sales rows)
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default MenuItemsPage;
