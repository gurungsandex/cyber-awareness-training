import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import path from "path";
import fs from "fs/promises";
import { db } from "./db";
import crypto from "crypto";

/**
 * Certificates render with pdf-lib's standard Helvetica, which uses WinAnsi
 * (CP1252) encoding and throws on any character it can't encode — CJK, emoji,
 * and many accented letters. Names come from self-registration and can contain
 * anything, so an unsanitised name would crash the certificate worker and the
 * user would never receive their certificate. Decompose accents to their base
 * letters and replace anything still outside printable Latin-1 so a certificate
 * is always produced.
 */
function pdfSafe(text: string): string {
  const decomposed = text.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  // eslint-disable-next-line no-control-regex
  return decomposed.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?").trim();
}

export async function generateCertificatePdf(attemptId: string): Promise<string> {
  const attempt = await db.assessmentAttempt.findUnique({
    where: { id: attemptId },
    include: { user: true, assessment: { include: { course: true } } },
  });
  if (!attempt) throw new Error("Attempt not found");

  const verifyCode = crypto.randomBytes(8).toString("hex").toUpperCase();
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([792, 612]); // landscape letter
  const { width, height } = page.getSize();

  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Background
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.133, 0.176, 0.455) });
  page.drawRectangle({ x: 30, y: 30, width: width - 60, height: height - 60, borderColor: rgb(1, 1, 1), borderWidth: 2 });

  page.drawText("CERTIFICATE OF COMPLETION", {
    x: 160, y: height - 120, size: 28, font: boldFont, color: rgb(1, 1, 1),
  });
  page.drawText("This certifies that", {
    x: 330, y: height - 180, size: 14, font, color: rgb(0.9, 0.9, 0.9),
  });
  const safeName = pdfSafe(attempt.user.name) || "Certificate Recipient";
  const safeTitle = pdfSafe(attempt.assessment.course.title) || "Security Awareness Training";
  page.drawText(safeName, {
    x: Math.max(40, 396 - (safeName.length * 10) / 2), y: height - 220,
    size: 24, font: boldFont, color: rgb(1, 0.84, 0),
  });
  page.drawText("has successfully completed", {
    x: 303, y: height - 265, size: 14, font, color: rgb(0.9, 0.9, 0.9),
  });
  page.drawText(safeTitle, {
    x: Math.max(40, 396 - (safeTitle.length * 7) / 2), y: height - 305,
    size: 20, font: boldFont, color: rgb(1, 1, 1),
  });
  page.drawText(`Score: ${attempt.scorePct}%  |  Issued: ${new Date().toLocaleDateString()}  |  Code: ${verifyCode}`, {
    x: 200, y: 70, size: 11, font, color: rgb(0.7, 0.7, 0.7),
  });

  const pdfBytes = await pdfDoc.save();
  const dir = path.join(process.cwd(), "public", "certificates");
  await fs.mkdir(dir, { recursive: true });
  const filename = `cert-${attemptId}.pdf`;
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, pdfBytes);

  await db.certificate.create({
    data: {
      userId: attempt.userId,
      attemptId: attempt.id,
      courseTitle: attempt.assessment.course.title,
      pdfPath: `/certificates/${filename}`,
      verifyCode,
    },
  });

  return `/certificates/${filename}`;
}
