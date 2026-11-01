import { describe, expect, it } from "vitest";
import { validate } from "../src/sdui";
import { loadFixture, page, screen, widget } from "./helpers";

const banner = (data: unknown = { imageUrl: "https://example.com/a.jpg" }, extra = {}) => widget("banner", data, extra);

describe("validate: sample files", () => {
  it.each(["valid/page-home.json", "valid/page-showcase.json", "valid/screen-offers.json", "valid/manifest.json"])("%s is valid", (name) => {
    const result = validate(loadFixture(name));
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

// [description, document, path of the wrong field, words the message must contain]
const problems: Array<[string, unknown, string, string]> = [
  ["a missing required field", page(banner({})), "sections[0].widgets[0].data.imageUrl", "required"],
  ["an unknown widget type", page(widget("hologram", {})), "sections[0].widgets[0].type", 'Unknown widget type "hologram"'],
  ["an unknown widget version", page(banner(undefined, { v: 9 })), "sections[0].widgets[0].v", "has no version 9. Known versions: 1"],
  ["a style value that is not a token", page(banner(undefined, { style: { spacing: "huge" } })), "sections[0].widgets[0].style.spacing", "Must be one of: none, xs, sm, md, lg, xl"],
  ["an extra field in data", page(banner({ imageUrl: "https://example.com/a.jpg", colour: "red" })), "sections[0].widgets[0].data.colour", "not allowed"],
  ["an action missing its screenId", page(banner(undefined, { action: { type: "open_screen" } })), "sections[0].widgets[0].action.screenId", "required"],
  ["an unknown action type", page(banner(undefined, { action: { type: "explode" } })), "sections[0].widgets[0].action", '"explode" is not a known value for "type"'],
  ["a lower-case country code", page(banner(undefined, { rules: { countries: ["ae"] } })), "sections[0].widgets[0].rules.countries[0]", "expected format"],
  ["a start date that is not a date", page(banner(undefined, { rules: { from: "yesterday" } })), "sections[0].widgets[0].rules.from", "valid date and time"],
  ["a wrong kind of value", page(widget("text", { text: 5 })), "sections[0].widgets[0].data.text", "Must be text"],
  ["an empty text", page(widget("text", { text: "" })), "sections[0].widgets[0].data.text", "Must not be empty"],
  ["a bad widget inside a card", page(widget("card", { children: [widget("text", { text: "" })] })), "sections[0].widgets[0].data.children[0].data.text", "Must not be empty"],
  ["an unknown widget inside a tab", page(widget("tabs", { tabs: [{ id: "a", label: "A", widgets: [widget("hologram", {})] }] })), "sections[0].widgets[0].data.tabs[0].widgets[0].type", "Unknown widget type"],
  ["a bad fallback widget", page(banner(undefined, { fallback: widget("hologram", {}) })), "sections[0].widgets[0].fallback.type", "Unknown widget type"],
  ["a block name it does not know", screen({ block: "nope" }), "root", '"nope" is not a known value for "block"'],
  ["a bad widget inside a screen", screen({ block: "column", children: [{ block: "widget", widget: banner({}) }] }), "root.children[0].widget.data.imageUrl", "required"],
  ["a missing top-level field", { ...page(), revision: undefined }, "revision", "required"],
];

describe("validate: problems are reported with the path and plain words", () => {
  it.each(problems)("%s", (_description, document, expectedPath, expectedWords) => {
    const result = validate(document);
    expect(result.valid).toBe(false);
    const match = result.errors.find((issue) => issue.path === expectedPath);
    expect(match, `no error at ${expectedPath}; got ${JSON.stringify(result.errors)}`).toBeDefined();
    expect(match!.message).toContain(expectedWords);
  });

  it("reports a missing manifest colour at its path", () => {
    const manifest = loadFixture("valid/manifest.json");
    delete manifest.theme.light.primary;
    const result = validate(manifest);
    expect(result.errors.map((issue) => issue.path)).toContain("theme.light.primary");
  });

  it("reports every problem, not just the first", () => {
    const result = validate(page(banner({}), widget("hologram", {})));
    const paths = result.errors.map((issue) => issue.path);
    expect(paths).toContain("sections[0].widgets[0].data.imageUrl");
    expect(paths).toContain("sections[0].widgets[1].type");
  });

  it("does not report the same problem twice", () => {
    const result = validate(page(widget("card", { children: [widget("text", { text: "" })] })));
    const keys = result.errors.map((issue) => `${issue.path}|${issue.message}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("says when it cannot tell what kind of document it is", () => {
    const result = validate({ hello: "world" });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("Cannot tell what kind of document");
  });

  it("does not crash on things that are not objects", () => {
    expect(validate(null).valid).toBe(false);
    expect(validate("text").valid).toBe(false);
    expect(validate(page("not a widget")).valid).toBe(false);
  });

  it("can be told the kind of document", () => {
    expect(validate({ hello: "world" }, "page").valid).toBe(false);
  });
});
