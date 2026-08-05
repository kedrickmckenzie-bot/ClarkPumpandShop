import { ProviderDetail } from "@/components/provider-platform";

export default async function Page({ params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  return <ProviderDetail providerId={providerId} />;
}
