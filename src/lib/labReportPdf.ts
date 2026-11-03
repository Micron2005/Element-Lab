import type { jsPDF } from "jspdf";
import { pdfSafe, type LabReportDoc, type ReportSection } from "./labReport";
import { tr, translateTree } from "./i18n";

type PdfDocument = jsPDF;

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CONTENT_BOTTOM = PAGE_HEIGHT - 66;
const BODY_SIZE = 10.5;
const LINE_HEIGHT = 14;

function wrapped(pdf: PdfDocument, text: string, width: number): string[] {
  return pdf.splitTextToSize(pdfSafe(text), width) as string[];
}

function sectionOpeningHeight(pdf: PdfDocument, section: ReportSection): number {
  if (section.paragraph) {
    return Math.max(1, wrapped(pdf, section.paragraph, CONTENT_WIDTH).length) * LINE_HEIGHT;
  }
  if (section.rows?.length) {
    const [, value] = section.rows[0];
    return Math.max(1, wrapped(pdf, value, CONTENT_WIDTH - 162).length) * LINE_HEIGHT + 6;
  }
  if (section.table?.rows.length) {
    const columnWidth = CONTENT_WIDTH / section.table.head.length;
    return Math.max(...section.table.rows[0].map((cell) => wrapped(pdf, cell, columnWidth - 10).length), 1) * LINE_HEIGHT + 34;
  }
  if (section.bullets?.length) {
    return Math.max(1, wrapped(pdf, section.bullets[0], CONTENT_WIDTH - 18).length) * LINE_HEIGHT;
  }
  return section.ruledLines ? LINE_HEIGHT : 0;
}

export async function renderLabReportBytes(doc: LabReportDoc): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const locale = doc.locale ?? "en";
  doc = translateTree(locale, doc);
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  let y = MARGIN;

  const newPage = () => {
    pdf.addPage();
    y = MARGIN;
  };
  const ensureSpace = (height: number) => {
    if (y + height > CONTENT_BOTTOM) newPage();
  };
  const drawLines = (lines: string[], x: number, size = BODY_SIZE, lineHeight = LINE_HEIGHT) => {
    pdf.setFontSize(size);
    for (const line of lines) {
      ensureSpace(lineHeight);
      pdf.text(line, x, y);
      y += lineHeight;
    }
  };

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(tr(locale, "ui.reportHeader"), MARGIN, y);
  y += 27;
  pdf.setFontSize(20);
  const titleLines = wrapped(pdf, doc.title, CONTENT_WIDTH);
  for (const line of titleLines) {
    ensureSpace(25);
    pdf.text(line, MARGIN, y);
    y += 25;
  }
  y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(BODY_SIZE);
  pdf.text(`${pdfSafe(tr(locale, "ui.reportName"))} ${pdfSafe(doc.student?.trim() || "____________________")}`, MARGIN, y);
  pdf.text(
    `${pdfSafe(tr(locale, "ui.reportDate"))} ${pdfSafe(doc.createdAt.toLocaleDateString(locale === "es" ? "es" : "en-US", { year: "numeric", month: "long", day: "numeric" }))}`,
    PAGE_WIDTH - MARGIN - 180,
    y,
  );
  y += LINE_HEIGHT;
  pdf.text(`${pdfSafe(tr(locale, "ui.reportType"))} ${pdfSafe(doc.kind)}`, MARGIN, y);
  y += 12;
  pdf.setDrawColor(160, 170, 170);
  pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 17;

  for (const section of doc.sections) {
    const openingHeight = sectionOpeningHeight(pdf, section);
    if (!openingHeight) continue;
    ensureSpace(23 + openingHeight);
    y += 4;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text(pdfSafe(section.heading), MARGIN, y);
    y += 18;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(BODY_SIZE);

    if (section.paragraph) {
      drawLines(wrapped(pdf, section.paragraph, CONTENT_WIDTH), MARGIN);
      y += 3;
    }

    if (section.rows) {
      const labelWidth = 150;
      for (const [label, value] of section.rows) {
        const labelLines = wrapped(pdf, label, labelWidth - 8);
        const valueLines = wrapped(pdf, value, CONTENT_WIDTH - labelWidth - 8);
        const lineCount = Math.max(labelLines.length, valueLines.length, 1);
        const rowHeight = lineCount * LINE_HEIGHT + 4;
        ensureSpace(rowHeight);
        const rowStartY = y;
        pdf.setFont("helvetica", "bold");
        labelLines.forEach((line, index) => pdf.text(line, MARGIN, rowStartY + index * LINE_HEIGHT));
        pdf.setFont("helvetica", "normal");
        valueLines.forEach((line, index) => pdf.text(line, MARGIN + labelWidth, rowStartY + index * LINE_HEIGHT));
        const separatorY = rowStartY + (lineCount - 1) * LINE_HEIGHT + 4;
        pdf.setDrawColor(225, 230, 230);
        pdf.line(MARGIN, separatorY, PAGE_WIDTH - MARGIN, separatorY);
        y = separatorY + LINE_HEIGHT;
      }
      y += 3;
    }

    if (section.table) {
      const weights = section.table.head.length === 3 ? [2.1, 1.1, 0.55] : section.table.head.map(() => 1);
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      const widths = weights.map((weight) => CONTENT_WIDTH * weight / totalWeight);
      const drawTableRow = (cells: string[], header: boolean) => {
        const lines = cells.map((cell, index) => wrapped(pdf, cell, widths[index] - 10));
        const lineCount = Math.max(...lines.map((cellLines) => cellLines.length), 1);
        const separatorOffset = (lineCount - 1) * LINE_HEIGHT + 4;
        const rowHeight = separatorOffset + LINE_HEIGHT;
        ensureSpace(rowHeight);
        const rowStartY = y;
        if (header) {
          pdf.setFillColor(236, 241, 241);
          pdf.rect(MARGIN, rowStartY - 11, CONTENT_WIDTH, separatorOffset + 14, "F");
        }
        let x = MARGIN + 5;
        lines.forEach((cellLines, index) => {
          pdf.setFont("helvetica", header ? "bold" : "normal");
          cellLines.forEach((line, lineIndex) => pdf.text(line, x, rowStartY + lineIndex * LINE_HEIGHT));
          x += widths[index];
        });
        pdf.setDrawColor(190, 200, 200);
        pdf.line(MARGIN, rowStartY + separatorOffset, PAGE_WIDTH - MARGIN, rowStartY + separatorOffset);
        y = rowStartY + rowHeight;
      };
      if (section.table.rows.length) {
        const headerHeight = Math.max(...section.table.head.map((cell, index) => wrapped(pdf, cell, widths[index] - 10).length), 1) * LINE_HEIGHT + 8;
        const firstRowHeight = Math.max(...section.table.rows[0].map((cell, index) => wrapped(pdf, cell, widths[index] - 10).length), 1) * LINE_HEIGHT + 8;
        ensureSpace(headerHeight + firstRowHeight);
      }
      drawTableRow(section.table.head, true);
      section.table.rows.forEach((row) => drawTableRow(row, false));
      y += 3;
    }

    if (section.bullets) {
      for (const bullet of section.bullets) {
        const lines = wrapped(pdf, bullet, CONTENT_WIDTH - 18);
        ensureSpace(lines.length * LINE_HEIGHT);
        pdf.text("•", MARGIN + 2, y);
        lines.forEach((line, index) => pdf.text(line, MARGIN + 17, y + index * LINE_HEIGHT));
        y += lines.length * LINE_HEIGHT;
      }
      y += 3;
    }

    if (section.ruledLines) {
      for (let index = 0; index < section.ruledLines; index += 1) {
        ensureSpace(LINE_HEIGHT + 3);
        y += 4;
        pdf.setDrawColor(190, 200, 200);
        pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
        y += LINE_HEIGHT;
      }
    }
    y += 5;
  }

  if (doc.shareUrl) {
    const shareText = "Open this experiment in Science Lab";
    ensureSpace(LINE_HEIGHT * 2 + 8);
    pdf.setTextColor(25, 95, 105);
    pdf.textWithLink(pdfSafe(shareText), MARGIN, y, { url: doc.shareUrl });
    pdf.setTextColor(0, 0, 0);
    y += LINE_HEIGHT + 4;
  }
  drawLines(wrapped(pdf, doc.disclaimer, CONTENT_WIDTH), MARGIN, 9, 12);

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(90, 100, 100);
    pdf.text("Science Lab · model estimate, not a lab measurement", MARGIN, PAGE_HEIGHT - 27);
    pdf.text(`Page ${page} of ${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 27, { align: "right" });
  }

  return new Uint8Array(pdf.output("arraybuffer"));
}

export async function renderLabReportBlob(doc: LabReportDoc): Promise<Blob> {
  const bytes = await renderLabReportBytes(doc);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: "application/pdf" });
}
