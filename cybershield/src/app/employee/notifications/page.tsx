import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { NotificationsClient } from "./NotificationsClient";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const notifications = await db.notification.findMany({
    where: { userId: session.user.id, archivedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-text-primary">Notifications</h1>
        <p className="text-text-secondary text-sm mt-1">
          {notifications.filter((n) => !n.readAt).length} unread · {notifications.length} total
        </p>
      </div>
      <NotificationsClient notifications={notifications as any} />
    </div>
  );
}
