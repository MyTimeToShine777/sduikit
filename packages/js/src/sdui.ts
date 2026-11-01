import { filterDocument } from "./filter.js";
import { createRegistry, type ExtraWidgets } from "./registry.js";
import type { ClientInfo, Manifest, Page, Screen } from "./types.js";
import { validateDocument, type DocumentKind } from "./validate.js";

export interface SduiOptions {
  // Widgets that belong to the app, not to this package (for example a doctor card).
  extraWidgets?: ExtraWidgets;
}

export function createSdui(options: SduiOptions = {}) {
  const registry = createRegistry(options.extraWidgets);
  return {
    validate: (document: unknown, kind?: DocumentKind) => validateDocument(registry, document, kind),
    filterForClient: <T extends Page | Screen | Manifest>(document: T, client: ClientInfo): T =>
      filterDocument(registry, document, client),
  };
}

// Ready-made instance that knows only the built-in widgets.
const builtIn = createSdui();
export const validate = builtIn.validate;
export const filterForClient = builtIn.filterForClient;
