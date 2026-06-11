import { Document, Page, Text, View, StyleSheet, Image, Font } from "@react-pdf/renderer";

// Brand palette inspired by the reference PDF
const CREAM = "#FAF6EC";
const GOLD = "#C9A86A";
const GOLD_DARK = "#A8884A";
const INK = "#1A1A1A";
const HIGHLIGHT = "#FFE680";

export type SummaryBlock =
  | { type: "paragraph"; text: string }
  | { type: "quote"; author: string; text: string }
  | { type: "highlight"; text: string }
  | { type: "list"; title?: string; items: string[] };

export type SummarySection = {
  heading: string;
  blocks: SummaryBlock[];
};

export interface SummaryDoc {
  title: string;        // e.g. "DIA 1"
  subtitle?: string;
  date: string;         // e.g. "15/03/2026"
  coverImageUrl?: string | null;
  sections: SummarySection[];
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: CREAM,
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
    color: INK,
  },
  coverPage: {
    backgroundColor: "#0B0F14",
    color: "#fff",
    padding: 0,
  },
  coverImage: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 } as any,
  coverOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  coverInner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 56,
  },
  coverBrand: {
    fontSize: 14,
    letterSpacing: 6,
    color: "#fff",
    marginBottom: 24,
    fontFamily: "Helvetica-Bold",
  },
  coverTitle: {
    fontSize: 96,
    fontFamily: "Helvetica-Bold",
    color: "#fff",
    letterSpacing: 2,
    textAlign: "center",
  },
  coverDate: {
    fontSize: 22,
    color: GOLD,
    marginTop: 16,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
  },
  coverSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    marginTop: 24,
    textAlign: "center",
    maxWidth: 380,
  },
  sectionHeading: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: GOLD_DARK,
    marginBottom: 16,
    textAlign: "center",
  },
  paragraph: {
    fontSize: 11.5,
    lineHeight: 1.7,
    marginBottom: 10,
    color: INK,
  },
  quoteWrap: {
    marginVertical: 10,
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
  },
  quoteText: {
    fontSize: 11.5,
    lineHeight: 1.7,
    fontStyle: "italic",
    color: INK,
  },
  quoteAuthor: {
    fontFamily: "Helvetica-Bold",
    fontStyle: "normal",
  },
  highlight: {
    backgroundColor: HIGHLIGHT,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginVertical: 10,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: INK,
    borderLeftWidth: 3,
    borderLeftColor: GOLD_DARK,
  },
  listTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    marginTop: 8,
    marginBottom: 6,
    color: GOLD_DARK,
  },
  listItem: {
    fontSize: 11.5,
    lineHeight: 1.6,
    marginBottom: 4,
    color: INK,
    paddingLeft: 8,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 9,
    letterSpacing: 4,
    color: GOLD_DARK,
    fontFamily: "Helvetica-Bold",
  },
  pageNum: {
    position: "absolute",
    bottom: 24,
    right: 32,
    fontSize: 8,
    color: GOLD_DARK,
  },
  sectionContainer: {
    marginBottom: 28,
  },
});

function Block({ block }: { block: SummaryBlock }) {
  switch (block.type) {
    case "paragraph":
      return <Text style={styles.paragraph}>{block.text}</Text>;
    case "quote":
      return (
        <View style={styles.quoteWrap}>
          <Text style={styles.quoteText}>
            <Text style={styles.quoteAuthor}>{block.author}: </Text>
            “{block.text}”
          </Text>
        </View>
      );
    case "highlight":
      return <Text style={styles.highlight}>{block.text}</Text>;
    case "list":
      return (
        <View>
          {block.title ? <Text style={styles.listTitle}>{block.title}</Text> : null}
          {block.items.map((it, i) => (
            <Text key={i} style={styles.listItem}>•  {it}</Text>
          ))}
        </View>
      );
    default:
      return null;
  }
}

export function SummaryPDF({ doc }: { doc: SummaryDoc }) {
  return (
    <Document>
      {/* Cover */}
      <Page size="A4" style={styles.coverPage}>
        {doc.coverImageUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={doc.coverImageUrl} style={styles.coverImage} />
        ) : null}
        <View style={styles.coverOverlay} />
        <View style={styles.coverInner}>
          <Text style={styles.coverBrand}>ETERNUM ∞ CLUB</Text>
          <Text style={styles.coverTitle}>{doc.title || "DIA"}</Text>
          {doc.date ? <Text style={styles.coverDate}>{doc.date}</Text> : null}
          {doc.subtitle ? <Text style={styles.coverSubtitle}>{doc.subtitle}</Text> : null}
        </View>
      </Page>

      {/* Content pages — each section on a fresh page for readability */}
      {(doc.sections || []).map((section, idx) => (
        <Page key={idx} size="A4" style={styles.page} wrap>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            {(section.blocks || []).map((b, i) => (
              <Block key={i} block={b} />
            ))}
          </View>
          <Text style={styles.footer} fixed>E T E R N U M  ∞  C L U B</Text>
          <Text style={styles.pageNum} fixed render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </Page>
      ))}
    </Document>
  );
}

export default SummaryPDF;
