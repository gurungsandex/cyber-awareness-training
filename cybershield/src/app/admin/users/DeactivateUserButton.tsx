"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserX } from "lucide-react";

export function DeactivateUserButton({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function deactivate() {
    if (!confirm(`Deactivate ${userName}? They will lose access immediately.`)) return;
    setLoading(true);
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) router.refresh();
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to deactivate user.");
    }
  }

  return (
    <button
      onClick={deactivate}
      disabled={loading}
      className="inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline disabled:opacity-40"
    >
      <UserX className="h-3.5 w-3.5" />
      Deactivate
    </button>
  );
}
