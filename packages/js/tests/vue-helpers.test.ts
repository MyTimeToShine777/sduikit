import { describe, expect, it } from "vitest";
import { listWidgets, validate, widgetDataSchema } from "../src/index";
import { schemaToFields } from "../src/vue/fields";
import { insertItem, moveItem, removeItem } from "../src/vue/reorder";

describe("reorder helpers", () => {
  it("moves an item and leaves the original alone", () => {
    const original = ["a", "b", "c"];
    expect(moveItem(original, 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(original, 2, 0)).toEqual(["c", "a", "b"]);
    expect(original).toEqual(["a", "b", "c"]);
  });
  it("ignores a move that does not make sense", () => {
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], -1, 0)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });
  it("removes an item", () => expect(removeItem(["a", "b", "c"], 1)).toEqual(["a", "c"]));
  it("inserts an item, and adds to the end if the index is past it", () => {
    expect(insertItem(["a", "c"], 1, "b")).toEqual(["a", "b", "c"]);
    expect(insertItem(["a"], 99, "z")).toEqual(["a", "z"]);
    expect(insertItem(["a"], -5, "z")).toEqual(["z", "a"]);
  });
});

describe("schemaToFields", () => {
  it("builds fields for a banner", () => {
    const fields = schemaToFields(widgetDataSchema("banner", 1)!);
    expect(fields.slice(0, 3)).toEqual([
      { key: "imageUrl", label: "Image url", kind: "url", required: true },
      { key: "title", label: "Title", kind: "text", required: false },
      { key: "subtitle", label: "Subtitle", kind: "text", required: false },
    ]);
    // ...and the options added later: a number, a choice, a colour
    expect(fields.find((f) => f.key === "height")!.kind).toBe("number");
    expect(fields.find((f) => f.key === "contentAlignment")!.kind).toBe("choice");
    expect(fields.find((f) => f.key === "overlayColor")!.kind).toBe("colour");
  });

  it("turns a token reference into a choice list", () => {
    const [size] = schemaToFields(widgetDataSchema("spacer", 1)!);
    // a space is a name from the theme or an exact number
    expect(size.kind).toBe("value");
    expect(size.presets).toEqual(["none", "xs", "sm", "md", "lg", "xl"]);
    const icon = schemaToFields(widgetDataSchema("icon", 1)!).find((f) => f.key === "name")!;
    expect(icon.kind).toBe("choice");
  });

  it("knows numbers, whole numbers, true/false and lists of widgets", () => {
    const carousel = schemaToFields(widgetDataSchema("carousel", 1)!);
    expect(carousel.find((f) => f.key === "items")!.kind).toBe("widgets");
    expect(carousel.find((f) => f.key === "autoplay")!.kind).toBe("boolean");
    expect(carousel.find((f) => f.key === "viewportFraction")).toMatchObject({ kind: "number", min: 0.3, max: 1 });
    expect(schemaToFields(widgetDataSchema("grid", 1)!).find((f) => f.key === "columns")).toMatchObject({
      kind: "integer", min: 1, max: 6, required: true,
    });
  });

  it("turns a list of objects into a list of groups, and a list of widgets inside them stays a widget list", () => {
    const [tabs] = schemaToFields(widgetDataSchema("tabs", 1)!);
    expect(tabs.kind).toBe("list");
    expect(tabs.minItems).toBe(1);
    expect(tabs.item!.kind).toBe("group");
    expect(tabs.item!.fields!.map((f) => [f.key, f.kind])).toEqual([["id", "text"], ["label", "text"], ["widgets", "widgets"], ["icon", "choice"]]);
  });

  it("follows the shared action schema, and treats an object with no named fields as free-form JSON", () => {
    const quick = schemaToFields(widgetDataSchema("quick_actions", 1)!).find((f) => f.kind === "list")!;
    expect(quick.item!.fields!.some((f) => f.kind === "action")).toBe(true);
    const params = schemaToFields(widgetDataSchema("data_list", 1)!).find((f) => f.key === "source")!.fields!.find((f) => f.key === "params")!;
    expect(params.kind).toBe("json");
  });

  it("gives every kind of widget a form with no field it cannot show", () => {
    const kinds = new Set(["text", "longtext", "url", "number", "integer", "boolean", "choice", "widgets", "action", "group", "list", "json", "colour", "value"]);
    const check = (fields: any[]) => fields.forEach((f) => { expect(kinds.has(f.kind), f.key).toBe(true); check(f.fields ?? []); if (f.item) check([f.item]); });
    for (const listing of listWidgets()) check(schemaToFields(widgetDataSchema(listing.type, 1)!));
  });

  it("returns undefined for a widget that does not exist", () => {
    expect(widgetDataSchema("hologram", 1)).toBeUndefined();
  });
});
