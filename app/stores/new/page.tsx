import type { Metadata } from "next";
import { StoreCommissioningWizard } from "@/components/admin-platform";

export const metadata: Metadata = { title: "Create Store" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <StoreCommissioningWizard
      copyStoreId={typeof query.copy === "string" ? query.copy : undefined}
      editStoreId={typeof query.edit === "string" ? query.edit : undefined}
    />
  );
}
