import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { DepartmentsClient } from "./DepartmentsClient";
import { ChevronRight, Building2 } from "lucide-react";

export default async function DepartmentsPage() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") redirect("/");

  const tenantId = (session.user as any).tenantId ?? null;
  const departments = await db.department.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <div className="p-6 max-w-4xl">
      <nav className="flex items-center gap-1.5 text-xs text-text-muted mb-5">
        <span>People</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-accent">Departments</span>
      </nav>

      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <Building2 className="h-5 w-5 text-accent" />
          <h1 className="text-2xl font-heading font-bold text-text-primary">Departments</h1>
        </div>
        <p className="text-text-secondary text-sm mt-1">
          Add, rename, or remove departments. The registration form dropdown updates automatically.
          A department with active members cannot be deleted.
        </p>
      </div>

      <DepartmentsClient initial={departments} />
    </div>
  );
}
