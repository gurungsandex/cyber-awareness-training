"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, X, Check, Users, Loader2, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Department {
  id: string;
  name: string;
  description: string | null;
  _count: { users: number };
}

interface Props { initialDepartments: Department[] }

export function GroupsClient({ initialDepartments }: Props) {
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Create form
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Edit form
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  async function handleCreate() {
    if (!newName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create group");
      setDepartments((prev) => [...prev, { ...data.department, _count: { users: 0 } }].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(dept: Department) {
    setEditingId(dept.id);
    setEditName(dept.name);
    setEditDesc(dept.description ?? "");
    setError("");
  }

  async function handleEdit(id: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/groups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update group");
      setDepartments((prev) =>
        prev.map((d) => (d.id === id ? { ...d, name: data.department.name, description: data.department.description } : d))
      );
      setEditingId(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/groups/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete group");
      setDepartments((prev) => prev.filter((d) => d.id !== id));
      setDeletingId(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {departments.length} group{departments.length !== 1 ? "s" : ""} — use these to organise users and assign courses by team.
        </p>
        <Button size="sm" onClick={() => { setShowCreate(true); setError(""); }} className="gap-2">
          <Plus className="h-4 w-4" /> New Group
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-2.5 text-sm text-danger">{error}</div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="rounded-card border border-accent/30 bg-accent/5 p-5 space-y-3">
          <p className="text-sm font-medium text-text-primary">Create new group</p>
          <div>
            <label htmlFor="group-name" className="text-xs text-text-muted mb-1 block">Group name *</label>
            <Input
              id="group-name"
              placeholder="e.g. DevOps, Customer Success, Legal"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="group-desc" className="text-xs text-text-muted mb-1 block">Description (optional)</label>
            <Input
              id="group-desc"
              placeholder="Brief description of this group's role"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={loading || !newName.trim()} className="gap-1.5">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Create Group
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowCreate(false); setNewName(""); setNewDesc(""); setError(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Groups list */}
      <div className="divide-y divide-border rounded-card border border-border overflow-hidden">
        {departments.length === 0 && (
          <div className="py-12 text-center">
            <Building2 className="h-10 w-10 text-text-muted mx-auto mb-3 opacity-20" />
            <p className="text-sm text-text-muted">No groups yet. Create one to organise your team.</p>
          </div>
        )}
        {departments.map((dept) => (
          <div key={dept.id} className="bg-surface px-5 py-4">
            {editingId === dept.id ? (
              <div className="space-y-3">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="text-sm" />
                <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" className="text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleEdit(dept.id)} disabled={loading} className="gap-1.5">
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </div>
            ) : deletingId === dept.id ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-danger">Delete <strong>{dept.name}</strong>? This cannot be undone.</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(dept.id)} disabled={loading}>
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-accent/10 flex-shrink-0">
                    <Building2 className="h-4 w-4 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">{dept.name}</p>
                    {dept.description && (
                      <p className="text-xs text-text-muted mt-0.5 truncate">{dept.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Badge variant="secondary" className="gap-1.5">
                    <Users className="h-3 w-3" />
                    {dept._count.users} member{dept._count.users !== 1 ? "s" : ""}
                  </Badge>
                  <button
                    onClick={() => startEdit(dept)}
                    className="p-1.5 rounded-lg hover:bg-elevated text-text-muted hover:text-text-primary transition-colors"
                    title="Edit group"
                    aria-label="Edit group"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { setDeletingId(dept.id); setError(""); }}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      dept._count.users > 0
                        ? "text-text-muted/30 cursor-not-allowed"
                        : "hover:bg-danger/10 text-text-muted hover:text-danger"
                    )}
                    title={dept._count.users > 0 ? "Reassign members before deleting" : "Delete group"}
                    aria-label={dept._count.users > 0 ? "Reassign members before deleting" : "Delete group"}
                    disabled={dept._count.users > 0}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
