// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { SduiPreview } from "../src/vue/index";
import { findTextPath } from "../src/vue/canvasEditing";
import { page, widget } from "./helpers";

const text = (id: string, value: string) => widget("text", { text: value }, { id });
const doc = () => page(text("a", "First"), widget("banner", { imageUrl: "https://example.com/a.jpg", title: "Big sale", subtitle: "Today" }, { id: "b" }), text("c", "Third"));
const open = (extra: Record<string, unknown> = {}) =>
  mount(SduiPreview, { attachTo: document.body, props: { document: doc(), editable: true, ...extra } });

describe("the preview as a design canvas", () => {
  it("selects the widget that was clicked, and nothing when empty space is clicked", async () => {
    const wrapper = open();
    await wrapper.find('[data-id="b"]').trigger("click");
    expect(wrapper.emitted("select")!.at(-1)).toEqual(["b"]);
    await wrapper.find(".sp-content").trigger("click");
    expect(wrapper.emitted("select")!.at(-1)).toEqual([null]);
    wrapper.unmount();
  });

  it("does nothing when it is not editable", async () => {
    const wrapper = mount(SduiPreview, { props: { document: doc() } });
    await wrapper.find('[data-id="b"]').trigger("click");
    expect(wrapper.emitted("select")).toBeUndefined();
    expect(wrapper.find(".sp-edit").exists()).toBe(false);
  });

  it("marks the selected widget and makes every widget draggable", async () => {
    const wrapper = open({ selectedId: "c" });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-id="c"]').classes()).toContain("sp-selected");
    expect(wrapper.find('[data-id="a"]').classes()).not.toContain("sp-selected");
    expect(wrapper.find('[data-id="a"]').attributes("draggable")).toBe("true");
    await wrapper.setProps({ selectedId: "a" });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-id="a"]').classes()).toContain("sp-selected");
    expect(wrapper.find('[data-id="c"]').classes()).not.toContain("sp-selected");
    wrapper.unmount();
  });

  it("lets staff retype text in place: double-click, type, Enter", async () => {
    const wrapper = open();
    const element = wrapper.find('[data-id="a"]');
    await element.trigger("dblclick");
    expect(element.attributes("contenteditable")).toBeDefined();
    element.element.textContent = "First, changed";
    await element.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("edit")!.at(-1)).toEqual([{ id: "a", path: ["data", "text"], value: "First, changed" }]);
    expect(element.attributes("contenteditable")).toBeUndefined();
    wrapper.unmount();
  });

  it("finds a banner's title and subtitle separately", async () => {
    const wrapper = open();
    const title = wrapper.findAll('[data-id="b"] *').find((el) => el.text() === "Big sale")!;
    await title.trigger("dblclick");
    title.element.textContent = "Huge sale";
    await title.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("edit")!.at(-1)).toEqual([{ id: "b", path: ["data", "title"], value: "Huge sale" }]);
    wrapper.unmount();
  });

  it("puts the old text back when Escape is pressed", async () => {
    const wrapper = open();
    const element = wrapper.find('[data-id="a"]');
    await element.trigger("dblclick");
    element.element.textContent = "Oops";
    await element.trigger("keydown", { key: "Escape" });
    expect(wrapper.emitted("edit")).toBeUndefined();
    expect(element.text()).toBe("First");
    wrapper.unmount();
  });

  it("does not offer to retype text the app works out itself", async () => {
    const wrapper = mount(SduiPreview, { attachTo: document.body, props: { document: page(widget("rating", { value: 4, max: 5 }, { id: "r" })), editable: true } });
    await wrapper.find('[data-id="r"]').trigger("dblclick");
    expect(wrapper.find('[data-id="r"]').attributes("contenteditable")).toBeUndefined();
    wrapper.unmount();
  });

  it("reports a drag from one widget to before or after another", async () => {
    const wrapper = open();
    const root = wrapper.find(".sp-root").element;
    const fire = (el: Element, type: string, init: object = {}) => el.dispatchEvent(Object.assign(new Event(type, { bubbles: true, cancelable: true }), init));
    fire(wrapper.find('[data-id="c"]').element, "dragstart");
    fire(wrapper.find('[data-id="a"]').element, "dragover", { clientY: 0 });
    expect(wrapper.find('[data-id="a"]').classes().some((name) => name.startsWith("sp-drop-"))).toBe(true);
    fire(root, "drop");
    const [change] = wrapper.emitted("move")!.at(-1)! as any[];
    expect(change).toMatchObject({ id: "c", targetId: "a" });
    expect(["before", "after"]).toContain(change.where);
    expect(wrapper.find(".sp-drop-before, .sp-drop-after").exists()).toBe(false);
    wrapper.unmount();
  });

  it("does not accept a drop onto the widget itself", () => {
    const wrapper = open();
    const fire = (el: Element, type: string) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
    fire(wrapper.find('[data-id="a"]').element, "dragstart");
    fire(wrapper.find('[data-id="a"]').element, "dragover");
    fire(wrapper.find(".sp-root").element, "drop");
    expect(wrapper.emitted("move")).toBeUndefined();
    wrapper.unmount();
  });
});

describe("findTextPath", () => {
  it("finds text at any depth, and skips ids, types and actions", () => {
    const card = widget("list", { items: [{ title: "One", action: { type: "open_url", url: "One" } }, { title: "Two" }] });
    expect(findTextPath(card, "Two")).toEqual(["data", "items", 1, "title"]);
    expect(findTextPath(card, "One")).toEqual(["data", "items", 0, "title"]);
    expect(findTextPath(card, "nothing")).toBeUndefined();
    expect(findTextPath(card, "  ")).toBeUndefined();
  });
});
