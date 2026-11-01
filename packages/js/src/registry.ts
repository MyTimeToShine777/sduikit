import Ajv2020 from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { schemaFiles } from "./generated/schemas.js";

// Only used as a name for each schema; nothing is ever downloaded from this address.
export const SCHEMA_BASE = "https://sduikit.dev/schemas/";

interface CatalogueFile {
  types: Record<string, { versions: Record<string, { since: string; schema: string; children: string[] }> }>;
}

export const builtInCatalogue = schemaFiles["catalogue.json"] as CatalogueFile;

export interface WidgetInfo {
  // Where this widget's `data` holds other widgets, e.g. ["items"] or ["tabs[].widgets"].
  children: string[];
  // Checks the widget's `data` object against its own schema.
  validateData: ValidateFunction;
}

export interface Registry {
  getSchema(file: string): ValidateFunction;
  lookup(type: string, version: number): WidgetInfo | undefined;
  knownVersions(type: string): number[];
}

interface WidgetEntry {
  schemaKey: string;
  children: string[];
}

export function createRegistry(): Registry {
  // strict: true makes Ajv complain about mistakes in our own schema files instead of ignoring them.
  const ajv = new Ajv2020({ allErrors: true, strict: true, discriminator: true });
  addFormats(ajv);

  for (const [file, schema] of Object.entries(schemaFiles)) {
    if (file === "catalogue.json") continue; // the catalogue is a list, not a JSON Schema
    ajv.addSchema(schema as object, SCHEMA_BASE + file);
  }

  const widgetTypes = new Map<string, Map<number, WidgetEntry>>();
  for (const [type, entry] of Object.entries(builtInCatalogue.types)) {
    const versions = new Map<number, WidgetEntry>();
    for (const [version, info] of Object.entries(entry.versions)) {
      versions.set(Number(version), { schemaKey: SCHEMA_BASE + info.schema, children: info.children });
    }
    widgetTypes.set(type, versions);
  }

  function getSchema(file: string): ValidateFunction {
    const check = ajv.getSchema(SCHEMA_BASE + file);
    if (!check) throw new Error(`There is no schema file named ${file}`);
    return check;
  }

  return {
    getSchema,
    lookup(type, version) {
      const entry = widgetTypes.get(type)?.get(version);
      if (!entry) return undefined;
      const validateData = ajv.getSchema(entry.schemaKey);
      if (!validateData) throw new Error(`The schema ${entry.schemaKey} is listed but was not loaded`);
      return { children: entry.children, validateData };
    },
    knownVersions(type) {
      return [...(widgetTypes.get(type)?.keys() ?? [])].sort((a, b) => a - b);
    },
  };
}
