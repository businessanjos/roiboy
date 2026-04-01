import jsPDF from "jspdf";

interface ChurnPDFMeta {
  contractsAnalyzed: number;
  clientsWithMessages: number;
  totalMessages: number;
  totalValue?: number;
  periodStart?: string | null;
  periodEnd?: string | null;
}

function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(value: number): string {
  return value >= 1_000_000
    ? `R$ ${(value / 1_000_000).toFixed(1)}M`
    : `R$ ${(value / 1000).toFixed(0)}k`;
}

function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*\*(.*?)\*\*\*/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^#{1,4}\s*/, "")
    .trim();
}

export async function exportChurnToPDF(insights: string, meta?: ChurnPDFMeta | null): Promise<void> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  const checkPage = (space: number) => {
    if (y + space > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  // ── Header bar ──
  pdf.setFillColor(20, 20, 28);
  pdf.rect(0, 0, pageWidth, 38, "F");
  pdf.setFillColor(220, 50, 50);
  pdf.rect(0, 0, pageWidth, 3, "F");

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(220, 80, 80);
  pdf.text("RELATÓRIO DE CHURN", margin, 14);

  pdf.setFontSize(15);
  pdf.setTextColor(255, 255, 255);
  pdf.text("Análise de Cancelamentos", margin, 24);

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(150, 150, 160);
  const dateParts: string[] = [];
  if (meta?.periodStart && meta?.periodEnd) {
    dateParts.push(`Período: ${formatDateBR(meta.periodStart)} — ${formatDateBR(meta.periodEnd)}`);
  }
  dateParts.push(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`);
  pdf.text(dateParts.join("  •  "), margin, 33);

  y = 44;

  // ── Meta stats row ──
  if (meta) {
    const stats = [
      { label: "Cancelamentos", value: String(meta.contractsAnalyzed), alert: true },
      { label: "Mensagens", value: String(meta.totalMessages), alert: false },
      { label: meta.totalValue ? "Valor perdido" : "Com conversas", value: meta.totalValue ? formatCurrency(meta.totalValue) : String(meta.clientsWithMessages), alert: !!meta.totalValue },
    ];

    const boxW = (contentWidth - 8) / 3;
    stats.forEach((s, i) => {
      const x = margin + i * (boxW + 4);
      if (s.alert) {
        pdf.setFillColor(255, 240, 240);
        pdf.setDrawColor(220, 80, 80);
      } else {
        pdf.setFillColor(245, 245, 248);
        pdf.setDrawColor(200, 200, 210);
      }
      pdf.roundedRect(x, y, boxW, 18, 2, 2, "FD");

      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(s.alert ? 200 : 40, s.alert ? 40 : 40, s.alert ? 40 : 50);
      pdf.text(s.value, x + boxW / 2, y + 10, { align: "center" });

      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(120, 120, 130);
      pdf.text(s.label, x + boxW / 2, y + 15, { align: "center" });
    });

    y += 24;
  }

  // ── Section colors ──
  const sectionColors: Record<string, [number, number, number]> = {
    "RANKING": [180, 140, 20],
    "PERFIL": [120, 80, 180],
    "PADRÕES": [200, 50, 50],
    "SINAIS": [200, 140, 20],
    "TIMING": [140, 60, 180],
    "SENTIMENTO": [40, 100, 200],
    "MOTIVO": [60, 60, 70],
    "RECOMENDAÇÕES": [20, 160, 90],
    "SCORE": [200, 50, 50],
    "AÇÕES": [200, 50, 50],
  };

  function getSectionColor(title: string): [number, number, number] {
    const upper = title.toUpperCase();
    for (const [key, color] of Object.entries(sectionColors)) {
      if (upper.includes(key)) return color;
    }
    return [60, 60, 70];
  }

  // ── Parse and render sections ──
  const lines = insights.split("\n");
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "---") continue;

    const isHeader =
      trimmed.match(/^#{1,4}\s/) ||
      trimmed.match(/^\*\*[^*]+\*\*$/) ||
      trimmed.match(/^[🔍⚠️💬🕐📊🎯📈🛡️🏆👤🚨]/u);

    if (isHeader) {
      const cleaned = cleanMarkdown(trimmed).replace(/^[🔍⚠️💬🕐📊🎯📈🛡️🏆👤🚨]\s*/u, "");
      const color = getSectionColor(cleaned);

      checkPage(18);
      y += 4;

      // Section header with colored left bar
      pdf.setFillColor(color[0], color[1], color[2]);
      pdf.rect(margin, y - 3, 2.5, 8, "F");

      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(color[0], color[1], color[2]);
      pdf.text(cleaned, margin + 6, y + 2);

      y += 8;
      inSection = true;
      continue;
    }

    if (!inSection) continue;

    const cleaned = cleanMarkdown(trimmed);
    if (!cleaned) continue;

    const isBullet = cleaned.startsWith("•") || cleaned.startsWith("-") || cleaned.match(/^\d+[\.\)]/);
    const text = cleaned.replace(/^[•\-]\s*/, "").replace(/^\d+[\.\)]\s*/, "");

    checkPage(8);

    if (isBullet) {
      // Bullet with dot
      pdf.setFillColor(140, 140, 150);
      pdf.circle(margin + 3, y - 0.8, 0.8, "F");

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(50, 50, 60);

      const wrappedLines = pdf.splitTextToSize(text, contentWidth - 10);
      wrappedLines.forEach((wl: string, wi: number) => {
        if (wi > 0) checkPage(5);
        pdf.text(wl, margin + 7, y);
        y += 4.5;
      });
    } else {
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(60, 60, 70);

      const wrappedLines = pdf.splitTextToSize(text, contentWidth - 4);
      wrappedLines.forEach((wl: string, wi: number) => {
        if (wi > 0) checkPage(5);
        pdf.text(wl, margin + 4, y);
        y += 4.5;
      });
    }
  }

  // ── Footer on all pages ──
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(160, 160, 170);
    pdf.text(`Página ${p} de ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" });
    pdf.text("Análise gerada por IA • Dados confidenciais", pageWidth / 2, pageHeight - 4, { align: "center" });
  }

  pdf.save("analise-churn.pdf");
}
