import Workspace from "@/components/workspace/store-task-workspace";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {const q=await searchParams;return <Workspace searchParams={Promise.resolve(q)} sourceId={q.source}/>;}
