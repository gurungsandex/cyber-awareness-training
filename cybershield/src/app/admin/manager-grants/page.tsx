import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ManagerGrantsClient } from "./ManagerGrantsClient";
import { KeyRound } from "lucide-react";

export default async function ManagerGrantsPage() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") redirect("/");
  const tenantId = (session.user as any).tenantId ?? null;
  const tenantFilter = tenantId ? { tenantId } : {};

  const [managers, courses] = await Promise.all([
    db.user.findMany({
      where: { role: "MANAGER", deletedAt: null, ...tenantFilter },
      include: {
        department: { select: { name: true } },
        managerGrants: { select: { courseId: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.course.findMany({
      where: { status: "PUBLISHED", ...tenantFilter },
      orderBy: [{ isMandatory: "desc" }, { title: "asc" }],
      select: { id: true, title: true, isMandatory: true },
    }),
  ]);

  const managersData = managers.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    department: m.department?.name ?? null,
    courses: courses.map((c) => ({
      id: c.id,
      title: c.title,
      granted: m.managerGrants.some((g) => g.courseId === c.id),
    })),
  }));

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start gap-3">
        <div className="p-2.5 rounded-lg bg-accent/10 mt-0.5">
          <KeyRound className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">Manager Course Access</h1>
          <p className="text-text-secondary text-sm mt-1">
            Control which courses each manager can assign to their team.
            Granted courses are explicitly scoped to this manager.
            By default, managers see all published courses.
          </p>
        </div>
      </div>

      <ManagerGrantsClient managers={managersData} courses={courses} />
    </div>
  );
}
