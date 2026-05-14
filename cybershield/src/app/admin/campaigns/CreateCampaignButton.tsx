"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Template {
  id: string;
  name: string;
  type: string;
  difficulty: string;
  attackTactic: string;
}

interface Props {
  templates: Template[];
}

export function CreateCampaignButton({ templates }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 16);
  });
  const [targetAll, setTargetAll] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleCreate() {
    if (!name.trim() || !templateId) {
      setError("Please enter a campaign name and select a template.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), templateId,
          scheduledAt: new Date(scheduledAt).toISOString(),
          targets: [{ allUsers: targetAll }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create campaign");
      setDone(true);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setOpen(false);
    setDone(false);
    setError("");
    setName("");
    setTemplateId("");
  }

  const selectedTemplate = templates.find((t) => t.id === templateId);

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        New Campaign
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-modal bg-surface border border-border shadow-modal">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="font-heading font-semibold text-text-primary">Create Phishing Campaign</h3>
              <button onClick={close} className="rounded-lg p-1.5 hover:bg-elevated text-text-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {done ? (
                <div className="text-center py-4">
                  <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
                  <p className="font-semibold text-text-primary">Campaign created!</p>
                  <p className="text-sm text-text-secondary mt-1">Scheduled and queued for launch.</p>
                  <Button onClick={close} className="mt-4 w-full">Done</Button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Campaign Name</label>
                    <Input
                      placeholder="e.g. Q1 2025 Phishing Simulation"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Simulation Template</label>
                    <select
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                      className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="">Select a template…</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    {selectedTemplate && (
                      <div className="mt-2 rounded-lg bg-elevated border border-border px-3 py-2 text-xs space-y-0.5 text-text-muted">
                        <p><span className="font-medium text-text-secondary">Type:</span> {selectedTemplate.type} · <span className="font-medium text-text-secondary">Difficulty:</span> {selectedTemplate.difficulty}</p>
                        <p><span className="font-medium text-text-secondary">Tactic:</span> {selectedTemplate.attackTactic.replace(/_/g, " ")}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Scheduled Launch</label>
                    <Input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Target</label>
                    <div className="flex gap-2">
                      {[{ label: "All Users", val: true }, { label: "Department", val: false }].map((opt) => (
                        <button
                          key={String(opt.val)}
                          onClick={() => setTargetAll(opt.val)}
                          disabled={!opt.val}
                          title={!opt.val ? "Department targeting — use Campaigns API" : undefined}
                          className={cn(
                            "flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
                            targetAll === opt.val
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-border text-text-muted hover:border-accent/40",
                            !opt.val && "opacity-40 cursor-not-allowed"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
                  )}

                  <div className="flex gap-3 pt-1">
                    <Button variant="outline" onClick={close} className="flex-1" disabled={loading}>Cancel</Button>
                    <Button onClick={handleCreate} className="flex-1" disabled={loading}>
                      {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Creating…</> : <><Plus className="h-4 w-4 mr-1.5" />Create Campaign</>}
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
