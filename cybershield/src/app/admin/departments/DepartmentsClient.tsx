"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Department {
  id: string;
  name: string;
  description: string | null;
  _count: { users: number };
}

export function DepartmentsClient({ initial }: { initial: Department[] }) {
  const [departments, setDepartments] = useState<Department[]>(initial);
  const [newName, setNewName]         = useState("");
  const [newDesc, setNewDesc]         = useState("");
  const [creating, setCreating]       = useState(false);
  const [editId, setEditId]           = useState<string | null>(null);
  const [editName, setEditName]       = useState("");
  const [editDesc, setEditDesc]       = useState("");
  const [error, setError]             = useState<string | null>(null);
  const [busy, setBusy]               = useState(false);

  async function create() {
    if (!newName.trim()) return;
    setBusy(true); setError(null);
    const res = await fetch("/api/admin/departments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setBusy(false); return; }
    setDepartments((prev) => [...prev, { ...data, _count: { users: 0 } }].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName(""); setNewDesc(""); setCreating(false); setBusy(false);
  }

  async function save(id: string) {
    if (!editName.trim()) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/admin/departments/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || undefined }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setBusy(false); return; }
    setDepartments((prev) => prev.map((d) => d.id === id ? { ...d, name: data.name, description: data.description } : d));
    setEditId(null); setBusy(false);
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete department "${name}"? This cannot be undone.`)) return;
    setBusy(true); setError(null);
    const res  = await fetch(`/api/admin/departments/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setBusy(false); return; }
    setDepartments((prev) => prev.filter((d) => d.id !== id)); setBusy(false);
  }

  function startEdit(d: Department) {
    setEditId(d.id); setEditName(d.name); setEditDesc(d.description ?? "");
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-card border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-elevated">
              {["Department", "Description", "Members", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {departments.map((d) => (
              <tr key={d.id} className="hover:bg-elevated/40">
                <td className="px-4 py-3 font-medium text-text-primary">
                  {editId === d.id
                    ? <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 text-sm" autoFocus />
                    : d.name
                  }
                </td>
                <td className="px-4 py-3 text-text-muted max-w-xs">
                  {editId === d.id
                    ? <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Optional description" className="h-7 text-sm" />
                    : <span className="truncate block">{d.description ?? "—"}</span>
                  }
                </td>
                <td className="px-4 py-3 text-text-muted">{d._count.users}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 justify-end">
                    {editId === d.id ? (
                      <>
                        <button onClick={() => save(d.id)} disabled={busy} className="p-1.5 rounded hover:bg-success/10 text-success" title="Save" aria-label="Save">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setEditId(null)} className="p-1.5 rounded hover:bg-elevated text-text-muted" title="Cancel" aria-label="Cancel">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(d)} className="p-1.5 rounded hover:bg-elevated text-text-muted hover:text-text-primary" title="Edit" aria-label="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => remove(d.id, d.name)}
                          disabled={busy || d._count.users > 0}
                          className={cn("p-1.5 rounded hover:bg-danger/10 text-text-muted hover:text-danger", d._count.users > 0 && "opacity-30 cursor-not-allowed")}
                          title={d._count.users > 0 ? "Cannot delete — employees still assigned" : "Delete"}
                          aria-label={d._count.users > 0 ? "Cannot delete — employees still assigned" : "Delete"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {departments.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-text-muted text-sm">No departments yet. Add one below.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add new */}
      {creating ? (
        <div className="rounded-card border border-accent/30 bg-accent/5 p-4 space-y-3">
          <p className="text-sm font-medium text-text-primary">New department</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Department name (required)" autoFocus />
            <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)" />
          </div>
          <div className="flex gap-2">
            <Button onClick={create} disabled={!newName.trim() || busy} size="sm">Add Department</Button>
            <Button variant="outline" size="sm" onClick={() => { setCreating(false); setNewName(""); setNewDesc(""); setError(null); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setCreating(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Department
        </Button>
      )}
    </div>
  );
}
