import { issuesFromAjv, type ValidationIssue } from "./messages.js";
import { appendPath } from "./paths.js";
import type { Registry } from "./registry.js";
import { isObject } from "./util.js";
import { findWidgetLists } from "./widgetTree.js";

export type DocumentKind = "page" | "screen" | "manifest";

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
}

// Works out the kind of document from its top-level fields.
function guessKind(document: unknown): DocumentKind | undefined {
  if (!isObject(document)) return undefined;
  if ("sections" in document) return "page";
  if ("root" in document) return "screen";
  if ("theme" in document) return "manifest";
  return undefined;
}

export function validateDocument(registry: Registry, document: unknown, kind?: DocumentKind): ValidationResult {
  const documentKind = kind ?? guessKind(document);
  if (!documentKind) {
    return {
      valid: false,
      errors: [
        {
          path: "",
          message:
            'Cannot tell what kind of document this is. It should be a page (has "sections"), a screen (has "root") or a manifest (has "theme").',
        },
      ],
    };
  }

  const errors: ValidationIssue[] = [];

  // Step 1: the overall shape, checked by the JSON Schema file for this kind of document.
  const checkShape = registry.getSchema(`${documentKind}.json`);
  if (!checkShape(document)) errors.push(...issuesFromAjv(checkShape.errors ?? []));

  // Step 2: every widget's `data` has its own schema, chosen by the widget's type and version.
  visitWidgets(documentKind, document, (widget, path) => checkWidget(registry, widget, path, errors));

  return { valid: errors.length === 0, errors: removeRepeats(errors) };
}

function removeRepeats(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.path}|${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type WidgetVisitor = (widget: unknown, path: string) => void;

function visitWidgets(kind: DocumentKind, document: unknown, visit: WidgetVisitor): void {
  if (!isObject(document)) return;
  if (kind === "page" && Array.isArray(document.sections)) {
    document.sections.forEach((section, sectionIndex) => {
      if (!isObject(section) || !Array.isArray(section.widgets)) return;
      section.widgets.forEach((widget, widgetIndex) => visit(widget, `sections[${sectionIndex}].widgets[${widgetIndex}]`));
    });
  }
  if (kind === "screen") visitBlock(document.root, "root", visit);
}

function visitBlock(block: unknown, path: string, visit: WidgetVisitor): void {
  if (!isObject(block)) return;
  if (block.block === "widget") visit(block.widget, `${path}.widget`);
  if (Array.isArray(block.children)) {
    block.children.forEach((child, index) => visitBlock(child, `${path}.children[${index}]`, visit));
  }
}

function checkWidget(registry: Registry, widget: unknown, path: string, errors: ValidationIssue[]): void {
  // If the outer shape is broken, step 1 already reported it.
  if (!isObject(widget) || typeof widget.type !== "string" || !Number.isInteger(widget.v)) return;

  const info = registry.lookup(widget.type, widget.v as number);
  if (!info) {
    const versions = registry.knownVersions(widget.type);
    errors.push(
      versions.length === 0
        ? { path: appendPath(path, "type"), message: `Unknown widget type "${widget.type}".` }
        : {
            path: appendPath(path, "v"),
            message: `Widget "${widget.type}" has no version ${widget.v}. Known versions: ${versions.join(", ")}.`,
          },
    );
    return;
  }

  if (isObject(widget.data)) {
    const dataPath = appendPath(path, "data");
    if (!info.validateData(widget.data)) errors.push(...issuesFromAjv(info.validateData.errors ?? [], dataPath));
    // Widgets inside this widget (card children, carousel items, tab contents...) get the same checks.
    for (const slot of findWidgetLists(widget.data, info.children, dataPath)) {
      slot.widgets.forEach((child, index) => checkWidget(registry, child, `${slot.path}[${index}]`, errors));
    }
  }

  if (isObject(widget.fallback)) checkWidget(registry, widget.fallback, appendPath(path, "fallback"), errors);
}
