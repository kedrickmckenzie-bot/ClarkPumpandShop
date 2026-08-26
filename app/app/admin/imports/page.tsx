import type { Metadata } from "next";
import { ImportPreviewWorkspace } from "@/components/workspace/import-preview";
import { loadImportWorkspaceAccess } from "../../_data/operator-loader";
export const metadata: Metadata = { title: "Data imports" };
export default async function ImportsPage() { const access = await loadImportWorkspaceAccess(); return <ImportPreviewWorkspace organizationName={access.organizationName}/>; }
