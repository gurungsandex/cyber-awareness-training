import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GroupsClient } from "./GroupsClient";
import { Building2 } from "lucide-react";

export default async function GroupsPage() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") redirect("/");
  const tenantId = (session.user as any).tenantId ?? null;

  const departments = await db.department.findMany({
    where: tenantId ? { tenantId } : {},
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start gap-3">
        <div className="p-2.5 rounded-lg bg-accent/10 mt-0.5">
          <Building2 className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">Groups & Departments</h1>
          <p className="text-text-secondary text-sm mt-1">
            Create custom groups for your organisation — departments, teams, or any logical unit.
            Assign courses by group when enrolling users.
          </p>
        </div>
      </div>

      <GroupsClient
        initialDepartments={departments.map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description,
          _count: { users: d._count.users },
        }))}
      />
    </div>
  );
}
