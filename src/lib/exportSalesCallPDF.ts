import jsPDF from 'jspdf';

const COLORS = {
  primary: [99, 102, 241] as number[],
  blue: [59, 130, 246] as number[],
  emerald: [16, 185, 129] as number[],
  amber: [245, 158, 11] as number[],
  red: [239, 68, 68] as number[],
  purple: [147, 51, 234] as number[],
  green: [34, 197, 94] as number[],
  orange: [249, 115, 22] as number[],
  cyan: [6, 182, 212] as number[],
  textPrimary: [17, 24, 39] as number[],
  textSecondary: [107, 114, 128] as number[],
  border: [229, 231, 235] as number[],
  background: [249, 250, 251] as number[],
};

interface SalesCallPDFData {
  analysis: string;
  createdAt: string;
}

function parseSections(text: string): { emoji: string; title: string; content: string }[] {
  const sections: { emoji: string; title: string; content: string }[] = [];
  const regex = /^##\s*([\p{Emoji_Presentation}\p{Emoji}\u200d]*)\s*(.+)$/gmu;
  let match: RegExpExecArray | null;
  const matches: { index: number; emoji: string; title: string }[] = [];
  while ((match = regex.exec(text)) !== null) {
    matches.push({ index: match.index, emoji: match[1]?.trim() || '', title: match[2].trim() });
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + text.substring(matches[i].index).indexOf('\n') + 1;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    sections.push({ emoji: matches[i].emoji, title: matches[i].title, content: text.substring(start, end).trim() });
  }
  if (sections.length === 0 && text.trim()) {
    sections.push({ emoji: '', title: 'Análise', content: text.trim() });
  }
  return sections;
}

function cleanMarkdown(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`(.*?)`/g, '$1').replace(/^#+\s*/gm, '').trim();
}

const SECTION_COLORS: Record<string, number[]> = {
  'resumo': COLORS.blue, 'geral': COLORS.blue, 'objeções': COLORS.red, 'objecoes': COLORS.red,
  'erros': COLORS.orange, 'pontos fortes': COLORS.emerald, 'acertos': COLORS.emerald,
  'diagnóstico': COLORS.amber, 'diagnostico': COLORS.amber, 'perdas': COLORS.amber,
  'script': COLORS.purple, 'melhorado': COLORS.purple, 'ações': COLORS.cyan, 'acoes': COLORS.cyan,
  'imediatas': COLORS.cyan, 'top': COLORS.cyan,
};

function getSectionColor(title: string): number[] {
  const lower = title.toLowerCase();
  for (const [key, color] of Object.entries(SECTION_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return COLORS.primary;
}

export function exportSalesCallToPDF(data: SalesCallPDFData): void {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPage = (space: number) => {
    if (y + space > pageHeight - margin) { pdf.addPage(); y = margin; }
  };

  pdf.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  pdf.rect(0, 0, pageWidth, 32, 'F');
  pdf.setFontSize(18); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(255, 255, 255);
  pdf.text('Análise de Call de Vendas', margin, 14);
  pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
  const dateStr = new Date(data.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  pdf.text(dateStr, margin, 24);
  y = 42;

  const sections = parseSections(data.analysis);
  for (const section of sections) {
    const color = getSectionColor(section.title);
    checkPage(18);
    pdf.setFontSize(13); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(color[0], color[1], color[2]);
    const displayTitle = section.emoji ? `${section.emoji} ${section.title}` : section.title;
    pdf.text(cleanMarkdown(displayTitle), margin, y);
    y += 2; pdf.setDrawColor(color[0], color[1], color[2]); pdf.setLineWidth(0.6);
    pdf.line(margin, y, margin + contentWidth, y); y += 6;

    const lines = section.content.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) { y += 2; continue; }

      const subHeaderMatch = line.match(/^###\s*(.+)/) || line.match(/^\*\*(.+?)\*\*\s*$/);
      if (subHeaderMatch) {
        checkPage(10); pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(color[0], color[1], color[2]);
        pdf.text(cleanMarkdown(subHeaderMatch[1]), margin + 2, y); y += 6; continue;
      }

      const bulletMatch = line.match(/^[-•]\s*(.+)/);
      if (bulletMatch) {
        const text = cleanMarkdown(bulletMatch[1]);
        pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(COLORS.textSecondary[0], COLORS.textSecondary[1], COLORS.textSecondary[2]);
        const wrapped = pdf.splitTextToSize(text, contentWidth - 14);
        checkPage(5 * wrapped.length);
        pdf.setFillColor(color[0], color[1], color[2]); pdf.circle(margin + 5, y - 1.2, 1.3, 'F');
        for (const wLine of wrapped) { pdf.text(wLine, margin + 10, y); y += 5; }
        y += 1; continue;
      }

      const numberedMatch = line.match(/^(\d+)\.\s*(.+)/);
      if (numberedMatch) {
        const num = numberedMatch[1]; const text = cleanMarkdown(numberedMatch[2]);
        pdf.setFontSize(10);
        const wrapped = pdf.splitTextToSize(text, contentWidth - 16);
        checkPage(5 * wrapped.length);
        pdf.setFillColor(color[0], color[1], color[2]); pdf.circle(margin + 5, y - 1.5, 3, 'F');
        pdf.setTextColor(255, 255, 255); pdf.setFontSize(7); pdf.setFont('helvetica', 'bold');
        pdf.text(num, margin + 5 - pdf.getTextWidth(num) / 2, y - 0.5);
        pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(COLORS.textPrimary[0], COLORS.textPrimary[1], COLORS.textPrimary[2]);
        for (const wLine of wrapped) { pdf.text(wLine, margin + 14, y); y += 5; }
        y += 2; continue;
      }

      const quoteMatch = line.match(/^>\s*(.+)/);
      if (quoteMatch) {
        const text = cleanMarkdown(quoteMatch[1]);
        pdf.setFontSize(10); pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(COLORS.textSecondary[0], COLORS.textSecondary[1], COLORS.textSecondary[2]);
        const wrapped = pdf.splitTextToSize(text, contentWidth - 16);
        checkPage(5 * wrapped.length + 4);
        pdf.setFillColor(color[0], color[1], color[2]); pdf.rect(margin + 3, y - 4, 2, 5 * wrapped.length + 2, 'F');
        for (const wLine of wrapped) { pdf.text(wLine, margin + 10, y); y += 5; }
        y += 2; continue;
      }

      pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(COLORS.textPrimary[0], COLORS.textPrimary[1], COLORS.textPrimary[2]);
      const wrapped = pdf.splitTextToSize(cleanMarkdown(line), contentWidth);
      checkPage(5 * wrapped.length);
      for (const wLine of wrapped) { pdf.text(wLine, margin, y); y += 5; }
      y += 1;
    }
    y += 6;
  }

  // Footer
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(COLORS.textSecondary[0], COLORS.textSecondary[1], COLORS.textSecondary[2]);
    pdf.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  pdf.save(`analise-call-${new Date(data.createdAt).toISOString().split('T')[0]}.pdf`);
}
