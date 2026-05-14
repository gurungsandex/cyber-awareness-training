import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { CertificateCard } from "@/components/CertificateCard";
import { PrintCertButton } from "./PrintCertButton";

export default async function CertificatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const certs = await db.certificate.findMany({
    where: { userId: session.user.id },
    orderBy: { issuedAt: "desc" },
  });

  const userName = session.user.name ?? "Participant";

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-text-primary">My Certificates</h1>
        <p className="text-text-secondary text-sm mt-1">
          {certs.length} certificate{certs.length !== 1 ? "s" : ""} earned. Click &quot;Print / Save PDF&quot; to download.
        </p>
      </div>

      {certs.length === 0 && (
        <div className="rounded-card border-2 border-dashed border-border py-20 text-center">
          <Trophy className="h-12 w-12 text-text-muted mx-auto mb-3 opacity-20" />
          <p className="text-sm text-text-muted">No certificates yet. Complete a course to earn one!</p>
        </div>
      )}

      <div className="space-y-10">
        {certs.map((c) => (
          <div key={c.id} className="space-y-3">
            <CertificateCard
              recipientName={userName}
              courseTitle={c.courseTitle}
              issuedAt={c.issuedAt}
              verifyCode={c.verifyCode}
            />
            <div className="flex items-center justify-end gap-3 max-w-2xl mx-auto">
              <p className="text-xs text-text-muted flex-1">
                Verify at <span className="font-mono text-text-secondary">/verify/{c.verifyCode}</span>
              </p>
              <PrintCertButton verifyCode={c.verifyCode} courseTitle={c.courseTitle} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
