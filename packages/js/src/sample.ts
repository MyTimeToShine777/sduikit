import { schemaFiles } from "./generated/schemas.js";
import { isObject } from "./util.js";

type Schema = Record<string, any>;

// A schema reference to one of the token lists (spacing, color, icon...). Used to pick the first name.
function tokenChoices(reference: string): string[] | undefined {
  const match = /tokens\.json#\/\$defs\/(\w+)$/.exec(reference);
  if (!match) return undefined;
  const definitions = (schemaFiles["common/tokens.json"] as { $defs: Record<string, { enum: string[] }> }).$defs;
  return definitions[match[1]]?.enum;
}

// The smallest valid widget there is. Used when a schema needs a widget inside it (a container's first child).
const placeholderWidget = () => ({ id: "w_text_1", type: "text", v: 1, data: { text: "Text" } });

/**
 * Makes a value that satisfies a JSON Schema, using the smallest simple choices: the first allowed
 * name, the lowest allowed number, "Text" for text, only the required fields. A dashboard uses it
 * to start a new widget off with data that is already valid, so the person only has to change it.
 */
export function sampleFromSchema(schema: Schema): unknown {
  if (typeof schema.$ref === "string") {
    const choices = tokenChoices(schema.$ref);
    if (choices) return choices[0];
    if (schema.$ref.endsWith("widget.json")) return placeholderWidget();
    if (schema.$ref.endsWith("action.json")) return { type: "dismiss" };
    return null;
  }
  if ("const" in schema) return schema.const;
  if (Array.isArray(schema.enum)) return schema.enum[0];

  switch (schema.type) {
    case "string": {
      if (schema.format === "uri") return "https://example.com/";
      if (schema.format === "date-time") return "2030-01-01T00:00:00Z";
      if (schema.pattern === "^[A-Za-z_][A-Za-z0-9_]*$") return "field";
      return "Text";
    }
    case "number":
    case "integer": {
      if (typeof schema.minimum === "number") return schema.minimum;
      if (typeof schema.exclusiveMinimum === "number") return schema.type === "integer" ? schema.exclusiveMinimum + 1 : schema.exclusiveMinimum + 0.1;
      return schema.type === "integer" ? 1 : 0;
    }
    case "boolean":
      return false;
    case "array": {
      const count = Math.max(schema.minItems ?? 0, 0);
      return Array.from({ length: count }, () => sampleFromSchema(schema.items ?? {}));
    }
    case "object": {
      const result: Record<string, unknown> = {};
      const properties: Record<string, Schema> = schema.properties ?? {};
      for (const key of schema.required ?? []) {
        if (properties[key]) result[key] = sampleFromSchema(properties[key]);
      }
      // "Must not be empty": if nothing is required but something is needed, fill in the first field.
      if (Object.keys(result).length < (schema.minProperties ?? 0)) {
        const [firstKey] = Object.keys(properties).filter((key) => !(key in result));
        if (firstKey) result[firstKey] = sampleFromSchema(properties[firstKey]);
      }
      return result;
    }
    default:
      return isObject(schema) ? null : undefined;
  }
}
