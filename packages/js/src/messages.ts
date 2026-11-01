import type { ErrorObject } from "ajv";
import { appendPath, pointerToPath } from "./paths.js";

export interface ValidationIssue {
  // Where the problem is, for example "sections[0].widgets[1].data.title". Empty means the whole document.
  path: string;
  message: string;
}

const typeNames: Record<string, string> = {
  string: "text",
  number: "a number",
  integer: "a whole number",
  boolean: "true or false",
  object: "an object",
  array: "a list",
  null: "null",
};

const formatNames: Record<string, string> = {
  uri: "web address (URL), for example https://example.com",
  "date-time": "date and time, for example 2026-11-01T00:00:00Z",
};

// Returns the readable version of one Ajv error, or null if the error adds nothing
// (Ajv also reports "the if-rule failed", which only repeats the real errors).
function describe(error: ErrorObject): { extraPath: string; message: string } | null {
  const params = error.params as Record<string, any>;
  switch (error.keyword) {
    case "if":
      return null;
    case "required":
      return { extraPath: params.missingProperty, message: "This field is required." };
    case "additionalProperties":
      return { extraPath: params.additionalProperty, message: "This field is not allowed here." };
    case "type": {
      const expected = [params.type].flat().map((name: string) => typeNames[name] ?? name);
      return { extraPath: "", message: `Must be ${expected.join(" or ")}.` };
    }
    case "enum":
      return { extraPath: "", message: `Must be one of: ${(params.allowedValues as unknown[]).join(", ")}.` };
    case "const":
      return { extraPath: "", message: `Must be ${JSON.stringify(params.allowedValue)}.` };
    case "pattern":
      return { extraPath: "", message: "Is not in the expected format." };
    case "format":
      return { extraPath: "", message: `Must be a valid ${formatNames[params.format] ?? params.format}.` };
    case "minimum":
      return { extraPath: "", message: `Must be at least ${params.limit}.` };
    case "maximum":
      return { extraPath: "", message: `Must be at most ${params.limit}.` };
    case "exclusiveMinimum":
      return { extraPath: "", message: `Must be greater than ${params.limit}.` };
    case "minLength":
      return { extraPath: "", message: params.limit === 1 ? "Must not be empty." : `Must be at least ${params.limit} characters.` };
    case "minItems":
      return { extraPath: "", message: params.limit === 1 ? "Must have at least one item." : `Must have at least ${params.limit} items.` };
    case "maxItems":
      return { extraPath: "", message: `Must have at most ${params.limit} items.` };
    case "minProperties":
      return { extraPath: "", message: "Must not be empty." };
    case "uniqueItems":
      return { extraPath: "", message: "Must not contain the same value twice." };
    case "discriminator":
      if (params.error === "tag") {
        return { extraPath: "", message: `Needs a "${params.tag}" field with a text value.` };
      }
      return { extraPath: "", message: `"${params.tagValue}" is not a known value for "${params.tag}".` };
    default:
      return { extraPath: "", message: `Is not valid (${error.message ?? error.keyword}).` };
  }
}

// Turns Ajv's technical errors into issues a person can act on.
// `basePath` is added in front of every path (used when only a part of the document was checked).
export function issuesFromAjv(errors: ErrorObject[], basePath = ""): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const error of errors) {
    const described = describe(error);
    if (!described) continue;
    const where = appendPath(basePath, pointerToPath(error.instancePath));
    issues.push({ path: appendPath(where, described.extraPath), message: described.message });
  }
  return issues;
}
