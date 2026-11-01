import { filterDocument } from "./filter.js";
import { createRegistry } from "./registry.js";
import type { ClientInfo, Manifest, Page, Screen } from "./types.js";
import { validateDocument, type DocumentKind } from "./validate.js";

export function createSdui() {
  const registry = createRegistry();
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
