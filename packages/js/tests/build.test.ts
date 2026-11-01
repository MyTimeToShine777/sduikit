import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "./helpers";

describe("built package", () => {
  it("builds and works when loaded by plain Node", () => {
    const packageFolder = join(repoRoot, "packages", "js");
    execFileSync("npm", ["run", "build"], { cwd: packageFolder, shell: true, stdio: "pipe" });

    const scratch = mkdtempSync(join(tmpdir(), "sduikit-smoke-"));
    const script = join(scratch, "smoke.mjs");
    const entry = join(packageFolder, "dist", "index.js").split("\\").join("/");
    writeFileSync(
      script,
      `import { validate } from "file:///${entry}";
       const good = validate({ schema: 1, id: "p", revision: "1", sections: [] });
       const bad = validate({ schema: 1, id: "p", revision: "1", sections: [{ id: "s", widgets: [{ id: "w", type: "nope", v: 1, data: {} }] }] });
       console.log(JSON.stringify({ good: good.valid, bad: bad.valid }));`,
    );
    const output = execFileSync("node", [script], { encoding: "utf8" });
    expect(JSON.parse(output)).toEqual({ good: true, bad: false });
  }, 60_000);
});
