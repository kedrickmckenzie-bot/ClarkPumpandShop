import Link from "next/link";
import type { SavedView } from "@/lib/ops/types";
import styles from "./saved-views.module.css";

export interface SavedViewsBarModel {
  surface: string;
  /** Current filter query string, e.g. "status=open&store=store-104". */
  currentQuery: string;
  views: SavedView[];
}

export function SavedViewsBar({ model }: { model: SavedViewsBarModel }) {
  const { surface, currentQuery, views } = model;
  return (
    <div className={styles.bar}>
      <span className={styles.label}>Saved views</span>
      <div className={styles.chips}>
        {views.length === 0 ? <span className={styles.empty}>None yet</span> : null}
        {views.map((view) => (
          <span key={view.id} className={styles.chip}>
            <Link className={styles.chipLink} href={`/app/${surface}?${view.queryJson}`}>
              {view.name}
            </Link>
            <form action="/api/ops/saved-views" method="post" className={styles.deleteForm}>
              <input type="hidden" name="operation" value="delete" />
              <input type="hidden" name="id" value={view.id} />
              <input type="hidden" name="surface" value={surface} />
              <input type="hidden" name="returnTo" value={`/app/${surface}${currentQuery ? `?${currentQuery}` : ""}`} />
              <button type="submit" className={styles.deleteButton} aria-label={`Delete saved view ${view.name}`}>
                ×
              </button>
            </form>
          </span>
        ))}
      </div>
      {currentQuery ? (
        <form action="/api/ops/saved-views" method="post" className={styles.saveForm}>
          <input type="hidden" name="operation" value="save" />
          <input type="hidden" name="surface" value={surface} />
          <input type="hidden" name="query" value={currentQuery} />
          <input type="hidden" name="returnTo" value={`/app/${surface}?${currentQuery}`} />
          <input
            type="text"
            name="name"
            required
            maxLength={60}
            placeholder="Name this filtered view"
            aria-label="Saved view name"
            className={styles.nameInput}
          />
          <button type="submit" className={styles.saveButton}>
            Save current filters
          </button>
        </form>
      ) : (
        <span className={styles.hint}>Apply filters to enable saving a view.</span>
      )}
    </div>
  );
}
