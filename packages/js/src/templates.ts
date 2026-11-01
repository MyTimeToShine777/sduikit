const wholePlaceholder = /^\{\{\s*[\w.]+\s*\}\}$/;
const anyPlaceholder = /\{\{\s*[\w.]+\s*\}\}/g;
const placeholderName = /^\{\{\s*([\w.]+)\s*\}\}$/;
const eachPlaceholder = /\{\{\s*([\w.]+)\s*\}\}/g;

// Inside a data_list template, "{{photoUrl}}" stands for a real value that only exists once the app
// has loaded a row. To check the rest of the template, swap each placeholder for a value that
// looks right: a web address when the text is only a placeholder, or a plain word when the
// placeholder sits inside other text ("{{specialty}} · {{fee}} AED" becomes "x · x AED").
// Placeholders are meant for text, web addresses and action params, not for numbers or choices.
export function withSamplePlaceholders<T>(value: T): T {
  if (typeof value === "string") {
    const sample = wholePlaceholder.test(value) ? "https://example.com/sample" : value.replace(anyPlaceholder, "x");
    return sample as T;
  }
  if (Array.isArray(value)) return value.map((item) => withSamplePlaceholders(item)) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, withSamplePlaceholders(item)]),
    ) as T;
  }
  return value;
}

// Marks a value the row does not have. Such entries are left out instead of being filled in.
const missing = Symbol("missing");

function lookup(row: Record<string, unknown>, path: string): unknown {
  let current: unknown = row;
  for (const part of path.split(".")) {
    if (current !== null && typeof current === "object" && part in (current as object)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function fill(value: unknown, row: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    const whole = placeholderName.exec(value);
    // A text that is only a placeholder keeps the row's own type, so a number stays a number.
    if (whole) return lookup(row, whole[1]) ?? missing;
    // A placeholder inside other text becomes plain text; a missing value becomes nothing.
    return value.replace(eachPlaceholder, (_all, path: string) => String(lookup(row, path) ?? ""));
  }
  if (Array.isArray(value)) return value.map((item) => fill(item, row)).filter((item) => item !== missing);
  if (value !== null && typeof value === "object") {
    const filled: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const result = fill(item, row);
      // A field whose only content was a placeholder the row cannot fill is dropped, never invented.
      if (result !== missing) filled[key] = result;
    }
    return filled;
  }
  return value;
}

/**
 * Fills every `{{field}}` in a data_list template with the values of one row, the same way the app does.
 * `{{doctor.name}}` reads nested values. A field the row does not have is left out (or becomes empty text
 * inside a longer text). A dashboard uses it to show the template with example rows.
 */
export function fillTemplate(template: unknown, row: Record<string, unknown>): unknown {
  const result = fill(template, row);
  return result === missing ? undefined : result;
}
