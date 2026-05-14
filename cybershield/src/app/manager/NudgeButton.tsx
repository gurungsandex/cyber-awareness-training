"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, Check, Loader2 } from "lucide-react";

interface Props {
  senderId: string;
  targetUserId: string;
  targetName: string;
  enrollmentId?: string;
}

export function NudgeButton({ senderId, targetUserId, targetName, enrollmentId }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  async function sendNudge() {
    setState("loading");
    await fetch("/api/manager/nudge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId, enrollmentId, nudgeType: "REMINDER" }),
    });
    setState("done");
    setTimeout(() => setState("idle"), 3000);
  }

  if (state === "done") {
    return (
      <span className="flex items-center gap-1 text-xs text-success">
        <Check className="h-3.5 w-3.5" /> Sent
      </span>
    );
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={sendNudge}
      disabled={state === "loading"}
      className="h-7 px-2 text-xs gap-1.5"
      title={`Send reminder to ${targetName}`}
    >
      {state === "loading" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Bell className="h-3.5 w-3.5" />
      )}
      Nudge
    </Button>
  );
}
