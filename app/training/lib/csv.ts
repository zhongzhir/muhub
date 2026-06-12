function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(rows: Array<Array<string | number | boolean | null | undefined>>): string {
  const body = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(",")).join("\n");
  return `\uFEFF${body}${body ? "\n" : ""}`;
}

export function csvDownloadHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };
}
