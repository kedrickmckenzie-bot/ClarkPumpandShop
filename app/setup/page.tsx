import type { Metadata } from "next";
import { AdministrationCenter } from "@/components/admin-platform";

export const metadata: Metadata = { title: "Administration" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <AdministrationCenter
      initialSection={typeof query.section === "string" ? query.section : undefined}
    />
  );
}
