import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SearchPicker, matchesQuery } from "@/components/ops/search-picker";

const stores = Array.from({ length: 70 }, (_, index) => ({ value: `store-${index + 101}`, label: `Store ${index + 101} · Clark Pump and Shop`, detail: index === 3 ? "104 Ridgeview Drive" : undefined }));

describe("search picker", () => {
  it("matches every typed word anywhere in the name, details or tag", () => {
    expect(matchesQuery({ value: "a", label: "Robin Carter", tag: "Store manager" }, "robin manager")).toBe(true);
    expect(matchesQuery({ value: "a", label: "Robin Carter", tag: "Store manager" }, "robin vendor")).toBe(false);
    expect(matchesQuery(stores[3], "ridgeview")).toBe(true);
  });

  it("shows the whole list to scroll before anything is typed", () => {
    const html = renderToStaticMarkup(createElement(SearchPicker, { name: "storeId", label: "Store", required: true, options: stores }));
    expect(html.match(/role="option"/g)).toHaveLength(70);
    expect(html).toContain("70 to choose from · type to narrow");
  });

  it("keeps a preset choice folded: the choice shows and submits, the list opens when the box is used", () => {
    const html = renderToStaticMarkup(createElement(SearchPicker, { name: "storeId", label: "Store", required: true, options: stores, defaultValue: "store-104" }));
    expect(html).toContain('name="storeId" value="store-104"');
    expect(html).toMatch(/role="status"[^>]*>.*Store 104/);
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="option"');
  });
});
