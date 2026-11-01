import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { schemaFiles } from "../src/generated/schemas";

const here = dirname(fileURLToPath(import.meta.url));

export const repoRoot = join(here, "..", "..", "..");

// Reads one of the shared sample files from /fixtures.
export function loadFixture(name: string): any {
  return JSON.parse(readFileSync(join(repoRoot, "fixtures", name), "utf8"));
}

const SCHEMA_BASE = "https://sduikit.dev/schemas/";
let sharedAjv: Ajv2020 | undefined;

// Builds one Ajv holding every schema file and returns the checker for one of them.
// Used by the schema tests so they do not depend on the package's own registry.
export function compileSchema(file: string): ValidateFunction {
  if (!sharedAjv) {
    sharedAjv = new Ajv2020({ allErrors: true, strict: true, discriminator: true, allowUnionTypes: true });
    addFormats(sharedAjv);
    for (const [name, schema] of Object.entries(schemaFiles)) {
      if (name === "catalogue.json") continue; // not a JSON Schema
      sharedAjv.addSchema(schema as object, SCHEMA_BASE + name);
    }
  }
  const check = sharedAjv.getSchema(SCHEMA_BASE + file);
  if (!check) throw new Error(`No schema file named ${file}`);
  return check;
}

// Builds a small page holding the given widgets in one section.
export function page(...widgets: unknown[]): any {
  return { schema: 1, id: "p", revision: "1", sections: [{ id: "s", widgets }] };
}

// Builds a small screen whose root is the given block.
export function screen(root: unknown): any {
  return { schema: 1, id: "s", revision: "1", root };
}

export function widget(type: string, data: unknown, extra: Record<string, unknown> = {}): any {
  return { id: `w_${type}`, type, v: 1, data, ...extra };
}
