import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const users = await db.user.findMany({
    where: { deletedAt: null, role: "EMPLOYEE" },
    include: {
      department: true,
      enrollments: { select: { status: true, dueAt: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Team</h1>
        <p className="text-gray-500 mt-1">{users.length} employees tracked.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-600" />
            All Employees
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Name", "Email", "Department", "Risk Score", "Courses", "Overdue"].map((h) => (
                    <th key={h} className="text-left py-3 pr-4 font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => {
                  const overdue = u.enrollments.filter(
                    (e) => e.dueAt && new Date(e.dueAt) < new Date() && e.status !== "COMPLETED"
                  ).length;
                  const total = u.enrollments.length;
                  const done = u.enrollments.filter((e) => e.status === "COMPLETED").length;
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="py-3 pr-4 font-medium text-gray-900">{u.name}</td>
                      <td className="py-3 pr-4 text-gray-500 text-xs">{u.email}</td>
                      <td className="py-3 pr-4 text-gray-500">{u.department?.name ?? "—"}</td>
                      <td className="py-3 pr-4">
                        <span className={`font-semibold ${u.riskScore >= 70 ? "text-red-600" : u.riskScore >= 40 ? "text-yellow-600" : "text-green-600"}`}>
                          {u.riskScore}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-500">{done}/{total}</td>
                      <td className="py-3">
                        {overdue > 0 ? (
                          <Badge variant="destructive">{overdue} overdue</Badge>
                        ) : (
                          <Badge variant="success">On track</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
