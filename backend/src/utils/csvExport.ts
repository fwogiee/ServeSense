export const toCsv = (
  rows: Array<Record<string, string | number | null | undefined>>,
  headers: string[]
): string => {
  const escapeCell = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) {
      return "";
    }
    const raw = String(value);
    const escaped = raw.replace(/"/g, "\"\"");
    if (/[",\n]/.test(raw)) {
      return `"${escaped}"`;
    }
    return escaped;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    const line = headers.map((header) => escapeCell(row[header])).join(",");
    lines.push(line);
  }
  return lines.join("\n");
};
