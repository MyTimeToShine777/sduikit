const wholePlaceholder = /^\{\{\s*[\w.]+\s*\}\}$/;
const anyPlaceholder = /\{\{\s*[\w.]+\s*\}\}/g;

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
