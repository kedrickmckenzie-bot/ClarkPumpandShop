import type { Metadata } from "next";
import { VendorDirectory } from "@/components/vendor-directory";

export const metadata: Metadata = {
  title: "Approved vendors",
  description: "Search approved vendors by company, trade, service description, or common maintenance need.",
};

export default function Page() {
  return <VendorDirectory />;
}
