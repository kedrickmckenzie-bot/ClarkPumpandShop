import { notFound } from "next/navigation";
import { ComponentDetail } from "@/components/portfolio-pages";
import { demoData } from "@/lib/demo/data";
export default async function Page({ params }: { params: Promise<{ componentId: string }> }) { const { componentId } = await params; const component = demoData.components.find((item) => item.id === componentId); if (!component) notFound(); return <ComponentDetail component={component} />; }

