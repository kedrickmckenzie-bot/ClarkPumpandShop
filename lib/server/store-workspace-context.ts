import "server-only";
import { notFound } from "next/navigation";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getServerOpsRepository } from "./ops-repository-provider";

export async function storeWorkspaceContext(id: string) {
  const session = await loadOperatorSession(), repository = await getServerOpsRepository();
  const store = await repository.getStore(session.organizationId,id);
  if (!store || session.storeIds !== undefined && !session.storeIds.includes(id) || session.regionIds !== undefined && !session.regionIds.includes(store.regionId ?? "")) notFound();
  return { session, repository, store };
}
