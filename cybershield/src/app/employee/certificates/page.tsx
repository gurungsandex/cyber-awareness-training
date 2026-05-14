import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Trophy, Download, Shield } from "lucide-react";

export default async function CertificatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const certs = await db.certificate.findMany({
    where: { userId: session.user.id },
    orderBy: { issuedAt: "desc" },
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-text-primary">My Certificates</h1>
        <p className="text-text-secondary text-sm mt-1">{certs.length} certificate(s) earned.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {certs.map((c) => (
          <div key={c.id} className="rounded-card border border-warning/20 bg-gradient-to-br from-warning/5 to-surface p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-warning/10">
                <Trophy className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wide">Certificate of Completion</p>
              </div>
            </div>
            <h3 className="font-heading font-semibold text-text-primary text-sm mb-2">{c.courseTitle}</h3>
            <p className="text-xs text-text-muted mb-1">
              Issued: {new Date(c.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            <p className="text-xs text-text-muted font-mono mb-4">#{c.verifyCode}</p>
            {c.pdfPath ? (
              <a
                href={c.pdfPath}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-accent hover:underline"
              >
                <Download className="h-3.5 w-3.5" /> Download PDF
              </a>
            ) : (
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Shield className="h-3.5 w-3.5" /> Verify: /verify/{c.verifyCode}
              </div>
            )}
          </div>
        ))}
        {certs.length === 0 && (
          <div className="col-span-3 text-center py-16 text-text-muted">
            <Trophy className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No certificates yet. Complete a course to earn one!</p>
          </div>
        )}
      </div>
    </div>
  );
}
