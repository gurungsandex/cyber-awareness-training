import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { NudgeButton } from "../NudgeButton";

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const senderId = session.user.id!;

  const users = await db.user.findMany({
    where: { deletedAt: null, role: "EMPLOYEE" },
    include: {
      department: true,
      enrollments: {
        select: { id: true, status: true, dueAt: true, course: { select: { title: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-text-primary">My Team</h1>
        <p className="text-text-secondary text-sm mt-1">{users.length} employees tracked.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-accent" />
            All Employees
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Name", "Email", "Department", "Risk", "Progress", "Overdue", "Action"].map((h) => (
                  <th key={h} className="text-left pb-3 pr-4 text-xs font-medium text-text-muted uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => {
                const total = u.enrollments.length;
                const done = u.enrollments.filter((e) => e.status === "COMPLETED").length;
                const overdueEnrollments = u.enrollments.filter(
                  (e) => e.dueAt && new Date(e.dueAt) < new Date() && e.status !== "COMPLETED"
                );
                const overdue = overdueEnrollments.length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;

                return (
                  <tr key={u.id} className="hover:bg-elevated/40">
                    <td className="py-3 pr-4 font-medium text-text-primary">{u.name}</td>
                    <td className="py-3 pr-4 text-text-muted text-xs">{u.email}</td>
                    <td className="py-3 pr-4 text-text-secondary text-xs">{u.department?.name ?? "—"}</td>
                    <td className="py-3 pr-4">
                      <span className={`font-bold ${u.riskScore >= 70 ? "text-danger" : u.riskScore >= 40 ? "text-warning" : "text-success"}`}>
                        {u.riskScore}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-border rounded-full">
                          <div className="h-1.5 bg-accent rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-text-muted">{done}/{total}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {overdue > 0 ? (
                        <Badge variant="destructive">{overdue} overdue</Badge>
                      ) : (
                        <Badge variant="success">On track</Badge>
                      )}
                    </td>
                    <td className="py-3">
                      <NudgeButton
                        senderId={senderId}
                        targetUserId={u.id}
                        targetName={u.name}
                        enrollmentId={overdueEnrollments[0]?.id}
                      />
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-text-muted">No employees found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
