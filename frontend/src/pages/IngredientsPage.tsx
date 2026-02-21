import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Ingredient } from "../types";

interface IngredientFormState {
  name: string;
  category: string;
  unit: string;
  currentStock: string;
  parLevel: string;
  reorderPoint: string;
  vendor: string;
  costPerUnit: string;
  reorderUnit: string;
  conversionFactor: string;
  notes: string;
}

interface StockLog {
  _id: string;
  delta: number;
  reason: string;
  createdAt: string;
  userId?: { email?: string };
}

const emptyForm: IngredientFormState = {
  name: "",
  category: "",
  unit: "each",
  currentStock: "0",
  parLevel: "0",
  reorderPoint: "",
  vendor: "",
  costPerUnit: "0",
  reorderUnit: "",
  conversionFactor: "",
  notes: "",
};

const toPayload = (form: IngredientFormState) => ({
  name: form.name.trim(),
  category: form.category.trim() || undefined,
  unit: form.unit.trim(),
  currentStock: Number(form.currentStock),
  parLevel: Number(form.parLevel),
  reorderPoint: form.reorderPoint.trim() ? Number(form.reorderPoint) : undefined,
  vendor: form.vendor.trim() || undefined,
  costPerUnit: Number(form.costPerUnit),
  reorderUnit: form.reorderUnit.trim() || undefined,
  conversionFactor: form.conversionFactor.trim() ? Number(form.conversionFactor) : undefined,
  notes: form.notes.trim() || undefined,
});

const IngredientsPage = () => {
  const { token } = useAuth();
  const [items, setItems] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [form, setForm] = useState<IngredientFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [adjustingIngredient, setAdjustingIngredient] = useState<Ingredient | null>(null);
  const [adjustDelta, setAdjustDelta] = useState("0");
  const [adjustReason, setAdjustReason] = useState("");
  const [logs, setLogs] = useState<StockLog[]>([]);
  const [logsIngredientId, setLogsIngredientId] = useState<string | null>(null);

  const loadIngredients = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (lowStockOnly) params.set("lowStock", "true");
      const data = await apiRequest<{ items: Ingredient[] }>(`/ingredients?${params.toString()}`, {
        token,
      });
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  }, [lowStockOnly, query, token]);

  useEffect(() => {
    void loadIngredients();
  }, [loadIngredients]);

  const lowStockCount = useMemo(
    () =>
      items.filter((ingredient) => {
        const threshold = ingredient.reorderPoint ?? ingredient.parLevel;
        return ingredient.currentStock <= threshold;
      }).length,
    [items]
  );

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError(null);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setError(null);

    try {
      const payload = toPayload(form);
      if (editingId) {
        await apiRequest(`/ingredients/${editingId}`, {
          method: "PUT",
          body: payload,
          token,
        });
      } else {
        await apiRequest("/ingredients", { method: "POST", body: payload, token });
      }
      resetForm();
      await loadIngredients();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save ingredient.");
    }
  };

  const handleEdit = (item: Ingredient) => {
    setEditingId(item._id);
    setForm({
      name: item.name,
      category: item.category ?? "",
      unit: item.unit,
      currentStock: String(item.currentStock),
      parLevel: String(item.parLevel),
      reorderPoint: item.reorderPoint !== undefined ? String(item.reorderPoint) : "",
      vendor: item.vendor ?? "",
      costPerUnit: String(item.costPerUnit),
      reorderUnit: item.reorderUnit ?? "",
      conversionFactor: item.conversionFactor !== undefined ? String(item.conversionFactor) : "",
      notes: item.notes ?? "",
    });
  };

  const handleDelete = async (id: string) => {
    if (!token || !confirm("Delete this ingredient?")) return;
    try {
      await apiRequest(`/ingredients/${id}`, { method: "DELETE", token });
      await loadIngredients();
      if (editingId === id) {
        resetForm();
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Delete failed.");
    }
  };

  const openAdjust = (ingredient: Ingredient) => {
    setAdjustingIngredient(ingredient);
    setAdjustDelta("0");
    setAdjustReason("");
  };

  const submitAdjustment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !adjustingIngredient) return;

    try {
      await apiRequest(`/ingredients/${adjustingIngredient._id}/adjust`, {
        method: "POST",
        token,
        body: {
          delta: Number(adjustDelta),
          reason: adjustReason,
        },
      });
      setAdjustingIngredient(null);
      await loadIngredients();
      if (logsIngredientId === adjustingIngredient._id) {
        await loadLogs(adjustingIngredient._id);
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Adjustment failed.");
    }
  };

  const loadLogs = async (ingredientId: string) => {
    if (!token) return;
    const data = await apiRequest<{ items: StockLog[] }>(
      `/ingredients/${ingredientId}/adjustments`,
      { token }
    );
    setLogs(data.items);
    setLogsIngredientId(ingredientId);
  };

  if (loading) {
    return <div className="centered-state">Loading ingredients...</div>;
  }

  return (
    <section className="stack-section">
      <div className="panel">
        <div className="panel-header">
          <h2>Ingredient Inventory</h2>
          <p>
            {items.length} items loaded, {lowStockCount} low-stock.
          </p>
        </div>

        <div className="inline-controls">
          <input
            placeholder="Search ingredient, category, vendor"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(event) => setLowStockOnly(event.target.checked)}
            />
            Low stock only
          </label>
          <button type="button" className="ghost-btn" onClick={() => void loadIngredients()}>
            Refresh
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Stock</th>
                <th>Par</th>
                <th>Unit</th>
                <th>Vendor</th>
                <th>Cost/Unit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const threshold = item.reorderPoint ?? item.parLevel;
                const isLow = item.currentStock <= threshold;
                return (
                  <tr key={item._id} className={isLow ? "low-stock-row" : ""}>
                    <td>{item.name}</td>
                    <td>{item.currentStock}</td>
                    <td>{item.parLevel}</td>
                    <td>{item.unit}</td>
                    <td>{item.vendor ?? "-"}</td>
                    <td>${item.costPerUnit.toFixed(2)}</td>
                    <td className="action-cell">
                      <button type="button" onClick={() => handleEdit(item)}>
                        Edit
                      </button>
                      <button type="button" onClick={() => openAdjust(item)}>
                        Adjust
                      </button>
                      <button type="button" onClick={() => void loadLogs(item._id)}>
                        Logs
                      </button>
                      <button type="button" className="danger-btn" onClick={() => void handleDelete(item._id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7}>No ingredients yet. Add your first ingredient below.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <form className="panel stack-form" onSubmit={handleSave}>
        <div className="panel-header">
          <h3>{editingId ? "Edit Ingredient" : "Add Ingredient"}</h3>
          {editingId ? (
            <button type="button" className="ghost-btn" onClick={resetForm}>
              Cancel edit
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
          <label>
            Unit
            <input
              value={form.unit}
              onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))}
              required
            />
          </label>
          <label>
            Current Stock
            <input
              type="number"
              step="0.001"
              value={form.currentStock}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, currentStock: event.target.value }))
              }
              required
            />
          </label>
          <label>
            Par Level
            <input
              type="number"
              step="0.001"
              value={form.parLevel}
              onChange={(event) => setForm((prev) => ({ ...prev, parLevel: event.target.value }))}
              required
            />
          </label>
          <label>
            Reorder Point
            <input
              type="number"
              step="0.001"
              value={form.reorderPoint}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, reorderPoint: event.target.value }))
              }
            />
          </label>
          <label>
            Vendor
            <input
              value={form.vendor}
              onChange={(event) => setForm((prev) => ({ ...prev, vendor: event.target.value }))}
            />
          </label>
          <label>
            Cost Per Unit
            <input
              type="number"
              step="0.001"
              value={form.costPerUnit}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, costPerUnit: event.target.value }))
              }
              required
            />
          </label>
          <label>
            Reorder Unit
            <input
              value={form.reorderUnit}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, reorderUnit: event.target.value }))
              }
            />
          </label>
          <label>
            Conversion Factor
            <input
              type="number"
              step="0.001"
              value={form.conversionFactor}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, conversionFactor: event.target.value }))
              }
            />
          </label>
        </div>

        <label>
          Notes
          <textarea
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary-btn" type="submit">
          {editingId ? "Update Ingredient" : "Create Ingredient"}
        </button>
      </form>

      {logsIngredientId ? (
        <div className="panel">
          <div className="panel-header">
            <h3>Stock Adjustment Audit Log</h3>
            <button type="button" className="ghost-btn" onClick={() => setLogsIngredientId(null)}>
              Hide
            </button>
          </div>
          <ul className="audit-list">
            {logs.map((log) => (
              <li key={log._id}>
                <strong>{log.delta > 0 ? `+${log.delta}` : log.delta}</strong> {log.reason} by{" "}
                {log.userId?.email ?? "Unknown"} on {new Date(log.createdAt).toLocaleString()}
              </li>
            ))}
            {logs.length === 0 ? <li>No adjustments yet.</li> : null}
          </ul>
        </div>
      ) : null}

      {adjustingIngredient ? (
        <div className="modal-backdrop">
          <form className="modal-card stack-form" onSubmit={submitAdjustment}>
            <h3>Adjust Stock: {adjustingIngredient.name}</h3>
            <label>
              Delta (+/-)
              <input
                type="number"
                step="0.001"
                value={adjustDelta}
                onChange={(event) => setAdjustDelta(event.target.value)}
                required
              />
            </label>
            <label>
              Reason
              <input
                value={adjustReason}
                onChange={(event) => setAdjustReason(event.target.value)}
                required
              />
            </label>
            <div className="inline-controls">
              <button type="submit" className="primary-btn">
                Apply
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setAdjustingIngredient(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
};

export default IngredientsPage;
