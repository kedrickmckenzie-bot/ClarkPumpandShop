import {storeWorkspaceContext} from "@/lib/server/store-workspace-context";
import {StoreWorkspaceNav} from "@/components/workspace/store-workspace-nav";
import Workspace from "@/components/workspace/store-task-workspace";
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}) {const {id}=await params;await storeWorkspaceContext(id);return <><StoreWorkspaceNav id={id} active="tasks"/><Workspace fixedStore={id} searchParams={searchParams}/></>;}
