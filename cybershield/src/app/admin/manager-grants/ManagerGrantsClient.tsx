"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Loader2, Users, BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CourseGrant { id: string; title: string; granted: boolean }
interface Manager { id: string; name: string; email: string; department: string | null; courses: CourseGrant[] }

export function ManagerGrantsClient({ managers, courses }: {
  managers: Manager[];
  courses: { id: string; title: string; isMandatory: boolean }[];
}) {
  const [grantState, setGrantState] = useState<Record<string, Set<string>>>(() => {
    const s: Record<string, Set<string>> = {};
    for (const m of managers) {
      s[m.id] = new Set(m.courses.filter((c) => c.granted).map((c) => c.id));
    }
    return s;
  });
  const [loading, setLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(managers[0]?.id ?? null);

  async function toggle(managerId: string, courseId: string) {
    const key = `${managerId}-${courseId}`;
    setLoading(key);
    const currentlyGranted = grantState[managerId]?.has(courseId) ?? false;
    try {
      const res = await fetch("/api/admin/manager-grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerId, courseId, grant: !currentlyGranted }),
      });
      if (res.ok) {
        setGrantState((prev) => {
          const next = { ...prev };
          const set = new Set(next[managerId] ?? []);
          if (currentlyGranted) set.delete(courseId);
          else set.add(courseId);
          next[managerId] = set;
          return next;
        });
      }
    } finally {
      setLoading(null);
    }
  }

  if (managers.length === 0) {
    return (
      <div className="rounded-card border border-border py-12 text-center">
        <Users className="h-10 w-10 text-text-muted mx-auto mb-3 opacity-20" />
        <p className="text-sm text-text-muted">No managers found. Promote a user to Manager role first.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border rounded-card border border-border overflow-hidden">
      {managers.map((mgr) => {
        const grantedCount = grantState[mgr.id]?.size ?? 0;
        const isOpen = expanded === mgr.id;
        return (
          <div key={mgr.id} className="bg-surface">
            <button
              onClick={() => setExpanded(isOpen ? null : mgr.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-elevated/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Users className="h-4 w-4 text-accent" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-text-primary">{mgr.name}</p>
                  <p className="text-xs text-text-muted">{mgr.email}{mgr.department ? ` · ${mgr.department}` : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="gap-1.5">
                  <BookOpen className="h-3 w-3" />
                  {grantedCount} of {courses.length} courses
                </Badge>
                {isOpen ? <ChevronDown className="h-4 w-4 text-text-muted" /> : <ChevronRight className="h-4 w-4 text-text-muted" />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-border bg-elevated/30 px-5 pb-4 pt-3">
                <p className="text-xs text-text-muted mb-3">
                  Toggle which courses this manager can assign to their team.
                  When unchecked, the manager sees all courses (default access).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {courses.map((course) => {
                    const granted = grantState[mgr.id]?.has(course.id) ?? false;
                    const key = `${mgr.id}-${course.id}`;
                    const isLoading = loading === key;
                    return (
                      <button
                        key={course.id}
                        onClick={() => toggle(mgr.id, course.id)}
                        disabled={isLoading}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors",
                          granted
                            ? "border-accent/30 bg-accent/5"
                            : "border-border hover:border-accent/20 hover:bg-elevated/50"
                        )}
                      >
                        {isLoading
                          ? <Loader2 className="h-4 w-4 animate-spin text-accent flex-shrink-0" />
                          : granted
                            ? <CheckCircle2 className="h-4 w-4 text-accent flex-shrink-0" />
                            : <Circle className="h-4 w-4 text-text-muted flex-shrink-0" />
                        }
                        <div className="min-w-0">
                          <p className={cn("text-xs font-medium truncate", granted ? "text-accent" : "text-text-secondary")}>
                            {course.title}
                          </p>
                          {course.isMandatory && (
                            <span className="text-[10px] text-danger">Mandatory</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
