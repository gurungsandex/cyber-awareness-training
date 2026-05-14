import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Download } from "lucide-react";

export default async function CertificatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const certs = await db.certificate.findMany({
    where: { userId: session.user.id },
    orderBy: { issuedAt: "desc" },
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Certificates</h1>
        <p className="text-gray-500 mt-1">{certs.length} certificate(s) earned.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {certs.map((c) => (
          <Card key={c.id} className="border-yellow-200 bg-gradient-to-br from-yellow-50 to-white">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-500" />
                <CardTitle className="text-base">{c.courseTitle}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-1">
                Issued: {new Date(c.issuedAt).toLocaleDateString()}
              </p>
              <p className="text-xs text-gray-400 font-mono">#{c.verifyCode}</p>
              {c.pdfPath && (
                <a
                  href={c.pdfPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-2 text-sm text-brand-600 hover:underline"
                >
                  <Download className="h-4 w-4" /> Download PDF
                </a>
              )}
            </CardContent>
          </Card>
        ))}
        {certs.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No certificates yet. Complete a course to earn one!</p>
          </div>
        )}
      </div>
    </div>
  );
}
