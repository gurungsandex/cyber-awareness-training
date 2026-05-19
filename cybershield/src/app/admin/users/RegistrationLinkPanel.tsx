"use client";
import { useState, useEffect } from "react";
import { Copy, Check, RefreshCw, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface Props {
  registrationToken: string | null;
  tenantId: string | null;
}

export function RegistrationLinkPanel({ registrationToken, tenantId }: Props) {
  const router = useRouter();
  const [url, setUrl]           = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    if (registrationToken) {
      setUrl(`${window.location.origin}/register/${registrationToken}`);
    }
  }, [registrationToken]);

  async function copyLink() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function generateToken() {
    if (!tenantId) return;
    setRotating(true);
    const res = await fetch("/api/admin/registration-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });
    if (res.ok) {
      const data = await res.json();
      const host = window.location.origin;
      setUrl(`${host}/register/${data.token}`);
      router.refresh();
    }
    setRotating(false);
  }

  return (
    <div className="rounded-card border border-border bg-elevated p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2 rounded-lg bg-accent/10 flex-shrink-0 mt-0.5">
            <Link2 className="h-4 w-4 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary mb-0.5">Employee Registration Link</p>
            <p className="text-xs text-text-muted mb-3">
              Share this link with new employees so they can self-register into your organisation.
              The link is unique to your organisation. Rotate it to invalidate the previous link.
            </p>
            {url ? (
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-xs font-mono bg-surface border border-border rounded px-2.5 py-1.5 text-text-secondary truncate max-w-xs sm:max-w-sm">
                  {url}
                </code>
                <button
                  onClick={copyLink}
                  className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-border bg-surface px-2.5 py-1.5 text-text-secondary hover:border-accent/40 hover:text-accent transition-colors"
                >
                  {copied
                    ? <><Check className="h-3.5 w-3.5 text-success" /> Copied</>
                    : <><Copy className="h-3.5 w-3.5" /> Copy link</>
                  }
                </button>
              </div>
            ) : (
              <p className="text-xs text-text-muted italic">No registration link yet. Generate one to get started.</p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={generateToken}
          disabled={rotating || !tenantId}
          className="gap-1.5 flex-shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${rotating ? "animate-spin" : ""}`} />
          {url ? "Rotate link" : "Generate link"}
        </Button>
      </div>
    </div>
  );
}
