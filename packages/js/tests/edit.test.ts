import { describe, expect, it } from "vitest";
import {
  addSection,
  addWidget,
  allIds,
  createSdui,
  duplicateWidget,
  listWidgets,
  moveSection,
  moveWidget,
  nextRevision,
  removeSection,
  removeWidget,
  renameSection,
  replaceWidget,
  sampleWidget,
  uniqueId,
  validate,
} from "../src/index";
import type { Page } from "../src/index";
import { loadFixture, page, widget } from "./helpers";

const text = (id: string) => widget("text", { text: id }, { id });
const pageOf = (...sections: Array<{ id: string; widgets: unknown[] }>): Page => ({
  schema: 1,
  id: "p",
  revision: "1",
  sections,
} as Page);

describe("sampleWidget: every widget starts out valid", () => {
  const listings = listWidgets();

  it("lists all the built-in widgets, grouped and described", () => {
    expect(listings).toHaveLength(66);
    expect(new Set(listings.map((entry) => entry.group))).toEqual(
      new Set(["Basics", "Layout", "Media", "Content", "Interactive", "Live data", "Building blocks"]),
    );
    expect(listings.every((entry) => entry.description.length > 5)).toBe(true);
  });

  it.each(listings.map((entry) => [entry.type, entry.version] as const))("%s", (type, version) => {
    const fresh = sampleWidget(type, version);
    expect(fresh, `no sample for ${type}`).toBeDefined();
    const result = validate(page(fresh));
    expect(result.errors).toEqual([]);
  });

  it("returns nothing for a widget that does not exist", () => {
    expect(sampleWidget("hologram", 1)).toBeUndefined();
  });

  it("uses the id it is given", () => {
    expect(sampleWidget("banner", 1, "w_banner_7")!.id).toBe("w_banner_7");
  });

  it("also works for an app's own widgets, and lists them as Custom", () => {
    const sdui = createSdui({
      extraWidgets: {
        product_tile: { 1: { schema: { type: "object", properties: { sku: { type: "string", minLength: 1 } }, required: ["sku"] } } },
      },
    });
    expect(sdui.listWidgets().find((entry) => entry.type === "product_tile")).toMatchObject({ group: "Custom", version: 1 });
    const fresh = sdui.sampleWidget("product_tile", 1)!;
    expect(fresh.data).toEqual({ sku: "Text" });
    expect(sdui.validate(page(fresh)).valid).toBe(true);
  });
});

describe("ids and revisions", () => {
  it("finds every id, including widgets inside widgets", () => {
    const ids = allIds(loadFixture("valid/page-home.json"));
    expect(ids.has("home")).toBe(true);
    expect(ids.has("w_card_2_text")).toBe(true); // inside a card inside a carousel
    expect(ids.has("upcoming")).toBe(true); // a tab
  });

  it("makes an id that is not used yet", () => {
    const doc = pageOf({ id: "s", widgets: [text("w_text_1"), text("w_text_2")] });
    expect(uniqueId(doc, "w_text")).toBe("w_text_3");
    expect(uniqueId(doc, "w_banner")).toBe("w_banner_1");
  });

  it("starts a revision at 1 on a new day and counts up on the same day", () => {
    const day = new Date("2026-11-02T10:00:00Z");
    expect(nextRevision(undefined, day)).toBe("2026-11-02.1");
    expect(nextRevision("2026-11-01.7", day)).toBe("2026-11-02.1");
    expect(nextRevision("2026-11-02.1", day)).toBe("2026-11-02.2");
    expect(nextRevision("2026-11-02.9", day)).toBe("2026-11-02.10");
    expect(nextRevision("something else", day)).toBe("2026-11-02.1");
  });
});

describe("editing sections", () => {
  const base = pageOf({ id: "a", widgets: [] }, { id: "b", widgets: [] }, { id: "c", widgets: [] });

  it("adds a section with a new id, at the end or in a place, with an optional title", () => {
    const withNew = addSection(base, "News");
    expect(withNew.sections.map((section) => section.id)).toEqual(["a", "b", "c", "section_1"]);
    expect(withNew.sections[3].title).toBe("News");
    expect(addSection(base, undefined, 1).sections[1].id).toBe("section_1");
    expect(addSection(addSection(base), undefined).sections.map((s) => s.id).slice(3)).toEqual(["section_1", "section_2"]);
  });

  it("removes, moves and renames sections", () => {
    expect(removeSection(base, 1).sections.map((s) => s.id)).toEqual(["a", "c"]);
    expect(moveSection(base, 0, 2).sections.map((s) => s.id)).toEqual(["b", "c", "a"]);
    expect(moveSection(base, 0, 9).sections.map((s) => s.id)).toEqual(["a", "b", "c"]); // nonsense move: no change
    expect(renameSection(base, 1, "Hello").sections[1].title).toBe("Hello");
    expect("title" in renameSection(renameSection(base, 1, "Hello"), 1, "  ").sections[1]).toBe(false);
  });

  it("never changes the page it was given", () => {
    const before = JSON.stringify(base);
    addSection(base, "x");
    removeSection(base, 0);
    moveSection(base, 0, 1);
    expect(JSON.stringify(base)).toBe(before);
  });
});

describe("editing widgets", () => {
  const base = pageOf({ id: "a", widgets: [text("t1"), text("t2")] }, { id: "b", widgets: [text("t3")] });
  const ids = (doc: Page) => doc.sections.map((section) => section.widgets.map((w) => w.id));

  it("adds at the end or in a place", () => {
    expect(ids(addWidget(base, 0, text("n")))).toEqual([["t1", "t2", "n"], ["t3"]]);
    expect(ids(addWidget(base, 0, text("n"), 1))).toEqual([["t1", "n", "t2"], ["t3"]]);
    expect(ids(addWidget(base, 5, text("n")))).toEqual([["t1", "t2"], ["t3"]]); // no such section: no change
  });

  it("removes and replaces", () => {
    expect(ids(removeWidget(base, 0, 0))).toEqual([["t2"], ["t3"]]);
    expect(ids(replaceWidget(base, 1, 0, text("new")))).toEqual([["t1", "t2"], ["new"]]);
  });

  it("moves within a section and to another section", () => {
    expect(ids(moveWidget(base, { section: 0, index: 0 }, { section: 0, index: 1 }))).toEqual([["t2", "t1"], ["t3"]]);
    expect(ids(moveWidget(base, { section: 0, index: 1 }, { section: 1, index: 0 }))).toEqual([["t1"], ["t2", "t3"]]);
    expect(ids(moveWidget(base, { section: 0, index: 9 }, { section: 1, index: 0 }))).toEqual([["t1", "t2"], ["t3"]]);
  });

  it("duplicates a widget with new ids, also for the widgets inside it", () => {
    const withCard = pageOf({
      id: "a",
      widgets: [widget("card", { title: "Card", children: [text("inner")] }, { id: "card" })],
    });
    const twice = duplicateWidget(duplicateWidget(withCard, 0, 0), 0, 0);
    const all = twice.sections[0].widgets;
    expect(all.map((w) => w.id)).toEqual(["card", "card_copy2", "card_copy"]);
    expect((all[2].data.children[0] as { id: string }).id).toBe("inner_copy");
    expect(new Set(allIds(twice)).size).toBe(allIds(twice).size);
  });

  it("keeps the page valid after a series of edits", () => {
    let doc = loadFixture("valid/page-home.json") as Page;
    doc = addSection(doc, "New section");
    doc = addWidget(doc, doc.sections.length - 1, sampleWidget("hero", 1, uniqueId(doc, "w_hero"))!);
    doc = moveWidget(doc, { section: 0, index: 0 }, { section: doc.sections.length - 1, index: 0 });
    doc = duplicateWidget(doc, 1, 0);
    expect(validate(doc).errors).toEqual([]);
  });
});
