import { renderInternalDispatch } from "@/lib/server/internal-dispatch-page";
export const metadata = { title: "Dispatch" };
export default async function DispatchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return renderInternalDispatch(await searchParams, false);
}
