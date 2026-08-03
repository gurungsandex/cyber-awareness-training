import { NextRequest } from "next/server";
import path from "path";
import fs from "fs/promises";
import { db } from "@/lib/db";
import { requireAuth, bad } from "@/lib/api";
import { certStorageDir } from "@/lib/certificate";

/**
 * Authenticated certificate download. A certificate is a personal document, so
 * it is streamed only to its owner (or an admin in the same tenant) after an
 * explicit ownership check — replacing the previous behaviour of writing PDFs
 * into the public/ tree where anyone with the URL could fetch them.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAuth();
  if ("status" in ctx) return ctx;

  const cert = await db.certificate.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, pdfPath: true, courseTitle: true, user: { select: { tenantId: true } } },
  });
  if (!cert || !cert.pdfPath) return bad("Certificate not found", 404);

  const role = (ctx.user as any).role;
  const isOwner = cert.userId === ctx.user.id;
  const isTenantAdmin = role === "ADMIN" && cert.user.tenantId === (ctx.user.tenantId ?? null);
  if (!isOwner && !isTenantAdmin) return bad("Not found", 404);

  // pdfPath is a filename we control, but resolve through basename so a crafted
  // value can never escape the storage directory.
  const filePath = path.join(certStorageDir(), path.basename(cert.pdfPath));

  let file: Buffer;
  try {
    file = await fs.readFile(filePath);
  } catch {
    return bad("Certificate file is not available", 404);
  }

  const safeName = cert.courseTitle.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "certificate";
  return new Response(new Uint8Array(file), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
