import jsPDF from "jspdf";

export interface VideoCallPdfData {
  participantName: string;
  sellerName?: string | null;
  productName?: string | null;
  phone?: string | null;
  dateLabel: string;
  durationLabel?: string | null;
  meetingUrl?: string | null;
  source?: string | null;
  analysis: string;
}

const GOLD: [number, number, number] = [168, 136, 74];
const INK: [number, number, number] = [24, 24, 27];
const MUTED: [number, number, number] = [113, 113, 122];
const BORDER: [number, number, number] = [228, 228, 231];

// Remove emojis/symbols the built-in font can't render
function sanitize(t: string): string {
  return t
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{2B00}-\u{2BFF}]/gu, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...");
}
function clean(t: string): string {
  return sanitize(t)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/(^|\s)\*(\S.*?)\*/g, "$1$2")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .trim();
}

export function exportVideoCallAnalysisPDF(d: VideoCallPdfData) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 18;
  const CW = W - M * 2;
  const BOTTOM = H - 18;
  let y = M;

  const ensure = (h: number) => {
    if (y + h > BOTTOM) {
      pdf.addPage();
      y = M;
    }
  };

  // Header band
  pdf.setFillColor(...INK);
  pdf.rect(0, 0, W, 30, "F");
  pdf.setTextColor(...GOLD);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("ANÁLISE DE CALL COMERCIAL", M, 11);
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(17);
  const title = pdf.splitTextToSize(sanitize(d.participantName || "Videochamada"), CW)[0];
  pdf.text(title, M, 21);
  y = 38;

  // Info grid
  const info: [string, string][] = [
    ["Vendedor", d.sellerName || "Não informado"],
    ["Data da call", d.dateLabel],
    ["Produto", d.productName || "Não vinculado"],
    ["Telefone", d.phone || "-"],
  ];
  if (d.durationLabel) info.push(["Duração", d.durationLabel]);
  if (d.source) info.push(["Origem", d.source]);
  const colW = CW / 2;
  const rows = Math.ceil(info.length / 2);
  const boxH = rows * 12 + 4;
  pdf.setDrawColor(...BORDER);
  pdf.setFillColor(250, 250, 250);
  pdf.roundedRect(M, y, CW, boxH, 2, 2, "FD");
  info.forEach(([k, v], i) => {
    const cx = M + 5 + (i % 2) * colW;
    const cy = y + 7 + Math.floor(i / 2) * 12;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text(k.toUpperCase(), cx, cy);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...INK);
    pdf.text(pdf.splitTextToSize(sanitize(v), colW - 8)[0], cx, cy + 5);
  });
  y += boxH + 4;

  if (d.meetingUrl) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...MUTED);
    pdf.text("Gravação: ", M, y + 3);
    pdf.setTextColor(...GOLD);
    const url = pdf.splitTextToSize(d.meetingUrl, CW - 18)[0];
    pdf.textWithLink(url, M + 15, y + 3, { url: d.meetingUrl });
    y += 8;
  }
  y += 4;

  // Body
  const lines = d.analysis.replace(/\r/g, "").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { y += 2; continue; }
    if (/^(-{3,}|\*{3,})$/.test(line)) {
      ensure(4);
      pdf.setDrawColor(...BORDER);
      pdf.line(M, y, M + CW, y);
      y += 4;
      continue;
    }
    const h = line.match(/^(#{1,6})\s*(.+)/);
    if (h) {
      const lvl = h[1].length;
      const txt = clean(h[2]);
      const size = lvl <= 2 ? 13 : 11;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(size);
      const w = pdf.splitTextToSize(txt, CW);
      ensure(w.length * 6 + 6);
      y += lvl <= 2 ? 4 : 2;
      pdf.setTextColor(...(lvl <= 2 ? GOLD : INK));
      w.forEach((l: string) => { pdf.text(l, M, y); y += size * 0.45; });
      if (lvl <= 2) {
        pdf.setDrawColor(...GOLD);
        pdf.setLineWidth(0.4);
        pdf.line(M, y - 2, M + CW, y - 2);
        pdf.setLineWidth(0.2);
        y += 2;
      }
      y += 1.5;
      continue;
    }
    const bullet = line.match(/^[-•*]\s+(.+)/);
    const num = line.match(/^(\d+)[.)]\s+(.+)/);
    const quote = line.match(/^>\s*(.+)/);
    const boldOnly = /^\*\*[^*]+\*\*:?$/.test(line);
    pdf.setFontSize(10);
    pdf.setTextColor(...INK);
    if (bullet || num) {
      pdf.setFont("helvetica", "normal");
      const txt = clean((bullet ? bullet[1] : num![2]));
      const w = pdf.splitTextToSize(txt, CW - 7);
      w.forEach((l: string, i: number) => {
        ensure(5);
        if (i === 0) {
          if (bullet) { pdf.setFillColor(...GOLD); pdf.circle(M + 1.8, y - 1.2, 0.9, "F"); }
          else { pdf.setFont("helvetica", "bold"); pdf.setTextColor(...GOLD); pdf.text(`${num![1]}.`, M, y); pdf.setFont("helvetica", "normal"); pdf.setTextColor(...INK); }
        }
        pdf.text(l, M + 7, y);
        y += 5;
      });
      y += 0.8;
      continue;
    }
    if (quote) {
      pdf.setFont("helvetica", "italic");
      pdf.setTextColor(...MUTED);
      const w = pdf.splitTextToSize(clean(quote[1]), CW - 8);
      w.forEach((l: string) => {
        ensure(5);
        pdf.setFillColor(...GOLD);
        pdf.rect(M, y - 3.8, 0.8, 5, "F");
        pdf.text(l, M + 5, y);
        y += 5;
      });
      y += 1;
      continue;
    }
    pdf.setFont("helvetica", boldOnly ? "bold" : "normal");
    const w = pdf.splitTextToSize(clean(line), CW);
    w.forEach((l: string) => { ensure(5); pdf.text(l, M, y); y += 5; });
    y += 1;
  }

  // Footer
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text(sanitize(`${d.participantName} · ${d.sellerName || ""} · ${d.dateLabel}`), M, H - 9);
    pdf.text(`Página ${i} de ${total}`, W - M, H - 9, { align: "right" });
  }

  const safe = (d.participantName || "call").replace(/[^\w\-]+/g, "_").slice(0, 60);
  pdf.save(`analise-${safe}.pdf`);
}
