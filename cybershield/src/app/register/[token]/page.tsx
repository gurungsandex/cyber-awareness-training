import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { Shield } from "lucide-react";
import { RegistrationForm } from "./RegistrationForm";

interface Props { params: { token: string } }

export default async function RegisterPage({ params }: Props) {
  const tenant = await db.tenant.findUnique({
    where: { registrationToken: params.token },
    select: {
      id: true,
      name: true,
      departments: { orderBy: { name: "asc" }, select: { id: true, name: true } },
    },
  });

  if (!tenant) notFound();

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 mb-4">
            <Shield className="h-6 w-6 text-accent" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">Create your account</h1>
          <p className="text-text-secondary text-sm mt-1">
            You are joining <strong className="text-text-primary">{tenant.name}</strong> on CyberShield.
          </p>
        </div>

        <div className="card p-6">
          <RegistrationForm
            token={params.token}
            departments={tenant.departments}
          />
        </div>

        <p className="text-center text-xs text-text-muted mt-6">
          Already have an account?{" "}
          <a href="/login" className="text-accent hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}
