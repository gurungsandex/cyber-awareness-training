"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Lock, Mail, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
    } else {
      router.replace(from);
      router.refresh();
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ backgroundColor: "var(--sidebar-bg)" }}>
          <Shield className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-3xl font-heading font-bold text-text-primary">CyberShield</h1>
        <p className="text-text-muted mt-1 text-sm">Security Awareness Platform</p>
      </div>

      {/* Card */}
      <div className="bg-surface border border-border rounded-modal shadow-modal p-8">
        <h2 className="text-lg font-heading font-semibold text-text-primary mb-6">Sign in to your account</h2>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
                autoComplete="email"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
                autoComplete="current-password"
              />
            </div>
          </div>
          <Button type="submit" className="w-full mt-2" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-6 rounded-lg bg-elevated border border-border p-4 text-xs text-text-muted space-y-1">
          <p className="font-medium text-text-secondary">Demo accounts</p>
          <p className="font-mono">admin@cybershield.local / ChangeMe!2026</p>
          <p className="font-mono">manager@cybershield.local / Manager!2026</p>
          <p className="font-mono">alice.chen@cybershield.local / Employee!2026</p>
        </div>
      </div>
    </div>
  );
}
