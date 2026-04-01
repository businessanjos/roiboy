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
  return value >= 1_000_000 ? `R$ ${(value / 1_000_000).toFixed(1)}M` : `R$ ${(value / 1000).toFixed(0)}k`;
}

function cleanMd(text: string): string {
  return text.replace(/\*\*\*(.*?)\*\*\*/g, "$1").replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/^#{1,4}\s*/, "").trim();
}

const COLORS = {
  darkBg: [22, 22, 30] as const,
  accent: [220, 55, 55] as const,
  white: [255, 255, 255] as const,
  lightGray: [160, 160, 170] as const,
  bodyText: [45, 45, 55] as const,
  mutedText: [100, 100, 110] as const,
  bulletDot: [140, 140, 155] as const,
  cardBg: [248, 248, 252] as const,
  divider: [230, 230, 235] as const,
};

const SECTION_COLORS: Record<string, readonly [number, number, number]> = {
  "RANKING": [180, 140, 20],
  "PERFIL": [120, 80, 180],
  "PADRÕES": [200, 50, 50],
  "SINAIS": [200, 140, 20],
  "TIMING": [140, 60, 180],
  "SENTIMENTO": [40, 100, 200],
  "MOTIVO": [60, 60, 70],
  "RECOMENDAÇÕES": [20, 150, 85],
  "SCORE": [200, 50, 50],
  "AÇÕES": [200, 50, 50],
};

function getSectionColor(title: string): readonly [number, number, number] {
  const upper = title.toUpperCase();
  for (const [key, color] of Object.entries(SECTION_COLORS)) {
    if (upper.includes(key)) return color;
  }
  return [60, 60, 70];
}

export async function exportChurnToPDF(insights: string, meta?: ChurnPDFMeta | null): Promise<void> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 16; // margin
  const CW = W - M * 2; // content width
  let y = 0;

  const checkPage = (space: number) => {
    if (y + space > H - 20) { pdf.addPage(); y = 16; }
  };

  // ═══════════════════════════ HEADER ═══════════════════════════
  pdf.setFillColor(...COLORS.darkBg);
  pdf.rect(0, 0, W, 42, "F");

  // Red accent stripe
  pdf.setFillColor(...COLORS.accent);
  pdf.rect(0, 0, W, 2.5, "F");

  // Tag
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...COLORS.accent);
  pdf.text("RELATÓRIO DE CHURN", M, 13);

  // Title
  pdf.setFontSize(17);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...COLORS.white);
  pdf.text("Análise de Cancelamentos", M, 24);

  // Subtitle / period
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...COLORS.lightGray);
  const parts: string[] = [];
  if (meta?.periodStart && meta?.periodEnd) {
    parts.push(`${formatDateBR(meta.periodStart)}  →  ${formatDateBR(meta.periodEnd)}`);
  }
  parts.push(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`);
  pdf.text(parts.join("   •   "), M, 35);

  y = 50;

  // ═══════════════════════════ META STATS ═══════════════════════════
  if (meta) {
    const stats = [
      { label: "CANCELAMENTOS", value: String(meta.contractsAnalyzed), alert: true },
      { label: "MENSAGENS ANALISADAS", value: String(meta.totalMessages), alert: false },
      { label: meta.totalValue ? "VALOR PERDIDO" : "COM CONVERSAS", value: meta.totalValue ? formatCurrency(meta.totalValue) : String(meta.clientsWithMessages), alert: !!meta.totalValue },
    ];

    const boxW = (CW - 6) / 3;
    const boxH = 20;
    stats.forEach((s, i) => {
      const x = M + i * (boxW + 3);

      // Background
      if (s.alert) {
        pdf.setFillColor(255, 242, 242);
        pdf.setDrawColor(230, 120, 120);
      } else {
        pdf.setFillColor(...COLORS.cardBg);
        pdf.setDrawColor(...COLORS.divider);
      }
      pdf.setLineWidth(0.3);
      pdf.roundedRect(x, y, boxW, boxH, 2, 2, "FD");

      // Value
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      if (s.alert) pdf.setTextColor(200, 45, 45);
      else pdf.setTextColor(...COLORS.bodyText);
      pdf.text(s.value, x + boxW / 2, y + 11, { align: "center" });

      // Label
      pdf.setFontSize(6);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...COLORS.mutedText);
      pdf.text(s.label, x + boxW / 2, y + 17, { align: "center" });
    });

    y += boxH + 6;
  }

  // ═══════════════════════════ SECTIONS ═══════════════════════════
  const lines = insights.split("\n");
  let inSection = false;
  let currentColor: readonly [number, number, number] = [60, 60, 70];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "---") continue;

    const isHeader =
      trimmed.match(/^#{1,4}\s/) ||
      trimmed.match(/^\*\*[^*]+\*\*$/) ||
      trimmed.match(/^[🔍⚠️💬🕐📊🎯📈🛡️🏆👤🚨🔥]/u);

    if (isHeader) {
      const cleaned = cleanMd(trimmed).replace(/^[🔍⚠️💬🕐📊🎯📈🛡️🏆👤🚨🔥]\s*/u, "");
      currentColor = getSectionColor(cleaned);

      checkPage(20);
      y += 6;

      // Colored accent bar
      pdf.setFillColor(currentColor[0], currentColor[1], currentColor[2]);
      pdf.roundedRect(M, y - 3.5, 2, 9, 1, 1, "F");

      // Section background
      pdf.setFillColor(currentColor[0], currentColor[1], currentColor[2]);
      pdf.setGState(new (pdf as any).GState({ opacity: 0.04 }));
      pdf.roundedRect(M + 4, y - 4.5, CW - 4, 11, 1.5, 1.5, "F");
      pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

      // Title
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(currentColor[0], currentColor[1], currentColor[2]);
      pdf.text(cleaned, M + 8, y + 2.5);

      y += 10;
      inSection = true;
      continue;
    }

    if (!inSection) continue;

    const cleaned = cleanMd(trimmed);
    if (!cleaned) continue;

    const isBullet = cleaned.startsWith("•") || cleaned.startsWith("-") || cleaned.match(/^\d+[\.\)]/);
    const text = cleaned.replace(/^[•\-]\s*/, "").replace(/^\d+[\.\)]\s*/, "");

    checkPage(7);

    if (isBullet) {
      pdf.setFillColor(currentColor[0], currentColor[1], currentColor[2]);
      pdf.circle(M + 5, y - 0.5, 0.7, "F");

      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...COLORS.bodyText);

      const wrapped = pdf.splitTextToSize(text, CW - 14);
      wrapped.forEach((wl: string, wi: number) => {
        if (wi > 0) checkPage(4.5);
        pdf.text(wl, M + 9, y);
        y += 4.2;
      });
      y += 0.5;
    } else {
      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...COLORS.mutedText);

      const wrapped = pdf.splitTextToSize(text, CW - 8);
      wrapped.forEach((wl: string, wi: number) => {
        if (wi > 0) checkPage(4.5);
        pdf.text(wl, M + 6, y);
        y += 4.2;
      });
      y += 0.5;
    }
  }

  // ═══════════════════════════ FOOTER ═══════════════════════════
  const total = pdf.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);

    // Subtle footer line
    pdf.setDrawColor(...COLORS.divider);
    pdf.setLineWidth(0.2);
    pdf.line(M, H - 14, W - M, H - 14);

    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...COLORS.lightGray);
    pdf.text(`${p} / ${total}`, W - M, H - 8, { align: "right" });
    pdf.text("Análise gerada por IA  •  Dados confidenciais", M, H - 8);
  }

  pdf.save("analise-churn.pdf");
}
