import { ComponentRecord } from "@/components/equipment-platform";

export default async function Page({ params }: { params: Promise<{ componentId: string }> }) {
  const { componentId } = await params;
  return <ComponentRecord componentId={componentId} />;
}
