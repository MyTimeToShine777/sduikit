import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-ignore: plain JavaScript file with no type declarations
import { buildSchemasModule } from "../../../scripts/generate-schemas.mjs";
// @ts-ignore: plain JavaScript file with no type declarations
import { buildWidgetDocs } from "../../../scripts/generate-widget-docs.mjs";
import { repoRoot } from "./helpers";

// Files written on Windows may end their lines with \r\n; the generators always use \n.
const readWithPlainLineEnds = (...parts: string[]) => readFileSync(join(repoRoot, ...parts), "utf8").replace(/\r\n/g, "\n");

describe("generated files", () => {
  it("the schema file matches the files in /schemas (run `npm run schemas` if this fails)", () => {
    const onDisk = readWithPlainLineEnds("packages", "js", "src", "generated", "schemas.ts");
    expect(onDisk).toBe(buildSchemasModule(join(repoRoot, "schemas")));
  });

  it("docs/widgets.md matches the schemas (run `npm run docs` if this fails)", () => {
    expect(readWithPlainLineEnds("docs", "widgets.md")).toBe(buildWidgetDocs());
  });
});
