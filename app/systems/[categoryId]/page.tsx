import { CategoryExplorer } from "@/components/portfolio-pages";
export default async function Page({ params }: { params: Promise<{ categoryId: string }> }) { const { categoryId } = await params; return <CategoryExplorer categoryId={categoryId} />; }

