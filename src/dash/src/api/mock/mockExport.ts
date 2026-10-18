import type { ExportedFile } from "../client";
import type { Finding, Report, ReportFormat } from "@/types";

// metadata only: detailed evidence is never part of an export
const EXPORT_NOTE = "Metadata export. Detailed evidence stays on the local engine.";

type ExportRow = ReturnType<typeof toExportRow>;

function toExportRow(finding: Finding) {
  return {
    id: finding.id,
    title: finding.title,
    severity: finding.severity,
    status: finding.status,
    strategy: finding.strategy,
    target: finding.targetName,
    model: finding.model,
    success_rate: finding.reliability.successRate,
    ci_low: finding.reliability.ciLow,
    ci_high: finding.reliability.ciHigh,
    confidence: finding.reliability.confidence,
    taxonomy: finding.taxonomy.map((ref) => ref.id).join(" "),
    discovered_at: finding.discoveredAt,
  };
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function htmlEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildJson(report: Report, rows: ExportRow[], baseName: string): ExportedFile {
  const content = JSON.stringify(
    {
      report: { id: report.id, name: report.name, kind: report.kind, run_id: report.runId, generated_at: report.generatedAt },
      note: EXPORT_NOTE,
      findings: rows,
    },
    null,
    2,
  );
  return { filename: `${baseName}.json`, mime: "application/json", content };
}

function buildCsv(rows: ExportRow[], baseName: string): ExportedFile {
  const columns = rows.length ? Object.keys(rows[0]) : ["id"];
  const toLine = (row: ExportRow) => columns.map((column) => csvCell(row[column as keyof ExportRow])).join(",");
  const lines = [columns.join(","), ...rows.map(toLine)];
  return { filename: `${baseName}.csv`, mime: "text/csv", content: lines.join("\n") };
}

function buildHtml(report: Report, rows: ExportRow[], baseName: string): ExportedFile {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const toCells = (row: ExportRow) => columns.map((column) => `<td>${htmlEscape(row[column as keyof ExportRow])}</td>`).join("");
  const body = rows.map((row) => `<tr>${toCells(row)}</tr>`).join("\n");
  const head = columns.map((column) => `<th>${htmlEscape(column)}</th>`).join("");
  const title = htmlEscape(report.name);
  const content =
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1>` +
    `<p>${EXPORT_NOTE}</p><table border="1" cellpadding="4"><thead><tr>${head}</tr></thead>` +
    `<tbody>${body}</tbody></table></body></html>`;
  return { filename: `${baseName}.html`, mime: "text/html", content };
}

export function buildExport(report: Report, format: ReportFormat, findings: Finding[]): ExportedFile {
  const rows = findings
    .filter((finding) => (report.campaignId ? finding.campaignId === report.campaignId : finding.projectId === report.projectId))
    .map(toExportRow);
  const baseName = report.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  if (format === "json") return buildJson(report, rows, baseName);
  if (format === "csv") return buildCsv(rows, baseName);
  return buildHtml(report, rows, baseName);
}
