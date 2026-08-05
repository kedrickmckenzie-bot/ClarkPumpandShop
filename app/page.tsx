import type { Metadata } from "next";
import { CommandCenter } from "@/components/command-center";

export const metadata: Metadata = {
  title: "Command Center",
  description: "Company-wide maintenance exceptions, spend, PM and asset intelligence.",
};

export default function Home() {
  return <CommandCenter />;
}
