import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { InboxClient } from "./InboxClient";

export default async function InboxPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id!;

  const items = await db.simulatedInboxItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { campaign: { select: { template: { select: { redFlags: true } } } } },
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-text-primary">Phishing Simulation Inbox</h1>
        <p className="text-text-secondary text-sm mt-1">
          These are simulated phishing emails. Practice identifying them before real ones reach you.
        </p>
      </div>
      <InboxClient items={items as any} />
    </div>
  );
}
