import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { HROffboarding } from "@/hooks/useHROffboardings";
import { OFFBOARDING_STAGE_LABELS } from "@/hooks/useHROffboardings";
import { TERMINATION_TYPE_LABELS } from "@/lib/rescissionCalc";
import { computeLegalDeadlines } from "@/lib/offboardingDeadlines";

const fmtBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export function exportOffboardingDossier(o: HROffboarding, opts: {
  checklist?: Array<{ label: string; category: string; done: boolean }>;
  documents?: Array<{ file_name: string; category: string; created_at: string }>;
  timeline?: Array<{ event_type: string; description: string | null; created_at: string }>;
}) {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  let y = 18;

  doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text("Dossiê de Desligamento", w / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, w / 2, y, { align: "center" });
  y += 10;

  // Header colaborador
  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text(o.collaborator?.full_name || "Colaborador", 14, y); y += 6;
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.text(`Cargo: ${o.collaborator?.position || "—"}`, 14, y); y += 5;
  doc.text(`Departamento: ${o.collaborator?.department || "—"}`, 14, y); y += 5;
  doc.text(`Admissão: ${o.collaborator?.hire_date ? format(new Date(o.collaborator.hire_date + "T00:00:00"), "dd/MM/yyyy") : "—"}`, 14, y); y += 8;

  // Dados do desligamento
  doc.setFont("helvetica", "bold"); doc.text("Dados do desligamento", 14, y); y += 6;
  doc.setFont("helvetica", "normal");
  const rows: Array<[string, string]> = [
    ["Tipo", TERMINATION_TYPE_LABELS[o.termination_type]],
    ["Iniciado por", o.initiated_by],
    ["Etapa", OFFBOARDING_STAGE_LABELS[o.stage] || o.stage],
    ["Comunicado em", o.notice_communicated_at ? format(new Date(o.notice_communicated_at + "T00:00:00"), "dd/MM/yyyy") : "—"],
    ["Último dia trabalhado", o.last_day_worked ? format(new Date(o.last_day_worked + "T00:00:00"), "dd/MM/yyyy") : "—"],
    ["Data efetiva", o.termination_date ? format(new Date(o.termination_date + "T00:00:00"), "dd/MM/yyyy") : "—"],
    ["Aviso prévio", `${o.notice_type || "—"} (${o.notice_days || 0} dias)`],
    ["Motivo", o.reason || "—"],
  ];
  rows.forEach(([k, v]) => { doc.text(`${k}: `, 14, y); doc.text(String(v), 60, y); y += 5; });
  if (o.reason_details) {
    y += 2; doc.setFont("helvetica", "italic");
    const lines = doc.splitTextToSize(`Detalhes: ${o.reason_details}`, w - 28);
    doc.text(lines, 14, y); y += lines.length * 4.5;
    doc.setFont("helvetica", "normal");
  }
  y += 4;

  // Prazos legais
  if (o.termination_date) {
    if (y > 240) { doc.addPage(); y = 18; }
    doc.setFont("helvetica", "bold"); doc.text("Prazos legais", 14, y); y += 6;
    doc.setFont("helvetica", "normal");
    computeLegalDeadlines(o.termination_date).forEach((d) => {
      doc.text(`• ${d.label}: ${format(d.dueDate, "dd/MM/yyyy")} (${d.daysRemaining >= 0 ? `em ${d.daysRemaining} dias` : `${Math.abs(d.daysRemaining)} dias em atraso`})`, 14, y);
      y += 5;
    });
    y += 4;
  }

  // Rescisão
  const r = (o.rescission_calc as any)?.result;
  if (r) {
    if (y > 220) { doc.addPage(); y = 18; }
    doc.setFont("helvetica", "bold"); doc.text("Cálculo de Rescisão (estimativa)", 14, y); y += 6;
    doc.setFont("helvetica", "normal");
    (r.lines || []).forEach((l: any) => {
      doc.text(l.label, 14, y); doc.text(fmtBRL(l.value), w - 14, y, { align: "right" }); y += 4.5;
      if (y > 270) { doc.addPage(); y = 18; }
    });
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.text("Bruto:", 14, y); doc.text(fmtBRL(r.gross), w - 14, y, { align: "right" }); y += 5;
    doc.text("Descontos:", 14, y); doc.text(fmtBRL(r.deductions), w - 14, y, { align: "right" }); y += 5;
    doc.text("Líquido a pagar:", 14, y); doc.text(fmtBRL(r.net), w - 14, y, { align: "right" }); y += 5;
    doc.setFont("helvetica", "normal");
    doc.text("Depósito FGTS:", 14, y); doc.text(fmtBRL(r.fgtsDeposit), w - 14, y, { align: "right" }); y += 5;
    doc.text("Multa FGTS:", 14, y); doc.text(fmtBRL(r.fgtsPenalty), w - 14, y, { align: "right" }); y += 6;
  }

  // Checklist
  if (opts.checklist?.length) {
    if (y > 230) { doc.addPage(); y = 18; }
    doc.setFont("helvetica", "bold"); doc.text("Checklist", 14, y); y += 6;
    doc.setFont("helvetica", "normal");
    opts.checklist.forEach((c) => {
      doc.text(`${c.done ? "[X]" : "[ ]"} ${c.label}  (${c.category})`, 14, y); y += 4.5;
      if (y > 280) { doc.addPage(); y = 18; }
    });
    y += 4;
  }

  // Documentos
  if (opts.documents?.length) {
    if (y > 240) { doc.addPage(); y = 18; }
    doc.setFont("helvetica", "bold"); doc.text("Documentos anexados", 14, y); y += 6;
    doc.setFont("helvetica", "normal");
    opts.documents.forEach((d) => {
      doc.text(`• ${d.file_name}  (${d.category}, ${format(new Date(d.created_at), "dd/MM/yyyy")})`, 14, y); y += 4.5;
      if (y > 280) { doc.addPage(); y = 18; }
    });
    y += 4;
  }

  // Timeline
  if (opts.timeline?.length) {
    if (y > 230) { doc.addPage(); y = 18; }
    doc.setFont("helvetica", "bold"); doc.text("Linha do tempo", 14, y); y += 6;
    doc.setFont("helvetica", "normal");
    opts.timeline.forEach((e) => {
      doc.text(`${format(new Date(e.created_at), "dd/MM HH:mm")} — ${e.description || e.event_type}`, 14, y);
      y += 4.5;
      if (y > 280) { doc.addPage(); y = 18; }
    });
  }

  // Entrevista
  if (o.exit_interview && Object.keys(o.exit_interview).length) {
    doc.addPage(); y = 18;
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text("Entrevista de Saída", 14, y); y += 8;
    doc.setFontSize(10);
    if (o.exit_nps != null) {
      doc.text(`NPS: ${o.exit_nps}/10`, 14, y); y += 6;
    }
    Object.entries(o.exit_interview as any).forEach(([k, v]: any) => {
      if (!v) return;
      doc.setFont("helvetica", "bold");
      const lines = doc.splitTextToSize(k, w - 28);
      doc.text(lines, 14, y); y += lines.length * 4.5;
      doc.setFont("helvetica", "normal");
      const vlines = doc.splitTextToSize(String(v), w - 28);
      doc.text(vlines, 14, y); y += vlines.length * 4.5 + 2;
      if (y > 270) { doc.addPage(); y = 18; }
    });
  }

  doc.save(`desligamento_${(o.collaborator?.full_name || "colaborador").replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`);
}
