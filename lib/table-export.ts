export type ExportCell = string | number;

function cellText(value: ExportCell, delimiter: string): string {
  const text = String(value);
  if (delimiter === "\t") return text.replace(/[\t\r\n]+/g, " ");
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Таблица с табуляцией — при вставке в Excel / Google Таблицы раскладывается по ячейкам. */
export function tableToTsv(rows: ExportCell[][]): string {
  return rows.map((row) => row.map((v) => cellText(v, "\t")).join("\t")).join("\n");
}

/** CSV для русского Excel: разделитель «;» и BOM, чтобы кириллица открывалась без настройки. */
export function downloadCsv(filename: string, rows: ExportCell[][]): void {
  const body = rows.map((row) => row.map((v) => cellText(v, ";")).join(";")).join("\r\n");
  const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
