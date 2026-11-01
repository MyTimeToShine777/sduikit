import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const repoRoot = join(here, "..", "..", "..");

// Reads one of the shared sample files from /fixtures.
export function loadFixture(name: string): any {
  return JSON.parse(readFileSync(join(repoRoot, "fixtures", name), "utf8"));
}
