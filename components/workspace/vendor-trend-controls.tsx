"use client";
import { SearchPicker, type PickOption } from "@/components/ops/search-picker";
import styles from "./vendor-trends.module.css";

/** Who to look at: one category, and all outside vendors or one picked from a scrollable, searchable list. */
export function VendorTrendControls({ vendors, categories, vendor, category }: { vendors: PickOption[]; categories: Array<{ key: string; label: string }>; vendor?: string; category?: string }) {
  const chosen = vendors.find((option) => option.value === vendor);
  return (
    <form className={styles.controls} action="/app/trends" method="get">
      <input type="hidden" name="view" value="vendors" />
      <div className={styles.picker}>
        <SearchPicker key={vendor ?? "all"} compact name="vendor" label="Vendor" options={vendors} defaultValue={vendor} defaultOption={chosen}
          placeholder="All outside vendors · click or type a name" allowClear clearLabel="All outside vendors" submitOnSelect />
      </div>
      <label>Category
        <select name="category" defaultValue={category ?? ""} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
          <option value="">All categories</option>
          {categories.map((row) => <option key={row.key} value={row.key}>{row.label}</option>)}
        </select>
      </label>
      <noscript><button type="submit">Show</button></noscript>
    </form>
  );
}
