import jsPDF from 'jspdf';

export interface PlaybookPDFData {
  title: string;
  scriptType: string;
  content: string;
  createdAt: string;
  menteeName?: string;
  companyName?: string;
}

function cleanMarkdown(t: string): string {
  return t.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`(.*?)`/g, '$1').replace(/^#+\s*/gm, '').trim();
}

export async function exportPlaybookToPDF(data: PlaybookPDFData): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPage = (space: number) => {
    if (y + space > pageHeight - margin) { pdf.addPage(); y = margin; }
  };

  // Header
  pdf.setFillColor(20, 20, 28);
  pdf.rect(0, 0, pageWidth, 40, 'F');
  pdf.setFillColor(189, 155, 75);
  pdf.rect(0, 0, pageWidth, 4, 'F');

  pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(189, 155, 75);
  pdf.text('PLAYBOOK DE VENDAS', margin, 16);
  pdf.setFontSize(16); pdf.setTextColor(255, 255, 255);
  pdf.text(data.title, margin, 28);
  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(150, 148, 155);
  const meta = [data.scriptType, new Date(data.createdAt).toLocaleDateString('pt-BR')].filter(Boolean).join(' • ');
  pdf.text(meta, margin, 36);

  y = 50;

  // Content
  const lines = data.content.split('\n');
  const sectionColors = [
    [59, 130, 246], [16, 185, 129], [245, 158, 11], [147, 51, 234],
    [239, 68, 68], [6, 182, 212], [249, 115, 22], [34, 197, 94],
  ];
  let colorIdx = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { y += 2; continue; }
    if (line === '---') { y += 4; continue; }

    // H2 sections
    if (line.startsWith('## ')) {
      const color = sectionColors[colorIdx % sectionColors.length];
      colorIdx++;
      checkPage(14);
      y += 4;
      pdf.setFontSize(13); pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(color[0], color[1], color[2]);
      pdf.text(cleanMarkdown(line.replace(/^## /, '')), margin, y);
      y += 2; pdf.setDrawColor(color[0], color[1], color[2]); pdf.setLineWidth(0.5);
      pdf.line(margin, y, margin + contentWidth, y); y += 6;
      continue;
    }

    // H3
    if (line.startsWith('### ')) {
      checkPage(10); pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(55, 55, 65);
      pdf.text(cleanMarkdown(line.replace(/^### /, '')), margin + 2, y); y += 6; continue;
    }

    // Bold lines
    const boldMatch = line.match(/^\*\*(.+?)\*\*\s*$/);
    if (boldMatch) {
      checkPage(8); pdf.setFontSize(10); pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(55, 55, 65);
      pdf.text(cleanMarkdown(boldMatch[1]), margin + 2, y); y += 5; continue;
    }

    // Quotes
    if (line.startsWith('> ')) {
      const text = cleanMarkdown(line.replace(/^>\s*/, ''));
      pdf.setFontSize(10); pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(100, 100, 110);
      const wrapped = pdf.splitTextToSize(text, contentWidth - 14);
      checkPage(5 * wrapped.length + 4);
      pdf.setFillColor(189, 155, 75); pdf.rect(margin + 3, y - 4, 2, 5 * wrapped.length + 2, 'F');
      for (const w of wrapped) { pdf.text(w, margin + 10, y); y += 5; }
      y += 2; continue;
    }

    // Bullets
    const bulletMatch = line.match(/^[-•*]\s+(.+)/);
    if (bulletMatch) {
      const text = cleanMarkdown(bulletMatch[1]);
      pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 110);
      const wrapped = pdf.splitTextToSize(text, contentWidth - 14);
      checkPage(5 * wrapped.length);
      pdf.setFillColor(189, 155, 75); pdf.circle(margin + 5, y - 1.2, 1, 'F');
      for (const w of wrapped) { pdf.text(w, margin + 10, y); y += 5; }
      y += 1; continue;
    }

    // Numbered
    const numMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      const text = cleanMarkdown(numMatch[2]);
      pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(55, 55, 65);
      const wrapped = pdf.splitTextToSize(text, contentWidth - 14);
      checkPage(5 * wrapped.length);
      pdf.setFont('helvetica', 'bold'); pdf.text(`${numMatch[1]}.`, margin + 2, y);
      pdf.setFont('helvetica', 'normal');
      for (const w of wrapped) { pdf.text(w, margin + 10, y); y += 5; }
      y += 1; continue;
    }

    // Regular text
    pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(55, 55, 65);
    const wrapped = pdf.splitTextToSize(cleanMarkdown(line), contentWidth);
    checkPage(5 * wrapped.length);
    for (const w of wrapped) { pdf.text(w, margin, y); y += 5; }
    y += 1;
  }

  // Footer
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(150, 148, 155);
    pdf.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  pdf.save(`playbook-${data.title.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}
