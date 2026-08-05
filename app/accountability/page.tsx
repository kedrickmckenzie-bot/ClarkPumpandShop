import type { Metadata } from "next";
import { AccountabilityCenter } from "@/components/provider-platform";

export const metadata: Metadata = { title: "Accountability", description: "Every unresolved obligation, owner, next action, deadline, and escalation." };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const value = (key: string) => typeof query[key] === "string" ? query[key] as string : "";
  return <AccountabilityCenter initialStoreScope={value("store")} initialQueueScope={value("queue")} initialProviderScope={value("providerId")} />;
}
