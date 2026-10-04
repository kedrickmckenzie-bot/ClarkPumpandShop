import { OpsDomainError } from "@/lib/ops/errors";
import Link from "next/link";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { TechnicianHistory } from "@/components/workspace/technician-history";
import styles from "@/components/workspace/internal-dispatch.module.css";
async function renderWorkHistory({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const query=await searchParams,{repository,session}=await getOpsRequestContext(["technician"]),scope=await internalDispatchScope(repository,session);
  if(query.store&&!await repository.getStoreDetail(scope,query.store)||query.asset&&!await repository.getAssetDetail(scope,query.asset))return <section><h1>Work history not available</h1><p>You don&apos;t have access to this store.</p><Link href="/app/my-work">← My work</Link></section>;
  const organization=await repository.getOrganization(scope.organizationId);
  return <div className={styles.workspace}><header className={styles.jobHeader}><h1>Work history</h1><p>In-house and vendor work, with notes and photos.</p></header>
    <TechnicianHistory repository={repository} scope={scope} storeId={query.store} assetId={query.asset} cursor={query.cursor} title="Recent work" zone={organization?.timeZone} nextHref={cursor=>`?${new URLSearchParams({...query,cursor})}`}/>
  </div>;
}

export default async function WorkHistory(props:Parameters<typeof renderWorkHistory>[0]) {
  try { return await renderWorkHistory(props); } catch(error) {
    if (!(error instanceof OpsDomainError) || error.code !== "FORBIDDEN") throw error;
    return <section><h1>Work history not available</h1><p>You don&apos;t have access to this page.</p><Link href="/app/my-work">← My work</Link></section>;
  }
}
