import { CategoryPortfolio } from "@/components/equipment-platform";

export default async function Page({ params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await params;
  return <CategoryPortfolio categoryId={categoryId} />;
}
