import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { builtInCatalogue } from "../src/registry";
import { repoRoot } from "./helpers";

// The Flutter code cannot be run here, but it can be read: every part a widget lists must be used by that
// widget's drawing code, or the part would be accepted in a page and then silently ignored in the app.
const files = ["builtin_widgets", "display_widgets", "interactive_widgets", "form_widget", "data_list_widget", "options"].map((name) =>
  readFileSync(join(repoRoot, "packages", "flutter", "lib", "src", `${name}.dart`), "utf8").replace(/\r\n/g, "\n"),
);
const source = files.join("\n");

// type -> the name of the function that draws it: `..register('card', 1, _card)`
const builders = new Map<string, string>();
for (const match of source.matchAll(/register\('(\w+)',\s*1,\s*(\w+)\)/g)) builders.set(match[1], match[2]);

// The code of one drawing function and the helper classes next to it (tabs, accordion and gallery keep their pieces in a State class).
function codeOf(builder: string): string {
  const start = source.indexOf(`Widget ${builder}(`);
  if (start < 0) return "";
  const next = source.indexOf("\nWidget ", start + 10);
  let body = source.slice(start, next < 0 ? undefined : next);
  const extra = { _tabs: "_SduiTabsState", _accordion: "_SduiAccordionState", _gallery: "_SduiGalleryState", buildForm: "_SduiFormState", buildDataList: "_SduiDataListState" }[builder];
  if (extra) body += source.slice(source.indexOf(`class ${extra}`), source.indexOf(`class ${extra}`) + 6000);
  // The dark layer over a picture is drawn by a shared helper.
  if (body.includes("sduiPictureOverlay(")) body += source.slice(source.indexOf("Widget sduiPictureOverlay("));
  return body;
}

describe("Flutter draws every part a widget lists", () => {
  const widgetsWithParts = Object.entries(builtInCatalogue.types).filter(([, entry]) => (entry as { parts?: string[] }).parts?.length);

  it("knows the drawing function of every widget that has parts", () => {
    for (const [type] of widgetsWithParts) expect(builders.has(type), `${type} is not registered in Dart`).toBe(true);
  });

  for (const [type, entry] of widgetsWithParts) {
    it(`${type}: ${(entry as { parts: string[] }).parts.join(", ")}`, () => {
      const code = codeOf(builders.get(type)!);
      expect(code.length, `could not find the Dart code of ${type}`).toBeGreaterThan(50);
      for (const part of (entry as { parts: string[] }).parts) {
        expect(code.includes(`'${part}'`), `the Flutter code of ${type} never uses the part '${part}'`).toBe(true);
      }
    });
  }
});
