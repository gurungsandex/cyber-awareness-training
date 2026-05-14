import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

function roleVariant(role: string): "default" | "secondary" | "destructive" {
  if (role === "ADMIN") return "destructive";
  if (role === "MANAGER") return "default";
  return "secondary";
}

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") redirect("/");

  const users = await db.user.findMany({
    where: { deletedAt: null },
    include: { department: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-500 mt-1">{users.length} users registered.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-600" />
            All Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 pr-4 font-medium text-gray-500">Name</th>
                  <th className="text-left py-3 pr-4 font-medium text-gray-500">Email</th>
                  <th className="text-left py-3 pr-4 font-medium text-gray-500">Role</th>
                  <th className="text-left py-3 pr-4 font-medium text-gray-500">Department</th>
                  <th className="text-left py-3 pr-4 font-medium text-gray-500">Risk Score</th>
                  <th className="text-left py-3 font-medium text-gray-500">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-medium text-gray-900">{u.name}</td>
                    <td className="py-3 pr-4 text-gray-500">{u.email}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={roleVariant(u.role)}>{u.role}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-gray-500">{u.department?.name ?? "—"}</td>
                    <td className="py-3 pr-4">
                      <span className={`font-semibold ${u.riskScore >= 70 ? "text-red-600" : u.riskScore >= 40 ? "text-yellow-600" : "text-green-600"}`}>
                        {u.riskScore}
                      </span>
                    </td>
                    <td className="py-3 text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
