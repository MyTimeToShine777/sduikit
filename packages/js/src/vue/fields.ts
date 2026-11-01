import { schemaFiles } from "../generated/schemas.js";

export type FieldKind = "text" | "url" | "number" | "integer" | "boolean" | "choice" | "widgets" | "unsupported";

// One input in an edit form, worked out from a widget's data schema.
export interface Field {
  key: string;
  label: string; // "actionLabel" becomes "Action label"
  kind: FieldKind;
  required: boolean;
  choices?: string[]; // for kind "choice"
  min?: number;
  max?: number;
}

function humanize(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// A style or spacing value in a schema points at the token list; follow it to get the choices.
function tokenChoices(ref: string): string[] | undefined {
  const match = /tokens\.json#\/\$defs\/(\w+)$/.exec(ref);
  if (!match) return undefined;
  const definitions = (schemaFiles["common/tokens.json"] as { $defs: Record<string, { enum: string[] }> }).$defs;
  return definitions[match[1]]?.enum;
}

function fieldFor(key: string, property: Record<string, any>, required: boolean): Field {
  const base = { key, label: humanize(key), required };

  if (typeof property.$ref === "string") {
    const choices = tokenChoices(property.$ref);
    return choices ? { ...base, kind: "choice", choices } : { ...base, kind: "unsupported" };
  }
  if (Array.isArray(property.enum)) return { ...base, kind: "choice", choices: property.enum.map(String) };

  switch (property.type) {
    case "string":
      return { ...base, kind: property.format === "uri" ? "url" : "text" };
    case "number":
      return { ...base, kind: "number", min: property.minimum, max: property.maximum };
    case "integer":
      return { ...base, kind: "integer", min: property.minimum, max: property.maximum };
    case "boolean":
      return { ...base, kind: "boolean" };
    case "array": {
      const holdsWidgets = typeof property.items?.$ref === "string" && property.items.$ref.endsWith("widget.json");
      return { ...base, kind: holdsWidgets ? "widgets" : "unsupported" };
    }
    default:
      return { ...base, kind: "unsupported" };
  }
}

// Turns a widget's data schema into the list of inputs an edit form should show.
export function schemaToFields(schema: Record<string, any>): Field[] {
  const required: string[] = schema.required ?? [];
  return Object.entries<Record<string, any>>(schema.properties ?? {}).map(([key, property]) =>
    fieldFor(key, property, required.includes(key)),
  );
}
