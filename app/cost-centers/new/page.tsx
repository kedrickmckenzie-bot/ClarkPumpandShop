import { RegistryConsole } from "@/components/registry-console";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { const query = await searchParams; return <RegistryConsole initialEntity="cost-centers" initialStoreId={typeof query.storeId === "string" ? query.storeId : ""} />; }
