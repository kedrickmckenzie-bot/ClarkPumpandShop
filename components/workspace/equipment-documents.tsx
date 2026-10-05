import Link from "next/link";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { equipmentForDocuments } from "@/lib/server/equipment-documents";
import { roleCan } from "@/components/ops/role-policy";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { EQUIPMENT_DOCUMENT_TYPES, equipmentDocumentTypeLabel } from "@/lib/ops/equipment-documents";
import styles from "./equipment-documents.module.css";

/**
 * The equipment library for one unit: manuals and diagrams for its make and model, plus its own files.
 * Everyone who can see the equipment can open them; only managers add or remove them.
 */
export async function EquipmentDocuments({ assetId, saved, compact = false }: { assetId: string; saved?: string; compact?: boolean }) {
  const session = await loadOperatorSession(), repository = await getServerOpsRepository();
  const asset = await equipmentForDocuments(repository, session, assetId);
  const documents = await repository.listEquipmentDocuments(session.organizationId, asset);
  const canManage = !compact && roleCan(session, "setup_equipment");
  const modelName = [asset.manufacturer, asset.model].filter(Boolean).join(" ");
  const base = `/api/ops/equipment/${encodeURIComponent(assetId)}/documents`;
  return (
    <section className={styles.panel} id="documents" aria-labelledby="equipment-documents-title">
      <div className={styles.head}>
        <h2 id="equipment-documents-title">Manuals &amp; diagrams</h2>
        {modelName ? <span>{modelName}</span> : null}
      </div>
      {saved === "document" ? <p className={styles.saved} role="status">Document added.</p> : null}
      {saved === "document-removed" ? <p className={styles.saved} role="status">Document removed from the library.</p> : null}
      {documents.length ? (
        <ul className={styles.list}>
          {documents.map(document => (
            <li key={document.id}>
              <span className={styles.type}>{equipmentDocumentTypeLabel[document.docType]}</span>
              <div className={styles.main}>
                <a href={`${base}/${encodeURIComponent(document.id)}`} target="_blank" rel="noreferrer">{document.title}</a>
                <small>
                  {document.assetId ? "This unit only" : `All ${modelName || "units of this model"}`}
                  {` · added ${formatOperationsDate(document.createdAt)} by ${document.uploadedByName}`}
                </small>
              </div>
              {canManage ? (
                <details className={styles.remove}>
                  <summary>Remove</summary>
                  <form action={`${base}/${encodeURIComponent(document.id)}/remove`} method="post">
                    <p>Take “{document.title}” out of the library? It stays in the history.</p>
                    <button type="submit">Yes, remove it</button>
                  </form>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>{canManage ? "No manuals or diagrams yet. Add one below." : "No manuals or diagrams yet. Ask a manager to add them."}</p>
      )}
      {canManage ? (
        <details className={styles.add} open={!documents.length}>
          <summary>Add a document</summary>
          <form action={base} method="post" encType="multipart/form-data">
            <label>
              File <small>PDF or photo, up to 25 MB</small>
              <input type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" required />
            </label>
            <label>
              Name <small>Optional. We’ll use the file name if blank.</small>
              <input type="text" name="title" maxLength={160} placeholder="Service manual" />
            </label>
            <label>
              Type
              <select name="docType" defaultValue="manual">
                {EQUIPMENT_DOCUMENT_TYPES.map(type => <option key={type} value={type}>{equipmentDocumentTypeLabel[type]}</option>)}
              </select>
            </label>
            <fieldset>
              <legend>Show it on</legend>
              <label className={styles.choice}>
                <input type="radio" name="appliesTo" value="model" defaultChecked={Boolean(asset.model)} disabled={!asset.model} />
                {asset.model ? `Every ${modelName} at every store` : "Every unit of this model (add a model number first)"}
              </label>
              <label className={styles.choice}>
                <input type="radio" name="appliesTo" value="unit" defaultChecked={!asset.model} />
                Only this unit ({asset.assetTag})
              </label>
            </fieldset>
            <button type="submit" className={styles.primary}>Upload</button>
          </form>
        </details>
      ) : null}
      {compact ? <Link className={styles.more} href={`/app/equipment/${encodeURIComponent(assetId)}#documents`}>Open equipment</Link> : null}
    </section>
  );
}
