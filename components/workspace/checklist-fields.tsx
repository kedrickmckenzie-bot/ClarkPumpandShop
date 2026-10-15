import styles from "./compliance.module.css";

/** Yes/No for each quick check. Answering "No" to any of them records the inspection as issues found. */
export function ChecklistFields({ items }: { items: readonly string[] }) {
  if (!items.length) return null;
  return (
    <fieldset className={styles.checklist}>
      <legend>Quick checks</legend>
      {items.map((item, index) => (
        <div key={item} className={styles.checkRow} role="radiogroup" aria-label={item}>
          <span>{item}</span>
          <label><input type="radio" name={`check-${index}`} value="yes" required /> Yes</label>
          <label><input type="radio" name={`check-${index}`} value="no" required /> No</label>
        </div>
      ))}
      <small>Any “No” is saved as issues found and goes to maintenance.</small>
    </fieldset>
  );
}
