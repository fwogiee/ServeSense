import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { SalesRecord } from "../types";

interface PreviewData {
  filename: string;
  rowCount: number;
  headers: string[];
  previewRows: Array<Record<string, unknown>>;
}

const guessColumn = (headers: string[], options: string[]): string => {
  const normalizedHeaders = headers.map((header) => ({
    source: header,
    key: header.toLowerCase().replace(/\s+/g, ""),
  }));

  const match = normalizedHeaders.find((header) =>
    options.some((option) => header.key.includes(option))
  );
  return match?.source ?? headers[0] ?? "";
};

const SalesImportPage = () => {
  const { token } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState({
    date: "",
    menuItemName: "",
    qtySold: "",
    revenue: "",
    channel: "",
  });
  const [autoCreateMenuItems, setAutoCreateMenuItems] = useState(true);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    mappedCount: number;
    unmappedCount: number;
    errorCount: number;
    errorsSample: Array<{ row: number; message: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [salesRows, setSalesRows] = useState<SalesRecord[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");

  const [manualDate, setManualDate] = useState("");
  const [manualMenuItemName, setManualMenuItemName] = useState("");
  const [manualQty, setManualQty] = useState("1");
  const [manualRevenue, setManualRevenue] = useState("");
  const [manualChannel, setManualChannel] = useState("");

  const loadSales = useCallback(async () => {
    if (!token) return;
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (search.trim()) params.set("q", search.trim());
    const data = await apiRequest<{ items: SalesRecord[] }>(`/sales?${params.toString()}`, { token });
    setSalesRows(data.items);
  }, [fromDate, search, toDate, token]);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  const hasPreview = useMemo(() => Boolean(preview && preview.headers.length > 0), [preview]);

  const runPreview = async () => {
    if (!token || !file) {
      setError("Choose a CSV or XLSX file first.");
      return;
    }
    setLoading(true);
    setError(null);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", "preview");
      const data = await apiRequest<PreviewData>("/sales/import", {
        method: "POST",
        body: formData,
        token,
      });
      setPreview(data);
      setMapping({
        date: guessColumn(data.headers, ["date", "day", "soldon"]),
        menuItemName: guessColumn(data.headers, ["menuitem", "item", "product", "menu"]),
        qtySold: guessColumn(data.headers, ["qty", "quantity", "sold", "units"]),
        revenue: guessColumn(data.headers, ["revenue", "sales", "amount"]),
        channel: guessColumn(data.headers, ["channel", "source", "type"]),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to parse file.");
    } finally {
      setLoading(false);
    }
  };

  const commitImport = async () => {
    if (!token || !file || !preview) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", "commit");
      formData.append(
        "mapping",
        JSON.stringify({
          date: mapping.date,
          menuItemName: mapping.menuItemName,
          qtySold: mapping.qtySold,
          revenue: mapping.revenue || undefined,
          channel: mapping.channel || undefined,
        })
      );
      formData.append("autoCreateMenuItems", String(autoCreateMenuItems));

      const data = await apiRequest<{
        inserted: number;
        mappedCount: number;
        unmappedCount: number;
        errorCount: number;
        errorsSample: Array<{ row: number; message: string }>;
      }>("/sales/import", { method: "POST", body: formData, token });

      setImportResult(data);
      await loadSales();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Import failed.");
    } finally {
      setLoading(false);
    }
  };

  const submitManualSale = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setError(null);
    try {
      await apiRequest("/sales", {
        method: "POST",
        token,
        body: {
          date: manualDate,
          menuItemName: manualMenuItemName,
          qtySold: Number(manualQty),
          revenue: manualRevenue ? Number(manualRevenue) : undefined,
          channel: manualChannel || undefined,
        },
      });
      setManualMenuItemName("");
      setManualQty("1");
      setManualRevenue("");
      setManualChannel("");
      await loadSales();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Manual sale entry failed.");
    }
  };

  return (
    <section className="stack-section">
      <div className="panel stack-form">
        <div className="panel-header">
          <h2>Sales Import (CSV/XLSX)</h2>
          <p>Preview, map columns, validate rows, and commit sales data.</p>
        </div>
        <label>
          Upload file
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <div className="inline-controls">
          <button type="button" className="primary-btn" onClick={() => void runPreview()} disabled={loading}>
            {loading ? "Working..." : "Preview File"}
          </button>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={autoCreateMenuItems}
              onChange={(event) => setAutoCreateMenuItems(event.target.checked)}
            />
            Auto-create missing menu items
          </label>
        </div>
        {error ? <p className="form-error">{error}</p> : null}

        {hasPreview && preview ? (
          <>
            <div className="panel sub-panel">
              <h3>
                Mapping for {preview.filename} ({preview.rowCount} rows)
              </h3>
              <div className="form-grid">
                <label>
                  Date
                  <select
                    value={mapping.date}
                    onChange={(event) => setMapping((prev) => ({ ...prev, date: event.target.value }))}
                  >
                    {preview.headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Menu Item Name
                  <select
                    value={mapping.menuItemName}
                    onChange={(event) =>
                      setMapping((prev) => ({ ...prev, menuItemName: event.target.value }))
                    }
                  >
                    {preview.headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Qty Sold
                  <select
                    value={mapping.qtySold}
                    onChange={(event) => setMapping((prev) => ({ ...prev, qtySold: event.target.value }))}
                  >
                    {preview.headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Revenue (optional)
                  <select
                    value={mapping.revenue}
                    onChange={(event) => setMapping((prev) => ({ ...prev, revenue: event.target.value }))}
                  >
                    <option value="">Not mapped</option>
                    {preview.headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Channel (optional)
                  <select
                    value={mapping.channel}
                    onChange={(event) => setMapping((prev) => ({ ...prev, channel: event.target.value }))}
                  >
                    <option value="">Not mapped</option>
                    {preview.headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                type="button"
                className="primary-btn"
                onClick={() => void commitImport()}
                disabled={loading}
              >
                {loading ? "Importing..." : "Commit Import"}
              </button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {preview.headers.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.previewRows.map((row, index) => (
                    <tr key={index}>
                      {preview.headers.map((header) => (
                        <td key={header}>{String(row[header] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="muted">Upload a file and run preview to configure mapping.</p>
        )}

        {importResult ? (
          <div className="panel sub-panel">
            <h3>Import Summary</h3>
            <p>
              Inserted: {importResult.inserted} | Mapped: {importResult.mappedCount} | Unmapped:{" "}
              {importResult.unmappedCount} | Errors: {importResult.errorCount}
            </p>
            {importResult.errorsSample.length > 0 ? (
              <ul className="audit-list">
                {importResult.errorsSample.map((entry) => (
                  <li key={`${entry.row}-${entry.message}`}>
                    Row {entry.row}: {entry.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <form className="panel stack-form" onSubmit={submitManualSale}>
        <div className="panel-header">
          <h3>Add Manual Sales Record</h3>
        </div>
        <div className="form-grid">
          <label>
            Date
            <input
              type="date"
              value={manualDate}
              onChange={(event) => setManualDate(event.target.value)}
              required
            />
          </label>
          <label>
            Menu Item Name
            <input
              value={manualMenuItemName}
              onChange={(event) => setManualMenuItemName(event.target.value)}
              required
            />
          </label>
          <label>
            Qty Sold
            <input
              type="number"
              step="0.001"
              value={manualQty}
              onChange={(event) => setManualQty(event.target.value)}
              required
            />
          </label>
          <label>
            Revenue
            <input
              type="number"
              step="0.01"
              value={manualRevenue}
              onChange={(event) => setManualRevenue(event.target.value)}
            />
          </label>
          <label>
            Channel
            <input
              value={manualChannel}
              onChange={(event) => setManualChannel(event.target.value)}
            />
          </label>
        </div>
        <button className="primary-btn" type="submit">
          Save Manual Record
        </button>
      </form>

      <div className="panel">
        <div className="panel-header">
          <h3>Sales Browser</h3>
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
          <input
            placeholder="Search menu item or channel"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button className="ghost-btn" type="button" onClick={() => void loadSales()}>
            Refresh
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Menu Item</th>
                <th>Qty Sold</th>
                <th>Revenue</th>
                <th>Channel</th>
              </tr>
            </thead>
            <tbody>
              {salesRows.map((row) => (
                <tr key={row._id}>
                  <td>{new Date(row.date).toLocaleDateString()}</td>
                  <td>{row.menuItemName}</td>
                  <td>{row.qtySold}</td>
                  <td>{row.revenue !== undefined ? `$${row.revenue.toFixed(2)}` : "-"}</td>
                  <td>{row.channel ?? "-"}</td>
                </tr>
              ))}
              {salesRows.length === 0 ? (
                <tr>
                  <td colSpan={5}>No sales records found for the selected filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default SalesImportPage;
