import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import { COMPANY_NAME, COMPANY_SLOGAN } from "@/utils/pdfBranding";

// Mirrors the sections produced by downloadNegligenceReport (PDF) in
// DocumentProofreading.tsx / Advisory.tsx, so the Word and PDF exports of
// the same analysis always contain the same content.
export interface NegligenceReportData {
  fileName?: string;
  meritOpinion?: {
    opinion: "possible_negligence" | "no_clear_negligence" | "defer";
    confidence: "low" | "medium" | "high";
    summary: string;
    keyFactors?: string[];
  };
  overallSeverity: string;
  documentTypesIdentified?: string[];
  factsSummary?: string;
  medicalTimeline?: {
    date: string;
    event: string;
    linkedNegligence?: string | null;
  }[];
  negligenceByType?: Record<string, { finding: string; severity: string; evidence: string }[]>;
  expertRecommendations?: {
    expertType: string;
    reason: string;
    priority: string;
    linkedNegligenceTypes?: string[];
  }[];
  missingInformation?: string[];
  extractionWarnings?: { fileName: string; note: string }[];
  disclaimer?: { text: string };
}

const BRAND_TEAL = "1FB6CE";
const HEADING_COLOR = "16A085";
const MUTED = "666666";

const heading = (text: string) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, bold: true, color: HEADING_COLOR })],
  });

const body = (text: string) =>
  new Paragraph({ spacing: { after: 150 }, children: [new TextRun({ text: text || "—" })] });

const bullet = (text: string) =>
  new Paragraph({ bullet: { level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text })] });

const opinionLabel = (opinion?: string) => {
  switch (opinion) {
    case "possible_negligence":
      return "⚠ POSSIBLE NEGLIGENCE IDENTIFIED";
    case "defer":
      return "⏸ ASSESSMENT DEFERRED — INSUFFICIENT INFORMATION";
    case "no_clear_negligence":
      return "✓ NO CLEAR NEGLIGENCE IDENTIFIED AT THIS STAGE";
    default:
      return "ASSESSMENT RESULT";
  }
};

/**
 * Builds a Word (.docx) version of the Advisory negligence analysis report,
 * mirroring the PDF export so users can choose either format. Returns a
 * Blob ready to be downloaded via file-saver style logic.
 */
export async function buildNegligenceWordReport(data: NegligenceReportData): Promise<Blob> {
  const children: (Paragraph | Table)[] = [];

  // Branding header
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: COMPANY_NAME, bold: true, size: 24, color: BRAND_TEAL })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: COMPANY_SLOGAN, italics: true, size: 18, color: MUTED })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.TITLE,
      spacing: { after: 100 },
      children: [new TextRun({ text: "Medical Negligence Advisory Report", bold: true })],
    }),
  );

  if (data.fileName) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text: `File: ${data.fileName}`, color: MUTED, size: 20 })],
      }),
    );
  }
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({ text: `Generated: ${new Date().toLocaleString()}`, color: MUTED, size: 18 }),
      ],
    }),
  );

  // Merit opinion summary
  if (data.meritOpinion) {
    children.push(heading(opinionLabel(data.meritOpinion.opinion)));
    children.push(body(data.meritOpinion.summary));
    children.push(
      new Paragraph({
        spacing: { after: 150 },
        children: [
          new TextRun({
            text: `Confidence: ${data.meritOpinion.confidence.toUpperCase()}`,
            bold: true,
          }),
          ...(data.meritOpinion.opinion !== "defer"
            ? [
                new TextRun({
                  text: `   |   Overall Severity: ${data.overallSeverity.toUpperCase()}`,
                  bold: true,
                }),
              ]
            : []),
        ],
      }),
    );
    if (data.meritOpinion.keyFactors?.length) {
      children.push(
        body(data.meritOpinion.opinion === "defer" ? "Why this was deferred:" : "Key Factors:"),
      );
      data.meritOpinion.keyFactors.slice(0, 10).forEach((f) => children.push(bullet(f)));
    }
    children.push(
      new Paragraph({
        spacing: { after: 300 },
        children: [
          new TextRun({
            italics: true,
            size: 18,
            color: "996600",
            text: "Note: This is a preliminary medico-legal screening opinion only, not a final expert opinion.",
          }),
        ],
      }),
    );
  }

  // Extraction warnings (client spec section 3)
  if (data.extractionWarnings?.length) {
    children.push(heading("Documents That May Not Have Been Reliably Read"));
    data.extractionWarnings.forEach((w) => children.push(bullet(`${w.fileName}: ${w.note}`)));
  }

  // Missing information (defer / spec section 6)
  if (data.missingInformation?.length) {
    children.push(heading("Records That Appear to Be Missing"));
    data.missingInformation.forEach((m) => children.push(bullet(m)));
  }

  // Document types
  if (data.documentTypesIdentified?.length) {
    children.push(heading("Document Types Identified"));
    children.push(body(data.documentTypesIdentified.map((t) => t.replace(/_/g, " ")).join(", ")));
  }

  // Facts summary
  if (data.factsSummary) {
    children.push(heading("Summary of Facts"));
    children.push(body(data.factsSummary));
  }

  // Timeline
  if (data.medicalTimeline?.length) {
    children.push(heading("Chronological Medical Timeline"));
    data.medicalTimeline.slice(0, 30).forEach((t) => {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: `${t.date || "Unknown date"}: `, bold: true }),
            new TextRun({ text: t.event }),
            ...(t.linkedNegligence
              ? [new TextRun({ text: `  (linked to ${t.linkedNegligence.replace(/_/g, " ")})`, color: "B00000", italics: true })]
              : []),
          ],
        }),
      );
    });
  }

  // Negligence findings by type
  if (data.negligenceByType && Object.keys(data.negligenceByType).length > 0) {
    children.push(heading("Negligence Findings by Type"));
    Object.entries(data.negligenceByType).forEach(([type, indicators]) => {
      children.push(
        new Paragraph({
          spacing: { before: 150, after: 80 },
          children: [new TextRun({ text: type.replace(/_/g, " ").toUpperCase(), bold: true })],
        }),
      );
      indicators.forEach((i) =>
        children.push(bullet(`[${i.severity.toUpperCase()}] ${i.finding} — ${i.evidence}`)),
      );
    });
  }

  // Expert recommendations
  if (data.expertRecommendations?.length) {
    children.push(heading("Recommended Expert Referrals"));
    const rows = [
      new TableRow({
        children: ["Expert", "Priority", "Reason"].map(
          (h) =>
            new TableCell({
              width: { size: 33, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
            }),
        ),
      }),
      ...data.expertRecommendations.map(
        (r) =>
          new TableRow({
            children: [r.expertType, r.priority.toUpperCase(), r.reason].map(
              (v) =>
                new TableCell({
                  width: { size: 33, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ children: [new TextRun({ text: v })] })],
                }),
            ),
          }),
      ),
    ];
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" },
        },
        rows,
      }),
    );
    // spacer after table
    children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
  }

  // Disclaimer
  if (data.disclaimer?.text) {
    children.push(heading("Disclaimer"));
    children.push(
      new Paragraph({
        spacing: { after: 150 },
        children: [new TextRun({ text: data.disclaimer.text, size: 18, color: MUTED, italics: true })],
      }),
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

/** Triggers a browser download of the given blob under the given filename. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
