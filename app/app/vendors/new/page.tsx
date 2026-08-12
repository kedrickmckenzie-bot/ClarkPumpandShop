import type { Metadata } from "next";
import { CreateVendorForm } from "@/components/ops/forms";
import { loadCreateVendorModel } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Add vendor" };

export default async function NewVendorPage() {
  return <CreateVendorForm model={await loadCreateVendorModel()} />;
}
