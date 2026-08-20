import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ComponentLifecyclePanel } from "@/components/ops/component-lifecycle-panel";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";

describe("Component lifecycle experience", () => {
  it("shows structured replacement provenance and sample-size-safe life analytics", () => {
    const fixture = buildNorthlinePresentationFixture();
    const asset = fixture.assets.find((item) => item.id === "asset-104-beer-cave")!;
    const component = fixture.components.find((item) => item.id === "component-104-compressor")!;
    const markup = renderToStaticMarkup(createElement(ComponentLifecyclePanel, { fixture, asset, component, canManage: true }));
    expect(markup).toContain("Component replacement intelligence");
    expect(markup).toContain("62 months");
    expect(markup).toContain("65%");
    expect(markup).toContain("Small sample");
    expect(markup).toContain("Summit Refrigeration");
    expect(markup).toContain("repair-item-104-compressor-2026-07");
    expect(markup).toContain("Warranty opportunity");
  });
});
