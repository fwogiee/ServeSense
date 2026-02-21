import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiRequest } from "../api/client";
import { useAuth } from "../auth/AuthContext";

interface WorksheetItem {
  ingredientId: string;
  ingredientName: string;
  vendor?: string;
  unit: string;
  costPerUnit: number;
  currentStock: number;
  parLevel: number;
  recommendedQty: number;
  finalQty: number;
  estimatedCost: number;
  reorderUnit?: string;
  conversionFactor?: number;
  recommendedReorderUnits?: number;
  finalReorderUnits?: number;
}

interface WorksheetResponse {
  generatedAt: string;
  totalEstimatedCost: number;
  items: WorksheetItem[];
}

interface ReorderPlan {
  _id: string;
  createdAt: string;
  weekStartDate?: string;
  createdBy?: { email?: string };
  items: Array<{
    ingredientId:
      | string
      | {
          _id: string;
          name: string;
          unit?: string;
          vendor?: string;
        };
    recommendedQty: number;
    finalQty: number;
    estimatedCost: number;
    reorderUnits?: number;
  }>;
}

const ReorderPage = () => {
  const { token } = useAuth();
  const [editingItems, setEditingItems] = useState<WorksheetItem[]>([]);
  const [plans, setPlans] = useState<ReorderPlan[]>([]);
  const [weekStartDate, setWeekStartDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorksheet = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<WorksheetResponse>("/reorder-plans/worksheet", { token });
      setEditingItems(data.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate worksheet.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadPlans = useCallback(async () => {
    if (!token) return;
    const data = await apiRequest<{ items: ReorderPlan[] }>("/reorder-plans", { token });
    setPlans(data.items);
  }, [token]);

  useEffect(() => {
    void Promise.all([loadWorksheet(), loadPlans()]);
  }, [loadPlans, loadWorksheet]);

  const totalEstimatedCost = useMemo(
    () =>
      editingItems.reduce((sum, item) => {
        const finalQty = Number(item.finalQty) || 0;
        return sum + finalQty * item.costPerUnit;
      }, 0),
    [editingItems]
  );

  const updateFinalQty = (ingredientId: string, value: string) => {
    setEditingItems((prev) =>
      prev.map((item) => (item.ingredientId === ingredientId ? { ...item, finalQty: Number(value) } : item))
    );
  };

  const savePlan = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await apiRequest("/reorder-plans", {
        method: "POST",
        token,
        body: {
          weekStartDate: weekStartDate || undefined,
          items: editingItems.map((item) => ({
            ingredientId: item.ingredientId,
            finalQty: Number(item.finalQty) || 0,
          })),
        },
      });
      await Promise.all([loadPlans(), loadWorksheet()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save reorder plan.");
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = async (planId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL ?? "/api"}/reorder-plans/${planId}/export.csv`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Export failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `reorder-plan-${planId}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (_error) {
      alert("Could not export CSV.");
    }
  };

  return (
    <section className="stack-section">
      <div className="panel">
        <div className="panel-header">
          <h2>Manual Reorder Worksheet</h2>
          <p>Recommended quantity = max(0, par level - current stock)</p>
        </div>
        {error ? <p className="form-error">{error}</p> : null}

        <div className="inline-controls">
          <label>
            Week Start (optional)
            <input
              type="date"
              value={weekStartDate}
              onChange={(event) => setWeekStartDate(event.target.value)}
            />
          </label>
          <button className="primary-btn" type="button" onClick={() => void savePlan()} disabled={loading}>
            {loading ? "Saving..." : "Save Reorder Plan"}
          </button>
          <button className="ghost-btn" type="button" onClick={() => void loadWorksheet()}>
            Regenerate
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ingredient</th>
                <th>Current</th>
                <th>Par</th>
                <th>Recommended Qty</th>
                <th>Final Qty</th>
                <th>Reorder Units</th>
                <th>Estimated Cost</th>
              </tr>
            </thead>
            <tbody>
              {editingItems.map((item) => {
                const finalQty = Number(item.finalQty) || 0;
                const estimatedCost = finalQty * item.costPerUnit;
                const reorderUnits =
                  item.conversionFactor && item.conversionFactor > 0
                    ? Math.ceil(finalQty / item.conversionFactor)
                    : null;
                return (
                  <tr key={item.ingredientId}>
                    <td>
                      {item.ingredientName}
                      <small className="muted">{item.vendor ?? ""}</small>
                    </td>
                    <td>
                      {item.currentStock} {item.unit}
                    </td>
                    <td>
                      {item.parLevel} {item.unit}
                    </td>
                    <td>
                      {item.recommendedQty} {item.unit}
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.001"
                        value={finalQty}
                        onChange={(event) => updateFinalQty(item.ingredientId, event.target.value)}
                      />
                    </td>
                    <td>{reorderUnits !== null ? `${reorderUnits} ${item.reorderUnit ?? "units"}` : "-"}</td>
                    <td>${estimatedCost.toFixed(2)}</td>
                  </tr>
                );
              })}
              {editingItems.length === 0 ? (
                <tr>
                  <td colSpan={7}>No ingredients available. Add ingredients first.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="summary-row">Total Estimated Cost: ${totalEstimatedCost.toFixed(2)}</p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Saved Reorder Plans</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Week Start</th>
                <th>Created By</th>
                <th>Items</th>
                <th>Cost</th>
                <th>Export</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const cost = plan.items.reduce((sum, item) => sum + item.estimatedCost, 0);
                return (
                  <tr key={plan._id}>
                    <td>{new Date(plan.createdAt).toLocaleString()}</td>
                    <td>{plan.weekStartDate ? new Date(plan.weekStartDate).toLocaleDateString() : "-"}</td>
                    <td>{plan.createdBy?.email ?? "-"}</td>
                    <td>{plan.items.length}</td>
                    <td>${cost.toFixed(2)}</td>
                    <td>
                      <button type="button" onClick={() => void exportCsv(plan._id)}>
                        CSV
                      </button>
                    </td>
                  </tr>
                );
              })}
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={6}>No reorder plans saved yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default ReorderPage;
