import { ComponentDetail } from "@/components/portfolio-pages";
import { CreatedComponentDetail } from "@/components/created-portfolio-detail";
import { demoData } from "@/lib/demo/data";
export default async function Page({ params }: { params: Promise<{ componentId: string }> }) { const { componentId } = await params; const component = demoData.components.find((item) => item.id === componentId); if (!component) return <CreatedComponentDetail componentId={componentId} />; return <ComponentDetail component={component} />; }
