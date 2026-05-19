"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";

interface Department { id: string; name: string }

interface Props {
  token: string;
  departments: Department[];
}

export function RegistrationForm({ token, departments }: Props) {
  const router = useRouter();

  const [name,         setName]         = useState("");
  const [email,        setEmail]        = useState("");
  const [jobTitle,     setJobTitle]     = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [password,     setPassword]     = useState("");
  const [confirm,      setConfirm]      = useState("");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [done,         setDone]         = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return; }

    setLoading(true);
    try {
      const res  = await fetch(`/api/register/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, jobTitle, departmentId, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Registration failed. Please try again."); return; }
      setDone(true);
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center py-4 space-y-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-success/10 border border-success/20">
          <CheckCircle2 className="h-7 w-7 text-success" />
        </div>
        <div>
          <h2 className="font-heading font-bold text-text-primary text-lg">Account created</h2>
          <p className="text-text-secondary text-sm mt-1">
            Your account is ready. Sign in to access your security training.
          </p>
        </div>
        <Button onClick={() => router.push("/login")} className="w-full">Go to Sign In</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Full Name</label>
        <Input
          required
          placeholder="Jane Smith"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Work Email</label>
        <Input
          required
          type="email"
          placeholder="jane.smith@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Job Title</label>
        <Input
          required
          placeholder="e.g. Finance Analyst"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Department</label>
        {departments.length === 0 ? (
          <p className="text-sm text-text-muted italic">No departments configured yet. Please contact your administrator.</p>
        ) : (
          <select
            required
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
          >
            <option value="">Select your department…</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Password</label>
        <Input
          required
          type="password"
          placeholder="Minimum 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Confirm Password</label>
        <Input
          required
          type="password"
          placeholder="Repeat your password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </div>

      <Button type="submit" disabled={loading || departments.length === 0} className="w-full mt-2">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating account…</> : "Create account"}
      </Button>
    </form>
  );
}
