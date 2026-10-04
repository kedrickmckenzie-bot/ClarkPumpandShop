import { renderInternalDispatch } from "@/lib/server/internal-dispatch-page";
export const metadata = { title: "My work" };
export default async function MyWorkPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return renderInternalDispatch(await searchParams, true);
}
