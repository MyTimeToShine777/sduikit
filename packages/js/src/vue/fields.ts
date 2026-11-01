import { schemaFiles } from "../generated/schemas.js";

export type FieldKind =
  | "text"
  | "longtext"
  | "url"
  | "number"
  | "integer"
  | "boolean"
  | "choice"
  | "widgets" // widgets inside this widget: edited in the layers tree, not in the form
  | "action" // what happens on tap
  | "group" // a set of named fields (an object)
  | "list" // a list the user can add to, remove from and reorder
  | "json"; // anything with no fixed shape (a box for JSON)

// One input in an edit form, worked out from a widget's data schema.
export interface Field {
  key: string;
  label: string; // "actionLabel" becomes "Action label"
  kind: FieldKind;
  required: boolean;
  choices?: string[]; // for kind "choice"
  min?: number;
  max?: number;
  fields?: Field[]; // for kind "group"
  item?: Field; // for kind "list": what one entry looks like
  minItems?: number;
  maxItems?: number;
}

export function humanize(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const LONG_TEXT_KEYS = /^(text|body|description|message|content|answer)$/i;

// A value in a schema may point at the shared token list or at the shared action schema; follow it.
function resolveRef(ref: string): Record<string, any> | undefined {
  const token = /tokens\.json#\/\$defs\/(\w+)$/.exec(ref);
  if (token) return (schemaFiles["common/tokens.json"] as any).$defs[token[1]];
  return undefined;
}

function fieldFor(key: string, input: Record<string, any>, required: boolean): Field {
  const base = { key, label: humanize(key), required };
  let property = input;

  if (typeof property.$ref === "string") {
    if (property.$ref.endsWith("action.json")) return { ...base, kind: "action" };
    if (property.$ref.endsWith("widget.json")) return { ...base, kind: "widgets" };
    const resolved = resolveRef(property.$ref);
    if (!resolved) return { ...base, kind: "json" };
    property = { ...resolved, ...property };
  }
  if (Array.isArray(property.enum)) return { ...base, kind: "choice", choices: property.enum.map(String) };

  switch (property.type) {
    case "string":
      if (property.format === "uri") return { ...base, kind: "url" };
      return { ...base, kind: LONG_TEXT_KEYS.test(key) || (property.maxLength ?? 0) > 120 ? "longtext" : "text" };
    case "number":
      return { ...base, kind: "number", min: property.minimum, max: property.maximum };
    case "integer":
      return { ...base, kind: "integer", min: property.minimum, max: property.maximum };
    case "boolean":
      return { ...base, kind: "boolean" };
    case "array": {
      if (typeof property.items?.$ref === "string" && property.items.$ref.endsWith("widget.json")) return { ...base, kind: "widgets" };
      if (!property.items) return { ...base, kind: "json" };
      return {
        ...base,
        kind: "list",
        item: fieldFor("", property.items, true),
        minItems: property.minItems,
        maxItems: property.maxItems,
      };
    }
    case "object":
      // An object with named properties becomes a group; one without (like "params") is free-form JSON.
      return property.properties ? { ...base, kind: "group", fields: schemaToFields(property) } : { ...base, kind: "json" };
    default:
      return { ...base, kind: "json" };
  }
}

// Turns a widget's data schema (or any object schema) into the list of inputs an edit form should show.
export function schemaToFields(schema: Record<string, any>): Field[] {
  const required: string[] = schema.required ?? [];
  return Object.entries<Record<string, any>>(schema.properties ?? {}).map(([key, property]) =>
    fieldFor(key, property, required.includes(key)),
  );
}

// A new, empty entry for a list, so "Add" gives something that can be filled in.
export function blankFor(field: Field): unknown {
  switch (field.kind) {
    case "group":
      return Object.fromEntries((field.fields ?? []).filter((each) => each.required).map((each) => [each.key, blankFor(each)]));
    case "list":
    case "widgets":
      return [];
    case "boolean":
      return false;
    case "number":
    case "integer":
      return field.min ?? 0;
    case "choice":
      return field.choices?.[0] ?? "";
    case "json":
      return {};
    case "action":
      return undefined;
    default:
      // Every entry of a list needs its own id; make a fresh one so the new entry is already valid.
      return field.key === "id" ? `item_${Math.random().toString(36).slice(2, 7)}` : "";
  }
}
