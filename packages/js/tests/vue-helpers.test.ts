import { describe, expect, it } from "vitest";
import { widgetDataSchema } from "../src/index";
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
    expect(fields).toEqual([
      { key: "imageUrl", label: "Image url", kind: "url", required: true },
      { key: "title", label: "Title", kind: "text", required: false },
      { key: "subtitle", label: "Subtitle", kind: "text", required: false },
    ]);
  });

  it("turns a token reference into a choice list", () => {
    const [size] = schemaToFields(widgetDataSchema("spacer", 1)!);
    expect(size.kind).toBe("choice");
    expect(size.choices).toEqual(["none", "xs", "sm", "md", "lg", "xl"]);
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

  it("marks lists of other things as unsupported", () => {
    expect(schemaToFields(widgetDataSchema("tabs", 1)!)[0].kind).toBe("unsupported");
  });

  it("returns undefined for a widget that does not exist", () => {
    expect(widgetDataSchema("hologram", 1)).toBeUndefined();
  });
});
