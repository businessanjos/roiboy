import { format } from "date-fns";
import { getChannelLabel, getInitiatedByLabel, getKindLabel } from "@/lib/cs/checkins";

function escapeCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

export function buildCsv(headers: string[], rows: (unknown[])[]): string {
  const lines = [headers.map(escapeCell).join(";")];
  for (const row of rows) lines.push(row.map(escapeCell).join(";"));
  // BOM para o Excel reconhecer acentuação
  return "\uFEFF" + lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function fileStamp() {
  return format(new Date(), "yyyy-MM-dd_HH-mm");
}

export interface CheckinExportRow {
  client_name?: string | null;
  consultant_name?: string | null;
  happened_at: string;
  kind: string;
  channel: string;
  initiated_by: string;
  source: string;
  summary: string;
  message_count?: number | null;
}

export const CHECKIN_CSV_HEADERS = [
  "Cliente",
  "Consultor",
  "Data",
  "Hora",
  "Tipo",
  "Canal",
  "Quem procurou",
  "Origem",
  "Mensagens",
  "Resumo",
];

export function checkinToCsvRow(r: CheckinExportRow) {
  const at = new Date(r.happened_at);
  return [
    r.client_name || "",
    r.consultant_name || (r.source === "ai_whatsapp" ? "Resumo automático (IA)" : ""),
    format(at, "dd/MM/yyyy"),
    format(at, "HH:mm"),
    getKindLabel(r.kind),
    getChannelLabel(r.channel),
    getInitiatedByLabel(r.initiated_by),
    r.source === "ai_whatsapp" ? "IA (WhatsApp)" : "Manual",
    r.message_count ?? "",
    r.summary || "",
  ];
}
