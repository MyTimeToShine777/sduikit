import { createRegistry } from "./registry.js";
import { validateDocument, type DocumentKind } from "./validate.js";

export function createSdui() {
  const registry = createRegistry();
  return {
    validate: (document: unknown, kind?: DocumentKind) => validateDocument(registry, document, kind),
  };
}

// Ready-made instance that knows only the built-in widgets.
const builtIn = createSdui();
export const validate = builtIn.validate;
