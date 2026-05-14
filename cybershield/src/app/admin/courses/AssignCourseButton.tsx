"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, X, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  courseId: string;
  courseTitle: string;
  departments: { id: string; name: string }[];
}

type Target = "ALL" | "DEPARTMENT" | "ROLE";

export function AssignCourseButton({ courseId, courseTitle, departments }: Props) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Target>("ALL");
  const [departmentId, setDepartmentId] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [dueInDays, setDueInDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ enrolled: number; skipped: number } | null>(null);
  const [error, setError] = useState("");

  async function handleAssign() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const body: any = { target, dueInDays };
      if (target === "DEPARTMENT") body.departmentId = departmentId;
      if (target === "ROLE") body.role = role;
      const res = await fetch(`/api/admin/courses/${courseId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult({ enrolled: data.enrolled, skipped: data.skipped });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setOpen(false);
    setResult(null);
    setError("");
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5 text-xs w-full">
        <UserPlus className="h-3.5 w-3.5" />
        Assign
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-modal bg-surface border border-border shadow-modal">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="font-heading font-semibold text-text-primary">Assign Course</h3>
                <p className="text-xs text-text-muted mt-0.5 truncate max-w-64">{courseTitle}</p>
              </div>
              <button onClick={close} className="rounded-lg p-1.5 hover:bg-elevated text-text-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {result ? (
                <div className="text-center py-4">
                  <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
                  <p className="font-semibold text-text-primary">Assignment complete</p>
                  <p className="text-sm text-text-secondary mt-1">
                    <span className="font-medium text-success">{result.enrolled} users enrolled</span>
                    {result.skipped > 0 && `, ${result.skipped} already enrolled (skipped)`}
                  </p>
                  <Button onClick={close} className="mt-4 w-full">Done</Button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Assign to</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["ALL", "DEPARTMENT", "ROLE"] as Target[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTarget(t)}
                          className={cn(
                            "rounded-lg border py-2 text-xs font-medium transition-colors",
                            target === t
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-border text-text-secondary hover:border-accent/40 hover:text-text-primary"
                          )}
                        >
                          {t === "ALL" ? "All Users" : t === "DEPARTMENT" ? "Department" : "By Role"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {target === "DEPARTMENT" && (
                    <div>
                      <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Department</label>
                      <select
                        value={departmentId}
                        onChange={(e) => setDepartmentId(e.target.value)}
                        className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="">Select department…</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {target === "ROLE" && (
                    <div>
                      <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Role</label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="EMPLOYEE">Employees</option>
                        <option value="MANAGER">Managers</option>
                        <option value="ADMIN">Admins</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
                      Due in <span className="text-accent font-semibold">{dueInDays} days</span>
                    </label>
                    <input
                      type="range" min={7} max={90} step={7}
                      value={dueInDays}
                      onChange={(e) => setDueInDays(Number(e.target.value))}
                      className="w-full accent-accent"
                    />
                    <div className="flex justify-between text-xs text-text-muted mt-0.5">
                      <span>7 days</span><span>90 days</span>
                    </div>
                  </div>

                  {error && (
                    <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
                  )}

                  <div className="flex gap-3 pt-1">
                    <Button variant="outline" onClick={close} className="flex-1" disabled={loading}>Cancel</Button>
                    <Button
                      onClick={handleAssign}
                      className="flex-1"
                      disabled={loading || (target === "DEPARTMENT" && !departmentId)}
                    >
                      {loading
                        ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Assigning…</>
                        : <><UserPlus className="h-4 w-4 mr-1.5" />Assign Course</>
                      }
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
