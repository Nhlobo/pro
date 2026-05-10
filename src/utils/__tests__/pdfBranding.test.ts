import { describe, it, expect } from "vitest";
import { jsPDF } from "jspdf";
import { addBrandingToPDF, addBrandingFooter, drawWrappedText } from "@/utils/pdfBranding";

const SIDE_MARGIN = 14;
const LONG_TITLE =
  "Comprehensive Medico-Legal Reports Covering All Referring Attorneys, Claimants, Experts, Appointments and Reporting Periods Across Multiple Provinces";
const LONG_SUBTITLE =
  "Bi-Annually (end of December 2025) — Reporting Period covering 01 July 2025 to 31 December 2025 across every region and matter type currently tracked by Kutlwano & Associate";

/**
 * Wrap doc.text to capture every drawn string with its x position,
 * so we can assert the resulting bounding box stays within the page margins.
 */
function instrumentDoc(doc: jsPDF) {
  const calls: Array<{ text: string; x: number; y: number; width: number; right: number; align?: string }> = [];
  const original = doc.text.bind(doc);
  (doc as any).text = (text: any, x: number, y: number, options?: any) => {
    const str = Array.isArray(text) ? text.join(" ") : String(text ?? "");
    const width = doc.getTextWidth(str);
    const align = options?.align;
    let left = x;
    if (align === "center") left = x - width / 2;
    else if (align === "right") left = x - width;
    calls.push({ text: str, x, y, width, right: left + width, align });
    return original(text, x, y, options);
  };
  return calls;
}

function assertWithinMargins(
  calls: Array<{ text: string; right: number; x: number; width: number; align?: string }>,
  pageWidth: number,
) {
  const rightLimit = pageWidth - SIDE_MARGIN;
  for (const c of calls) {
    const left = c.align === "center" ? c.x - c.width / 2 : c.align === "right" ? c.x - c.width : c.x;
    expect(c.right, `text "${c.text}" exceeds right margin (${c.right} > ${rightLimit})`).toBeLessThanOrEqual(
      rightLimit + 0.5,
    );
    expect(left, `text "${c.text}" crosses left margin (${left} < ${SIDE_MARGIN})`).toBeGreaterThanOrEqual(
      SIDE_MARGIN - 0.5,
    );
  }
}

describe("pdfBranding text wrapping", () => {
  it("drawWrappedText keeps every produced line within maxWidth", () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - SIDE_MARGIN * 2;
    const calls = instrumentDoc(doc);

    drawWrappedText(doc, LONG_TITLE, pageWidth / 2, 30, maxWidth, 7, { align: "center" });

    expect(calls.length).toBeGreaterThan(1); // long string must wrap
    for (const c of calls) {
      expect(c.width).toBeLessThanOrEqual(maxWidth + 0.5);
    }
    assertWithinMargins(calls, pageWidth);
  });

  it("addBrandingToPDF wraps long titles/subtitles within margins (portrait)", () => {
    const doc = new jsPDF();
    const calls = instrumentDoc(doc);
    addBrandingToPDF(doc, LONG_TITLE, LONG_SUBTITLE);
    assertWithinMargins(calls, doc.internal.pageSize.getWidth());
  });

  it("addBrandingToPDF wraps long titles/subtitles within margins (landscape)", () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const calls = instrumentDoc(doc);
    addBrandingToPDF(doc, LONG_TITLE, LONG_SUBTITLE);
    assertWithinMargins(calls, doc.internal.pageSize.getWidth());
  });

  it("subsequent pages (footer branding) also stay within margins", () => {
    const doc = new jsPDF();
    addBrandingToPDF(doc, LONG_TITLE, LONG_SUBTITLE);
    doc.addPage();
    doc.addPage();
    const calls = instrumentDoc(doc);
    addBrandingFooter(doc);
    expect(calls.length).toBeGreaterThan(0);
    assertWithinMargins(calls, doc.internal.pageSize.getWidth());
  });
});
