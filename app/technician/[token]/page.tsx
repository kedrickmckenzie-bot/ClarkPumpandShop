import { TechnicianVisitPage } from "@/components/technician-visit";
export default async function Page({ params }: { params: Promise<{ token: string }> }) { const { token } = await params; return <TechnicianVisitPage token={token} />; }

