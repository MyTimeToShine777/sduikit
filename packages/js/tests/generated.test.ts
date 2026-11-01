import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-ignore: plain JavaScript file with no type declarations
import { buildSchemasModule } from "../../../scripts/generate-schemas.mjs";
import { repoRoot } from "./helpers";

describe("generated schema file", () => {
  it("matches the files in /schemas (run `npm run schemas` if this fails)", () => {
    const onDisk = readFileSync(
      join(repoRoot, "packages", "js", "src", "generated", "schemas.ts"),
      "utf8",
    ).replace(/\r\n/g, "\n");
    expect(onDisk).toBe(buildSchemasModule(join(repoRoot, "schemas")));
  });
});
