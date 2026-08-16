import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Render runtime contract", () => {
  it("keeps Sites scripts while providing explicit standard Node commands", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      name: string;
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };

    expect(packageJson.name).toBe("cstore-operations-suite");
    expect(packageJson.scripts.dev).toContain("vinext dev");
    expect(packageJson.scripts.build).toContain("vinext build");
    expect(packageJson.scripts.start).toContain("vinext start");
    expect(packageJson.scripts["dev:render"]).toContain("OPS_RUNTIME=render");
    expect(packageJson.scripts["build:render"]).toBe(
      "cross-env OPS_RUNTIME=render next build",
    );
    expect(packageJson.scripts["start:render"]).toBe(
      "cross-env OPS_RUNTIME=render next start --hostname 0.0.0.0",
    );
    expect(packageJson.scripts["start:render:free"]).toBe(
      "npm run render:predeploy && npm run start:render",
    );
    expect(packageJson.dependencies.next).toBeTruthy();
  });

  it("binds to the injected host and port without omitting static assets", () => {
    const environmentExample = readFileSync(".env.example", "utf8");

    expect(environmentExample).toContain("HOSTNAME=0.0.0.0");
    expect(environmentExample).toContain("PORT=3000");
  });

  it("does not retain the old family-name Sites URL as metadata branding", () => {
    const rootLayout = readFileSync("app/layout.tsx", "utf8");

    expect(rootLayout).not.toContain("clarks-operations-demo");
    expect(rootLayout).toContain("NEXT_PUBLIC_SITE_URL");
  });
});
