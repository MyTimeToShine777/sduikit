import type { Page, Widget } from "./types.js";
import { deepCopy } from "./util.js";

// Small editing helpers for pages. Each returns a new page and leaves the one you passed in alone,
// so a dashboard can keep an undo history and Vue can see that something changed.

function collectIds(value: unknown, found: Set<string>): void {
  if (Array.isArray(value)) value.forEach((item) => collectIds(item, found));
  else if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    if (typeof object.id === "string") found.add(object.id);
    Object.values(object).forEach((item) => collectIds(item, found));
  }
}

/** Every `id` used anywhere in the document (sections, widgets, widgets inside widgets, tabs). */
export function allIds(document: unknown): Set<string> {
  const found = new Set<string>();
  collectIds(document, found);
  return found;
}

/** An id that is not used yet in the document, such as `w_banner_1`, `w_banner_2`... */
export function uniqueId(document: unknown, prefix: string): string {
  const used = allIds(document);
  let number = 1;
  while (used.has(`${prefix}_${number}`)) number++;
  return `${prefix}_${number}`;
}

/** The next revision name for a page: `2026-11-02.1`, then `2026-11-02.2`, and a new date starts again at 1. */
export function nextRevision(current: string | undefined, today: Date = new Date()): string {
  const date = today.toISOString().slice(0, 10);
  const match = current ? new RegExp(`^${date}\\.(\\d+)$`).exec(current) : null;
  return `${date}.${match ? Number(match[1]) + 1 : 1}`;
}

export function addSection(page: Page, title?: string, position = page.sections.length): Page {
  const copy = deepCopy(page);
  const section = { id: uniqueId(page, "section"), ...(title ? { title } : {}), widgets: [] as Widget[] };
  copy.sections.splice(clamp(position, 0, copy.sections.length), 0, section);
  return copy;
}

export function removeSection(page: Page, index: number): Page {
  const copy = deepCopy(page);
  copy.sections.splice(index, 1);
  return copy;
}

export function moveSection(page: Page, from: number, to: number): Page {
  const copy = deepCopy(page);
  if (!inRange(from, copy.sections.length) || !inRange(to, copy.sections.length) || from === to) return copy;
  const [moved] = copy.sections.splice(from, 1);
  copy.sections.splice(to, 0, moved);
  return copy;
}

export function renameSection(page: Page, index: number, title: string): Page {
  const copy = deepCopy(page);
  const section = copy.sections[index];
  if (!section) return copy;
  if (title.trim() === "") delete section.title;
  else section.title = title;
  return copy;
}

/** Puts a widget into a section (at the end unless a position is given). */
export function addWidget(page: Page, sectionIndex: number, widget: Widget, position?: number): Page {
  const copy = deepCopy(page);
  const section = copy.sections[sectionIndex];
  if (!section) return copy;
  section.widgets.splice(clamp(position ?? section.widgets.length, 0, section.widgets.length), 0, deepCopy(widget));
  return copy;
}

export function removeWidget(page: Page, sectionIndex: number, widgetIndex: number): Page {
  const copy = deepCopy(page);
  copy.sections[sectionIndex]?.widgets.splice(widgetIndex, 1);
  return copy;
}

export function replaceWidget(page: Page, sectionIndex: number, widgetIndex: number, widget: Widget): Page {
  const copy = deepCopy(page);
  const section = copy.sections[sectionIndex];
  if (section && inRange(widgetIndex, section.widgets.length)) section.widgets[widgetIndex] = deepCopy(widget);
  return copy;
}

/** Moves a widget within a section or to another one. `to.index` is the place it ends up in. */
export function moveWidget(
  page: Page,
  from: { section: number; index: number },
  to: { section: number; index: number },
): Page {
  const copy = deepCopy(page);
  const source = copy.sections[from.section];
  const target = copy.sections[to.section];
  if (!source || !target || !inRange(from.index, source.widgets.length)) return copy;
  const [moved] = source.widgets.splice(from.index, 1);
  target.widgets.splice(clamp(to.index, 0, target.widgets.length), 0, moved);
  return copy;
}

/** A copy of a widget with a new id (and new ids for any widgets inside it). */
export function duplicateWidget(page: Page, sectionIndex: number, widgetIndex: number): Page {
  const copy = deepCopy(page);
  const widget = copy.sections[sectionIndex]?.widgets[widgetIndex];
  if (!widget) return copy;
  const used = allIds(copy);
  // "w_banner_1" becomes "w_banner_1_copy", then "w_banner_1_copy2" and so on, until it is not used.
  const newIdFor = (id: string): string => {
    let candidate = `${id}_copy`;
    for (let number = 2; used.has(candidate); number++) candidate = `${id}_copy${number}`;
    used.add(candidate);
    return candidate;
  };
  const renumber = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(renumber);
    if (value === null || typeof value !== "object") return;
    const object = value as Record<string, unknown>;
    if (typeof object.id === "string") object.id = newIdFor(object.id);
    Object.values(object).forEach(renumber);
  };
  const twin = deepCopy(widget);
  renumber(twin);
  copy.sections[sectionIndex].widgets.splice(widgetIndex + 1, 0, twin);
  return copy;
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function inRange(index: number, length: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < length;
}
