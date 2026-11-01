import { describe, expect, it } from "vitest";
import {
  childListsOf,
  duplicateAt,
  findPointerById,
  getAt,
  insertAt,
  isInside,
  moveAt,
  parentWidgetPointer,
  removeAt,
  sampleWidget,
  setAt,
  validate,
} from "../src/index";
import type { Pointer } from "../src/index";
import { loadFixture, widget } from "./helpers";

const text = (id: string) => widget("text", { text: id }, { id });
const doc = () => ({
  sections: [
    { id: "a", widgets: [text("t1"), widget("carousel", { items: [text("c1"), text("c2"), text("c3")] }, { id: "car" }), text("t3")] },
    { id: "b", widgets: [text("t4")] },
  ],
});
const ids = (list: any[]) => list.map((item) => item.id);

describe("getAt, setAt, removeAt, insertAt", () => {
  it("reads at any depth", () => {
    expect((getAt(doc(), ["sections", 0, "widgets", 1, "data", "items", 2]) as any).id).toBe("c3");
    expect(getAt(doc(), ["sections", 9])).toBeUndefined();
    expect(getAt(doc(), [])).toEqual(doc());
  });

  it("changes a copy and never the original", () => {
    const original = doc();
    const before = JSON.stringify(original);
    setAt(original, ["sections", 0, "widgets", 0, "data", "text"], "changed");
    removeAt(original, ["sections", 0, "widgets", 0]);
    insertAt(original, ["sections", 0, "widgets"], 0, text("new"));
    expect(JSON.stringify(original)).toBe(before);
  });

  it("sets, removes and inserts deep inside", () => {
    const changed = setAt(doc(), ["sections", 0, "widgets", 1, "data", "items", 0, "data", "text"], "edited");
    expect((getAt(changed, ["sections", 0, "widgets", 1, "data", "items", 0, "data", "text"]))).toBe("edited");
    const removed = removeAt(doc(), ["sections", 0, "widgets", 1, "data", "items", 1]);
    expect(ids((getAt(removed, ["sections", 0, "widgets", 1, "data", "items"]) as any[]))).toEqual(["c1", "c3"]);
    const inserted = insertAt(doc(), ["sections", 0, "widgets", 1, "data", "items"], 1, text("n"));
    expect(ids((getAt(inserted, ["sections", 0, "widgets", 1, "data", "items"]) as any[]))).toEqual(["c1", "n", "c2", "c3"]);
    expect(ids((getAt(insertAt(doc(), ["sections", 1, "widgets"], 99, text("end")), ["sections", 1, "widgets"]) as any[]))).toEqual(["t4", "end"]);
  });
});

describe("moveAt", () => {
  const items: Pointer = ["sections", 0, "widgets", 1, "data", "items"];

  it("moves inside one list, forwards and backwards (the index is where it lands before the move)", () => {
    expect(ids(getAt(moveAt(doc(), [...items, 0], items, 3), items) as any[])).toEqual(["c2", "c3", "c1"]); // to the end
    expect(ids(getAt(moveAt(doc(), [...items, 2], items, 0), items) as any[])).toEqual(["c3", "c1", "c2"]); // to the start
    expect(ids(getAt(moveAt(doc(), [...items, 0], items, 2), items) as any[])).toEqual(["c2", "c1", "c3"]); // before c3
  });

  it("moves a widget from the page into a container and back out", () => {
    const into = moveAt(doc(), ["sections", 0, "widgets", 0], items, 1);
    // t1 left the page list, so the carousel moved up from place 1 to place 0.
    const itemsNow: Pointer = ["sections", 0, "widgets", 0, "data", "items"];
    expect(ids(getAt(into, itemsNow) as any[])).toEqual(["c1", "t1", "c2", "c3"]);
    expect(ids(getAt(into, ["sections", 0, "widgets"]) as any[])).toEqual(["car", "t3"]);
    const out = moveAt(doc(), [...items, 1], ["sections", 1, "widgets"], 0);
    expect(ids(getAt(out, ["sections", 1, "widgets"]) as any[])).toEqual(["c2", "t4"]);
    expect(ids(getAt(out, items) as any[])).toEqual(["c1", "c3"]);
  });

  it("finds the right container even when removing the widget shifts it up one place", () => {
    // t1 is before the carousel; once t1 is gone the carousel is at place 0, not 1.
    const moved = moveAt(doc(), ["sections", 0, "widgets", 0], items, 3);
    expect(ids(getAt(moved, ["sections", 0, "widgets", 0, "data", "items"]) as any[])).toEqual(["c1", "c2", "c3", "t1"]);
  });

  it("never moves a widget into itself or into something inside itself", () => {
    const carousel: Pointer = ["sections", 0, "widgets", 1];
    expect(moveAt(doc(), carousel, items, 0)).toEqual(doc());
    expect(moveAt(doc(), carousel, [...carousel, "data", "items"], 0)).toEqual(doc());
  });

  it("changes nothing when the place does not exist", () => {
    expect(moveAt(doc(), ["sections", 0, "widgets", 0], ["sections", 5, "widgets"], 0)).toEqual(doc());
  });

  it("knows what is inside what", () => {
    expect(isInside(["a", 1, "b"], ["a", 1])).toBe(true);
    expect(isInside(["a", 1], ["a", 1])).toBe(false);
    expect(isInside(["a", 2], ["a", 1])).toBe(false);
  });
});

describe("childListsOf", () => {
  const at = (document: any, id: string) => {
    const pointer = findPointerById(document, id)!;
    return { pointer, widget: getAt(document, pointer) as any };
  };

  it("finds a carousel's items, a card's children and a container's children", () => {
    const home = loadFixture("valid/page-home.json");
    const { pointer, widget: carousel } = at(home, "w_carousel_1");
    const lists = childListsOf(carousel, pointer);
    expect(lists).toHaveLength(1);
    expect(lists[0].label).toBe("Items");
    expect(lists[0].widgets).toHaveLength(2);
    expect(getAt(home, lists[0].pointer)).toBe(lists[0].widgets.length ? getAt(home, lists[0].pointer) : null);

    const card = at(home, "w_card_2");
    expect(childListsOf(card.widget, card.pointer)[0].label).toBe("Inside");
  });

  it("gives every tab its own list, named after the tab", () => {
    const home = loadFixture("valid/page-home.json");
    const { pointer, widget: tabs } = at(home, "w_tabs_1");
    const lists = childListsOf(tabs, pointer);
    expect(lists.map((list) => list.label)).toEqual(['Tab "Upcoming"', 'Tab "Past"']);
    expect(ids(lists[1].widgets)).toEqual(["w_tabs_1_b"]);
  });

  it("finds the contents of accordion sections and the template of a data_list", () => {
    const showcase = loadFixture("valid/page-showcase.json");
    const accordion = at(showcase, "s_accordion");
    expect(childListsOf(accordion.widget, accordion.pointer).map((list) => list.label)).toEqual(['Item "Returns"', 'Item "Shipping"']);
    const home = loadFixture("valid/page-home.json");
    const dataList = at(home, "w_doctors_1");
    expect(childListsOf(dataList.widget, dataList.pointer)[0].label).toBe("Template for each row");
  });

  it("has nothing for a widget that holds no widgets", () => {
    const home = loadFixture("valid/page-home.json");
    const banner = at(home, "w_banner_1");
    expect(childListsOf(banner.widget, banner.pointer)).toEqual([]);
  });
});

describe("findPointerById", () => {
  it("finds widgets at any depth, but not sections or tabs that share the id space", () => {
    const home = loadFixture("valid/page-home.json");
    expect(findPointerById(home, "w_banner_1")).toEqual(["sections", 0, "widgets", 0]);
    expect(findPointerById(home, "w_card_2_text")!.slice(0, 4)).toEqual(["sections", 1, "widgets", 1]); // inside a card in a carousel
    expect(findPointerById(home, "w_doctor_row")).toBeDefined(); // the template of a data_list
    expect(findPointerById(home, "hero")).toBeUndefined(); // that is a section, not a widget
    expect(findPointerById(home, "upcoming")).toBeUndefined(); // that is a tab
    expect(findPointerById(home, "nope")).toBeUndefined();
  });
});

describe("duplicateAt", () => {
  it("copies a widget deep inside another one, with fresh ids, right after the original", () => {
    const copy = duplicateAt(doc(), ["sections", 0, "widgets", 1, "data", "items", 0]);
    expect(ids(getAt(copy, ["sections", 0, "widgets", 1, "data", "items"]) as any[])).toEqual(["c1", "c1_copy", "c2", "c3"]);
  });

  it("keeps a real page valid after duplicating a nested widget", () => {
    const home = loadFixture("valid/page-home.json");
    const pointer = findPointerById(home, "w_card_2_text")!;
    expect(validate(duplicateAt(home, pointer)).errors).toEqual([]);
  });
});

describe("editing the whole catalogue at depth keeps pages valid", () => {
  it("adds a fresh widget inside a container, then moves it to another container", () => {
    let page: any = loadFixture("valid/page-showcase.json");
    const container = findPointerById(page, "s_container")!;
    const accordionList = [...findPointerById(page, "s_accordion")!, "data", "items", 0, "widgets"];
    page = insertAt(page, [...container, "data", "children"], 0, sampleWidget("rating", 1, "w_rating_new")!);
    expect(validate(page).errors).toEqual([]);
    page = moveAt(page, findPointerById(page, "w_rating_new")!, accordionList, 0);
    expect(validate(page).errors).toEqual([]);
    expect(ids(getAt(page, accordionList) as any[])[0]).toBe("w_rating_new");
  });
});

describe("parentWidgetPointer", () => {
  it("finds the widget that holds another, however deep, and nothing for a widget straight on a section", () => {
    const home = loadFixture("valid/page-home.json");
    const inner = findPointerById(home, "w_card_2_text")!;
    const parent = parentWidgetPointer(home, inner)!;
    expect((getAt(home, parent) as any).id).toBe("w_card_2");
    expect(parentWidgetPointer(home, parent)).toEqual(findPointerById(home, "w_carousel_1"));
    expect(parentWidgetPointer(home, findPointerById(home, "w_banner_1")!)).toBeUndefined();
  });
});
