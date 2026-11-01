import type { Widget } from "./types.js";
import { deepCopy, isObject } from "./util.js";

/**
 * A place in a document, written as the list of steps to get there:
 * `["sections", 0, "widgets", 2, "data", "items", 1]` is the second item of the carousel that is the third
 * widget of the first section. These work at any depth, so a dashboard can edit a widget inside a widget inside
 * a widget the same way as one directly on the page.
 */
export type Pointer = Array<string | number>;

export const samePointer = (a: Pointer, b: Pointer) => a.length === b.length && a.every((step, index) => step === b[index]);
export const startsWith = (pointer: Pointer, prefix: Pointer) => pointer.length >= prefix.length && prefix.every((step, index) => step === pointer[index]);
/** True when `pointer` is somewhere inside `ancestor` (and not the same place). */
export const isInside = (pointer: Pointer, ancestor: Pointer) => pointer.length > ancestor.length && startsWith(pointer, ancestor);

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** What is at that place, or undefined if there is nothing. */
export function getAt(root: unknown, pointer: Pointer): unknown {
  let current: unknown = root;
  for (const step of pointer) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string | number, unknown>)[step];
  }
  return current;
}

function spotOf(root: unknown, pointer: Pointer): { parent: any; key: string | number } | undefined {
  if (!pointer.length) return undefined;
  const parent = getAt(root, pointer.slice(0, -1));
  return parent !== null && typeof parent === "object" ? { parent, key: pointer[pointer.length - 1] } : undefined;
}

// All of these return a changed copy and leave the document you gave them alone.

/** Puts `value` at that place. */
export function setAt<T>(root: T, pointer: Pointer, value: unknown): T {
  if (!pointer.length) return deepCopy(value) as T;
  const copy = deepCopy(root);
  const spot = spotOf(copy, pointer);
  if (spot) spot.parent[spot.key] = deepCopy(value);
  return copy;
}

/** Takes the item at that place out of the list it is in. */
export function removeAt<T>(root: T, pointer: Pointer): T {
  const copy = deepCopy(root);
  const spot = spotOf(copy, pointer);
  if (spot && Array.isArray(spot.parent)) spot.parent.splice(Number(spot.key), 1);
  return copy;
}

/** Puts `value` into the list at `listPointer`, at `index` (the end if the index is too big). */
export function insertAt<T>(root: T, listPointer: Pointer, index: number, value: unknown): T {
  const copy = deepCopy(root);
  const list = getAt(copy, listPointer);
  if (Array.isArray(list)) list.splice(clamp(index, 0, list.length), 0, deepCopy(value));
  return copy;
}

// When an item is taken out of a list, the later items of that list shift up by one. If the place we want to
// put it is inside one of those later items, its pointer has to shift too.
function afterRemoval(target: Pointer, removed: Pointer): Pointer {
  const listOfRemoved = removed.slice(0, -1);
  const removedIndex = removed[removed.length - 1];
  const depth = listOfRemoved.length;
  if (target.length > depth && startsWith(target, listOfRemoved) && typeof target[depth] === "number" && typeof removedIndex === "number" && target[depth] > removedIndex) {
    const shifted = [...target];
    shifted[depth] = (target[depth] as number) - 1;
    return shifted;
  }
  return target;
}

/**
 * Moves the item at `from` into the list at `toList`, so that it ends up at `toIndex` (counted before the move,
 * like "drop it before the item that is now at that place"). It works inside one list, between lists, and between
 * levels. A widget is never moved into itself. If the move cannot be done, nothing changes.
 */
export function moveAt<T>(root: T, from: Pointer, toList: Pointer, toIndex: number): T {
  const copy = deepCopy(root);
  if (samePointer(toList, from) || isInside(toList, from)) return copy;
  const spot = spotOf(copy, from);
  if (!spot || !Array.isArray(spot.parent)) return copy;

  const fromIndex = Number(spot.key);
  const [moved] = spot.parent.splice(fromIndex, 1);
  const target = afterRemoval(toList, from);
  const list = getAt(copy, target);
  if (!Array.isArray(list)) {
    spot.parent.splice(fromIndex, 0, moved); // nowhere to put it: put it back
    return copy;
  }
  const sameList = samePointer(target, from.slice(0, -1));
  const index = sameList && toIndex > fromIndex ? toIndex - 1 : toIndex;
  list.splice(clamp(index, 0, list.length), 0, moved);
  return copy;
}

/** A list of widgets inside a widget (a carousel's items, a tab's contents, a card's children...). */
export interface ChildList {
  label: string; // for people: "Items", "Inside", `Tab "Upcoming"`...
  pointer: Pointer; // where the list is
  widgets: Widget[];
}

const LIST_NAMES: Record<string, string> = {
  items: "Items",
  children: "Inside",
  widgets: "Contents",
  template: "Template for each row",
};
const humanize = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

/**
 * Finds the lists of widgets inside one widget. `specs` says where to look, in the same notation as the catalogue
 * ("items", "tabs[].widgets"); `sdui.childListsOf(widget, pointer)` fills it in for you.
 */
export function childLists(widget: Widget, widgetPointer: Pointer, specs: string[]): ChildList[] {
  const found: ChildList[] = [];
  for (const spec of specs) walk(widget.data, spec.split("."), [...widgetPointer, "data"], "", found);
  return found;
}

function walk(value: unknown, parts: string[], pointer: Pointer, label: string, found: ChildList[]): void {
  if (!isObject(value) || parts.length === 0) return;
  const [head, ...rest] = parts;
  const forEveryEntry = head.endsWith("[]");
  const key = forEveryEntry ? head.slice(0, -2) : head;
  const next = value[key];
  const nextPointer = [...pointer, key];

  if (forEveryEntry) {
    if (!Array.isArray(next)) return;
    next.forEach((entry, index) => {
      const own = isObject(entry) ? (typeof entry.label === "string" ? entry.label : typeof entry.title === "string" ? entry.title : "") : "";
      walk(entry, rest, [...nextPointer, index], own ? `${humanize(key.replace(/s$/, ""))} "${own}"` : `${humanize(key.replace(/s$/, ""))} ${index + 1}`, found);
    });
  } else if (rest.length === 0) {
    if (Array.isArray(next)) found.push({ label: label || LIST_NAMES[key] || humanize(key), pointer: nextPointer, widgets: next as Widget[] });
  } else {
    walk(next, rest, nextPointer, label, found);
  }
}

/** Where the widget with this id is (anywhere in the document), or undefined. */
export function findPointerById(document: unknown, id: string): Pointer | undefined {
  const search = (value: unknown, pointer: Pointer): Pointer | undefined => {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index++) {
        const hit = search(value[index], [...pointer, index]);
        if (hit) return hit;
      }
    } else if (isObject(value)) {
      // Sections, tabs and widgets all have ids; only a widget has a type and data.
      if (value.id === id && typeof value.type === "string" && isObject(value.data)) return pointer;
      for (const [key, item] of Object.entries(value)) {
        const hit = search(item, [...pointer, key]);
        if (hit) return hit;
      }
    }
    return undefined;
  };
  return search(document, []);
}
