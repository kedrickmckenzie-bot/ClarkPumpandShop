import ComplianceWorkspace from "@/components/workspace/compliance-workspace";
export default async function CompliancePage({searchParams}:{searchParams:Promise<{view?:string;offset?:string;store?:string;notice?:string;error?:string}>}) {return <ComplianceWorkspace searchParams={searchParams}/>;}
