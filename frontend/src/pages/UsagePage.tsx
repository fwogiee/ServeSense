import { useEffect, useState } from "react";
import { ApiError, apiRequest } from "../api/client";
import { useAuth } from "../auth/AuthContext";

interface UsageItem {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  totalUsed: number;
  estimatedCost: number;
  projectedStock?: number;
  topContributingMenuItems: Array<{
    menuItemId: string;
    menuItemName: string;
    usedQty: number;
  }>;
}

interface UsageBlocked {
  blocked: true;
  message: string;
  unmappedMenuItems?: Array<{ menuItemName: string; records: number }>;
  missingRecipes?: Array<{ menuItemName: string }>;
}

interface UsageSuccess {
  blocked: false;
  salesCount: number;
  totals: { ingredientCount: number; estimatedCost: number };
  items: UsageItem[];
}

type UsageResponse = UsageBlocked | UsageSuccess;

const formatDateInput = (date: Date): string => date.toISOString().slice(0, 10);

const UsagePage = () => {
  const { token } = useAuth();
  const [fromDate, setFromDate] = useState(() => {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return formatDateInput(start);
  });
  const [toDate, setToDate] = useState(() => formatDateInput(new Date()));
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadUsage = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<UsageResponse>(
        `/usage/ingredients?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(
          toDate
        )}&includeStockImpact=true`,
        { token }
      );
      setUsage(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.details) {
        setUsage(err.details as UsageResponse);
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to run usage report.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <section className="stack-section">
      <div className="panel">
        <div className="panel-header">
          <h2>Deterministic Ingredient Usage</h2>
          <p>Usage = actual sales x recipe quantities.</p>
        </div>
        <div className="inline-controls">
          <label>
            From
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </label>
          <button className="primary-btn" type="button" onClick={() => void loadUsage()} disabled={loading}>
            {loading ? "Calculating..." : "Run Usage"}
          </button>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
      </div>

      {usage?.blocked ? (
        <div className="panel warning-panel">
          <h3>Usage Blocked</h3>
          <p>{usage.message}</p>
          {usage.unmappedMenuItems?.length ? (
            <>
              <h4>Unmapped sales menu items</h4>
              <ul className="audit-list">
                {usage.unmappedMenuItems.map((item) => (
                  <li key={item.menuItemName}>
                    {item.menuItemName} ({item.records} rows)
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {usage.missingRecipes?.length ? (
            <>
              <h4>Missing recipe mappings</h4>
              <ul className="audit-list">
                {usage.missingRecipes.map((item) => (
                  <li key={item.menuItemName}>{item.menuItemName}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {usage && !usage.blocked ? (
        <div className="panel">
          <div className="panel-header">
            <h3>Ingredient Usage Report</h3>
            <p>
              {usage.salesCount} sales rows | {usage.totals.ingredientCount} ingredients | $
              {usage.totals.estimatedCost.toFixed(2)} estimated cost
            </p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Total Used</th>
                  <th>Estimated Cost</th>
                  <th>Projected Stock</th>
                  <th>Top Contributing Menu Items</th>
                </tr>
              </thead>
              <tbody>
                {usage.items.map((item) => (
                  <tr key={item.ingredientId}>
                    <td>{item.ingredientName}</td>
                    <td>
                      {item.totalUsed} {item.unit}
                    </td>
                    <td>${item.estimatedCost.toFixed(2)}</td>
                    <td>{item.projectedStock !== undefined ? `${item.projectedStock} ${item.unit}` : "-"}</td>
                    <td>
                      {item.topContributingMenuItems.length === 0 ? (
                        "-"
                      ) : (
                        <ul className="mini-list">
                          {item.topContributingMenuItems.map((menuItem) => (
                            <li key={menuItem.menuItemId}>
                              {menuItem.menuItemName}: {menuItem.usedQty}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
                {usage.items.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No usage for selected dates.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default UsagePage;
