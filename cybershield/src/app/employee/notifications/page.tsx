import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, CheckCircle2 } from "lucide-react";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const notifications = await db.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="text-gray-500 mt-1">{notifications.filter((n) => !n.readAt).length} unread</p>
      </div>
      <div className="space-y-3 max-w-2xl">
        {notifications.map((n) => (
          <Card key={n.id} className={n.readAt ? "opacity-60" : "border-brand-200"}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 p-1.5 rounded-full ${n.readAt ? "bg-gray-100" : "bg-brand-100"}`}>
                  {n.readAt ? (
                    <CheckCircle2 className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Bell className="h-4 w-4 text-brand-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900">{n.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{n.body}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                {!n.readAt && (
                  <span className="flex-shrink-0 h-2 w-2 rounded-full bg-brand-500 mt-1.5" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {notifications.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No notifications yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
