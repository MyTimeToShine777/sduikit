// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { listWidgets, validate } from "../src/index";
import { SduiPreview, SduiStyleEditor, styleCss, defaultTheme } from "../src/vue/index";
import { compileSchema, loadFixture, page, widget } from "./helpers";

const style = compileSchema("common/style.json");
const lastUpdate = (wrapper: any) => wrapper.emitted("update:modelValue")!.at(-1)![0];
const rows = { doctors_nearby: [{ name: "Dr Rao", specialty: "Heart", fee: 150, photo: "https://picsum.photos/seed/dr/100/100" }] };
const draw = (document: unknown) => mount(SduiPreview, { props: { document: document as any, dataSamples: rows } });
const fixtures = ["valid/page-home.json", "valid/page-showcase.json", "valid/page-blocks.json"].map((file) => loadFixture(file));

describe("parts: a look for each named piece of a widget", () => {
  it("is allowed in the style, with the same options as the widget's own look, and nothing else", () => {
    expect(style({ parts: { title: { textSize: 22, textColor: "#FF0000", maxLines: 2, textDecoration: "underline" }, image: { radius: 12 } } })).toBe(true);
    expect(style({ parts: { Title: { textSize: 22 } } })).toBe(false); // part names start with a small letter
    expect(style({ parts: { title: { nonsense: 1 } } })).toBe(false);
    expect(style({ parts: { title: { parts: { x: {} } } } })).toBe(false); // parts do not nest
    expect(style({ parts: { title: { textSize: 2 } } })).toBe(false); // the same limits as everywhere
  });

  it("every widget with parts lists them, and the list is what the editor offers", () => {
    const withParts = listWidgets().filter((entry) => entry.parts.length);
    expect(withParts.length).toBeGreaterThanOrEqual(30);
    expect(listWidgets().find((entry) => entry.type === "card")!.parts).toEqual(["image", "title", "subtitle", "body"]);
  });

  it("draws only the parts a widget lists, and every listed part can be found in some page", async () => {
    const listed = new Map(listWidgets().map((entry) => [entry.type, new Set(entry.parts)]));
    const seen = new Map<string, Set<string>>();
    for (const document of fixtures) {
      const wrapper = draw(document);
      // Closed accordions draw no content, so open them all first.
      for (const header of wrapper.findAll("[data-accordion]")) await header.trigger("click");
      for (const element of wrapper.element.querySelectorAll("[data-widget]")) {
        const type = element.getAttribute("data-widget")!;
        const found = seen.get(type) ?? new Set<string>();
        // Parts of nested widgets belong to those widgets, so only look at the ones whose closest widget is this one.
        for (const inner of element.querySelectorAll("[data-part]")) {
          if (inner.closest("[data-widget]") === element) found.add(inner.getAttribute("data-part")!);
        }
        seen.set(type, found);
      }
    }
    for (const [type, found] of seen) {
      for (const name of found) expect(listed.get(type)?.has(name), `${type} draws an unlisted part "${name}"`).toBe(true);
    }
    const missing: string[] = [];
    for (const [type, names] of listed) for (const name of names) if (seen.has(type) && !seen.get(type)!.has(name)) missing.push(`${type}.${name}`);
    expect(missing, "parts that no sample page draws (add one to a fixture)").toEqual([]);
  });

  it("styles one part and leaves the rest of the widget alone", () => {
    const card = widget("card", { title: "Hello", subtitle: "World", children: [] }, { id: "c", style: { parts: { title: { textSize: 30, textColor: "#FF0000", textDecoration: "underline" } } } });
    const wrapper = draw(page(card));
    const title = wrapper.find('[data-id="c"] [data-part="title"]').element as HTMLElement;
    expect(title.style.fontSize).toBe("30px");
    expect(title.style.color).toBe("rgb(255, 0, 0)");
    expect(title.style.textDecorationLine).toBe("underline");
    expect((wrapper.find('[data-id="c"] [data-part="subtitle"]').element as HTMLElement).style.fontSize).toBe("");
  });

  it("lets the widget's own style win over the preview's built-in look (a coloured badge, alert, avatar)", () => {
    const wrapper = draw(page(widget("badge", { label: "New" }, { id: "b", style: { color: "#112233", textColor: "#FFFFFF" } })));
    const badge = wrapper.find('[data-id="b"]').element as HTMLElement;
    expect(badge.style.background).toContain("rgb(17, 34, 51)");
    expect(badge.style.color).toBe("rgb(255, 255, 255)");
  });

  it("is a valid page with parts, and the checker names a bad one in words", () => {
    const good = page(widget("card", { title: "T" }, { style: { parts: { title: { textSize: 20 } } } }));
    expect(validate(good).errors).toEqual([]);
    const bad = page(widget("card", { title: "T" }, { style: { parts: { title: { textSize: 2 } } } }));
    expect(validate(bad).errors.length).toBeGreaterThan(0);
  });
});

describe("the style editor for parts", () => {
  function mountLive(props: Record<string, unknown>) {
    const wrapper: any = mount(SduiStyleEditor, { props: { ...props, "onUpdate:modelValue": (value: unknown) => wrapper.setProps({ modelValue: value }) } });
    return wrapper;
  }

  it("has no picker for a widget without parts", () => {
    expect(mountLive({ modelValue: {}, parts: [] }).find("[data-style-part]").exists()).toBe(false);
  });

  it("edits the whole widget, or one part, without mixing them up", async () => {
    const wrapper = mountLive({ modelValue: {}, parts: ["title", "image"] });
    await wrapper.find('[data-field="color"]').setValue("#112233");
    expect(lastUpdate(wrapper)).toEqual({ color: "#112233" });

    await wrapper.find("[data-style-part]").setValue("title");
    expect((wrapper.find('[data-field="color"]').element as HTMLInputElement).value).toBe(""); // the part starts empty
    await wrapper.find('[data-field="textSize"]').setValue("22");
    expect(lastUpdate(wrapper)).toEqual({ color: "#112233", parts: { title: { textSize: 22 } } });

    await wrapper.find("[data-style-part]").setValue("");
    expect((wrapper.find('[data-field="color"]').element as HTMLInputElement).value).toBe("#112233");
    await wrapper.find('[data-field="color"]').setValue("");
    expect(lastUpdate(wrapper)).toEqual({ parts: { title: { textSize: 22 } } }); // the part is kept
  });

  it("removes a part's look when its last option is cleared", async () => {
    const wrapper = mountLive({ modelValue: { parts: { title: { textSize: 22 } } }, parts: ["title"] });
    await wrapper.find("[data-style-part]").setValue("title");
    await wrapper.find('[data-field="textSize"]').setValue("");
    expect(lastUpdate(wrapper)).toEqual({});
  });

  it("marks the parts that already have a look", () => {
    const wrapper = mountLive({ modelValue: { parts: { title: { textSize: 22 } } }, parts: ["title", "image"] });
    const options = wrapper.findAll("[data-style-part] option").map((option: any) => option.text());
    expect(options).toEqual(["The whole widget", "title ●", "image"]);
  });
});

void styleCss; void defaultTheme;
