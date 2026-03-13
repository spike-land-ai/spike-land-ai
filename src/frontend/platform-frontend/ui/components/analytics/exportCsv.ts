/**
 * Downloads an array of row objects as a CSV file.
 * All values are stringified and double-quote-escaped.
 */
export function downloadCsv(rows: Record<string, unknown>[], filename: string): void {
  if (rows.length === 0) return;

  const firstRow = rows[0];
  if (!firstRow) return;
  const headers = Object.keys(firstRow);
  const escape = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    // Wrap in quotes if contains comma, newline, or quote
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Builds a timestamped filename like "analytics-events-24h-2026-03-13.csv" */
export function csvFilename(prefix: string, range: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${prefix}-${range}-${date}.csv`;
}
