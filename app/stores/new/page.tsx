import type { Metadata } from "next";
import { StoreOnboardingWizard } from "@/components/store-onboarding-wizard";
export const metadata: Metadata = { title: "Add Store" };
export default function Page() { return <StoreOnboardingWizard />; }
