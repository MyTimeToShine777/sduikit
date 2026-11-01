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
  | "colour" // a colour: a picker, a #RRGGBB code, or a theme colour name
  | "value" // a number, or a name from the theme (a size, a space...)
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
  presets?: string[]; // for kind "value": the names that can be typed instead of a number
}

export function humanize(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const LONG_TEXT_KEYS = /^(text|body|description|message|content|answer)$/i;

// A value in a schema may point at a shared definition (the token lists, or the shared style and layout values).
function resolveRef(ref: string): Record<string, any> | undefined {
  const match = /(tokens|style|layout)\.json#\/\$defs\/(\w+)$/.exec(ref);
  if (!match) return undefined;
  return (schemaFiles[`common/${match[1]}.json`] as any)?.$defs?.[match[2]];
}

// The names a "name or number" value accepts: the enum in its `then`, or the token list that `then` points at.
function presetsOf(definition: Record<string, any>): string[] {
  const then = definition.then;
  if (Array.isArray(then?.enum)) return then.enum.map(String);
  if (typeof then?.$ref === "string") {
    const target = resolveRef(then.$ref);
    if (Array.isArray(target?.enum)) return target.enum.map(String);
  }
  return [];
}

function fieldFor(key: string, input: Record<string, any>, required: boolean): Field {
  const base = { key, label: humanize(key), required };
  let property = input;

  if (typeof property.$ref === "string") {
    if (property.$ref.endsWith("action.json")) return { ...base, kind: "action" };
    if (property.$ref.endsWith("widget.json")) return { ...base, kind: "widgets" };
    const resolved = resolveRef(property.$ref);
    if (!resolved) return { ...base, kind: "json" };
    if (property.$ref.endsWith("/colour")) return { ...base, kind: "colour" };
    const { $ref: _ref, ...rest } = property;
    property = { ...resolved, ...rest };
  }
  if (Array.isArray(property.enum)) return { ...base, kind: "choice", choices: property.enum.map(String) };

  // "A name or a number" (a space, a size, a corner): one box that takes either.
  if (Array.isArray(property.type) && property.type.includes("number")) {
    const range = property.else ?? {};
    return { ...base, kind: "value", presets: presetsOf(property), min: range.minimum, max: range.maximum };
  }

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
    case "colour":
      return "#000000";
    case "value":
      return field.min ?? 0;
    case "json":
      return {};
    case "action":
      return undefined;
    default:
      // Every entry of a list needs its own id; make a fresh one so the new entry is already valid.
      return field.key === "id" ? `item_${Math.random().toString(36).slice(2, 7)}` : "";
  }
}
