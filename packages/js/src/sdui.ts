import { filterDocument } from "./filter.js";
import { builtInCatalogue, createRegistry, type ExtraWidgets } from "./registry.js";
import { childLists, type ChildList, type Pointer } from "./pointers.js";
import { sampleFromSchema } from "./sample.js";
import type { ClientInfo, Manifest, Page, Screen, Widget } from "./types.js";
import { validateDocument, type DocumentKind } from "./validate.js";

export interface SduiOptions {
  // Widgets that belong to the app, not to this package (for example a doctor card).
  extraWidgets?: ExtraWidgets;
}

// One line of the "add a widget" list.
export interface WidgetListing {
  type: string;
  version: number; // the newest version
  group: string; // "Basics", "Layout", "Media", "Content", "Interactive", "Live data" or "Custom"
  description: string;
  parts: string[]; // named pieces inside the widget that can each be styled (`style.parts`)
}

export function createSdui(options: SduiOptions = {}) {
  const registry = createRegistry(options.extraWidgets);
  return {
    validate: (document: unknown, kind?: DocumentKind) => validateDocument(registry, document, kind),
    filterForClient: <T extends Page | Screen | Manifest>(document: T, client: ClientInfo): T =>
      filterDocument(registry, document, client),
    // Every widget the dashboard can offer, built-in first, then the app's own.
    listWidgets: (): WidgetListing[] => [
      ...Object.entries(builtInCatalogue.types).map(([type, entry]) => ({
        type,
        version: Math.max(...Object.keys(entry.versions).map(Number)),
        group: entry.group ?? "Other",
        description: entry.description ?? "",
        parts: (entry as { parts?: string[] }).parts ?? [],
      })),
      ...Object.entries(options.extraWidgets ?? {}).map(([type, versions]) => ({
        type,
        version: Math.max(...Object.keys(versions).map(Number)),
        group: "Custom",
        description: "",
        parts: [],
      })),
    ],
    // The lists of widgets inside this widget (a carousel's items, each tab's contents...), with where each one is.
    childListsOf: (widget: Widget, pointer: Pointer): ChildList[] =>
      childLists(widget, pointer, registry.lookup(widget.type, widget.v)?.children ?? []),
    // A new widget of this type with data that is already valid, ready to be edited.
    sampleWidget: (type: string, version: number, id = `w_${type}_1`): Widget | undefined => {
      const schema = registry.lookup(type, version)?.validateData.schema as Record<string, unknown> | undefined;
      if (!schema) return undefined;
      return { id, type, v: version, data: sampleFromSchema(schema) as Record<string, any> };
    },
    // The JSON Schema for one widget's `data`, so a dashboard can build an edit form from it.
    widgetDataSchema: (type: string, version: number) =>
      registry.lookup(type, version)?.validateData.schema as Record<string, unknown> | undefined,
  };
}

// Ready-made instance that knows only the built-in widgets.
const builtIn = createSdui();
export const validate = builtIn.validate;
export const filterForClient = builtIn.filterForClient;
export const widgetDataSchema = builtIn.widgetDataSchema;
export const listWidgets = builtIn.listWidgets;
export const sampleWidget = builtIn.sampleWidget;
export const childListsOf = builtIn.childListsOf;
