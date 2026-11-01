import type { Registry } from "./registry.js";
import type { Block, ClientInfo, Manifest, Page, Rules, Screen, Widget } from "./types.js";
import { deepCopy } from "./util.js";
import { compareVersions } from "./version.js";
import { findWidgetLists } from "./widgetTree.js";

interface FilterContext {
  registry: Registry;
  client: ClientInfo & { now: Date };
}

// Returns a copy of the document with everything this client must not receive taken out.
// The document passed in is never changed.
export function filterDocument<T extends Page | Screen | Manifest>(registry: Registry, document: T, client: ClientInfo): T {
  const context: FilterContext = { registry, client: { ...client, now: client.now ?? new Date() } };
  const copy: Page | Screen | Manifest = deepCopy(document);

  if ("sections" in copy) {
    copy.sections = copy.sections
      .map((section) => ({ ...section, widgets: filterWidgets(context, section.widgets) }))
      // A section with nothing left to show would only leave an empty gap or a lonely title.
      .filter((section) => section.widgets.length > 0);
  } else if ("root" in copy) {
    copy.root = filterBlock(context, copy.root) ?? { block: "column", children: [] };
  }
  return copy as T;
}

function filterWidgets(context: FilterContext, widgets: Widget[]): Widget[] {
  const kept: Widget[] = [];
  for (const widget of widgets) {
    const result = resolveWidget(context, widget);
    if (result) kept.push(result);
  }
  return kept;
}

// Decides what to send for one widget: itself, its fallback, or nothing.
// Works on the private copy made in filterDocument, so it may change the widget in place.
function resolveWidget(context: FilterContext, widget: Widget): Widget | null {
  // Rules mean "do not show this to this person", so the fallback is not used here.
  if (!passesRules(widget.rules, context.client)) return null;

  const canDraw = context.client.supportedWidgets[widget.type]?.includes(widget.v) ?? false;
  if (!canDraw) return widget.fallback ? resolveWidget(context, widget.fallback) : null;

  // A widget type the package does not know (an app's own widget) is treated as having no children.
  const childLists = context.registry.lookup(widget.type, widget.v)?.children ?? [];
  for (const slot of findWidgetLists(widget.data, childLists, "")) {
    slot.owner[slot.key] = filterWidgets(context, slot.widgets as Widget[]);
  }

  if (widget.fallback) {
    const fallback = resolveWidget(context, widget.fallback);
    if (fallback) widget.fallback = fallback;
    else delete widget.fallback;
  }
  return widget;
}

function filterBlock(context: FilterContext, block: Block): Block | null {
  if (block.block === "widget") {
    const widget = resolveWidget(context, block.widget);
    return widget ? { ...block, widget } : null;
  }
  if ("children" in block) {
    block.children = block.children
      .map((child) => filterBlock(context, child))
      .filter((child): child is Block => child !== null);
  }
  return block;
}

function passesRules(rules: Rules | undefined, client: FilterContext["client"]): boolean {
  if (!rules) return true;

  if (rules.countries && (!client.country || !rules.countries.includes(client.country))) return false;

  if (rules.minAppVersion && compareVersions(client.appVersion, rules.minAppVersion) < 0) return false;

  if (rules.from && client.now < new Date(rules.from)) return false;
  if (rules.to && client.now >= new Date(rules.to)) return false;

  for (const [key, allowedValues] of Object.entries(rules.audience ?? {})) {
    const clientValues = [client.audience?.[key] ?? []].flat();
    if (!clientValues.some((value) => allowedValues.includes(value))) return false;
  }
  return true;
}
