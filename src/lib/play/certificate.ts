import { pdfSafe } from "../labReport";
import { tr, type Locale } from "../i18n";

export interface CertificateInput {
  studentName: string;
  achievement: string;
  date: Date;
  locale: Locale;
}

export async function renderCertificateBytes(input: CertificateInput): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const center = width / 2;
  pdf.setDrawColor(63, 111, 127);
  pdf.setLineWidth(3);
  pdf.roundedRect(32, 32, width - 64, height - 64, 12, 12);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Science Lab", center, 112, { align: "center" });
  pdf.setFontSize(30);
  pdf.text(pdfSafe(tr(input.locale, "play.certificate.title")), center, 176, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(16);
  pdf.text(pdfSafe(tr(input.locale, "play.certificate.name")), center, 238, { align: "center" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(26);
  pdf.text(pdfSafe(input.studentName.trim() || tr(input.locale, "play.certificate.defaultName")), center, 286, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(16);
  const achievement = pdf.splitTextToSize(pdfSafe(input.achievement), width - 140) as string[];
  pdf.text(achievement, center, 342, { align: "center" });
  pdf.setFontSize(12);
  pdf.text(pdfSafe(input.date.toLocaleDateString(input.locale === "es" ? "es" : "en-US", { year: "numeric", month: "long", day: "numeric" })), center, height - 104, { align: "center" });
  return new Uint8Array(pdf.output("arraybuffer"));
}
