import { VendorResponsePage } from "@/components/vendor-response";
export default async function Page({ params }: { params: Promise<{ token: string }> }) { const { token } = await params; return <VendorResponsePage token={token} />; }

