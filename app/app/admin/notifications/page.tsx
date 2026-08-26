import type { Metadata } from "next";
import { NotificationSettings } from "@/components/workspace/notification-settings";
import { loadNotificationSettingsModel } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Notification delivery" };
type Query = { notice?: string | string[] };
export default async function NotificationSettingsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  return <NotificationSettings model={await loadNotificationSettingsModel()} notice={Array.isArray(query.notice) ? query.notice[0] : query.notice}/>;
}
