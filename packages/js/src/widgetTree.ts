import { appendPath } from "./paths.js";
import { isObject } from "./util.js";

// One list of child widgets found inside a widget's data.
export interface WidgetSlot {
  owner: Record<string, unknown>; // the object that holds the list
  key: string; // the list's name inside `owner`
  path: string; // readable path of the list, for error messages
  widgets: unknown[]; // owner[key]
  spec: string; // the catalogue path that found it, e.g. "tabs[].widgets"
}

// Finds the lists of child widgets inside `data`.
// Each spec is a dotted path such as "items" or "tabs[].widgets"; "[]" means "do this for every entry".
export function findWidgetLists(data: unknown, specs: string[], basePath: string): WidgetSlot[] {
  const slots: WidgetSlot[] = [];
  for (const spec of specs) collect(data, spec.split("."), basePath, slots, spec);
  return slots;
}

function collect(value: unknown, parts: string[], path: string, slots: WidgetSlot[], spec: string): void {
  if (!isObject(value) || parts.length === 0) return;
  const [head, ...rest] = parts;
  const forEveryEntry = head.endsWith("[]");
  const key = forEveryEntry ? head.slice(0, -2) : head;
  const next = value[key];
  const nextPath = appendPath(path, key);

  if (forEveryEntry) {
    if (Array.isArray(next)) next.forEach((entry, index) => collect(entry, rest, `${nextPath}[${index}]`, slots, spec));
  } else if (rest.length === 0) {
    if (Array.isArray(next)) slots.push({ owner: value, key, path: nextPath, widgets: next, spec });
  } else {
    collect(next, rest, nextPath, slots, spec);
  }
}
