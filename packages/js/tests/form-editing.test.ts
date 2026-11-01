// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { sampleWidget, validate, widgetDataSchema } from "../src/index";
import { SduiActionEditor, SduiForm, SduiStyleEditor } from "../src/vue/index";

// Mounts a control the way a real page does: every change is handed straight back in as the new value.
function mountLive(component: any, props: Record<string, unknown>) {
  const wrapper: any = mount(component, {
    props: { ...props, "onUpdate:modelValue": (value: unknown) => wrapper.setProps({ modelValue: value }) },
  });
  return wrapper;
}
const lastUpdate = (wrapper: any) => wrapper.emitted("update:modelValue")!.at(-1)![0];
const pageWith = (widget: unknown) => ({ schema: 1, id: "p", revision: "1", sections: [{ id: "s", widgets: [widget] }] });

describe("SduiForm: lists, groups and actions", () => {
  const schema = widgetDataSchema("quick_actions", 1)!;
  const data = { items: [{ label: "Book", icon: "calendar" }, { label: "Call", icon: "phone" }] };

  it("shows every entry of a list with its own fields", () => {
    const wrapper = mount(SduiForm, { props: { schema, modelValue: data } });
    expect((wrapper.find('[data-field="items.0.label"]').element as HTMLInputElement).value).toBe("Book");
    expect((wrapper.find('[data-field="items.1.label"]').element as HTMLInputElement).value).toBe("Call");
  });

  it("edits one entry deep inside the list and leaves the others alone", async () => {
    const wrapper = mount(SduiForm, { props: { schema, modelValue: data } });
    await wrapper.find('[data-field="items.1.label"]').setValue("Phone us");
    expect(lastUpdate(wrapper).items).toEqual([{ label: "Book", icon: "calendar" }, { label: "Phone us", icon: "phone" }]);
  });

  it("adds an entry, removes one and moves one", async () => {
    const wrapper = mount(SduiForm, { props: { schema, modelValue: data } });
    await wrapper.find('[data-add="items"]').trigger("click");
    expect(lastUpdate(wrapper).items).toHaveLength(3);
    await wrapper.find('[data-item="items.0"] button[title="Remove"]').trigger("click");
    expect(lastUpdate(wrapper).items.map((each: any) => each.label)).toEqual(["Call"]);
    await wrapper.find('[data-item="items.1"] button[title="Move up"]').trigger("click");
    expect(lastUpdate(wrapper).items.map((each: any) => each.label)).toEqual(["Call", "Book"]);
  });

  it("does not let the last required entry be removed", () => {
    const wrapper = mount(SduiForm, { props: { schema, modelValue: { items: [{ label: "Only", icon: "home" }] } } });
    // quick_actions needs at least one item, so the only entry cannot be taken out
    expect(wrapper.find('[data-item="items.0"] button[title="Remove"]').attributes("disabled")).toBeDefined();
  });

  it("builds a new tab that already has its own id and an empty widget list", async () => {
    const tabs = mount(SduiForm, { props: { schema: widgetDataSchema("tabs", 1)!, modelValue: { tabs: [{ id: "a", label: "A", widgets: [] }] } } });
    await tabs.find('[data-add="tabs"]').trigger("click");
    const added = lastUpdate(tabs).tabs[1];
    expect(added.id).toMatch(/^item_/);
    expect(added.widgets).toEqual([]);
  });

  it("edits the tap action of an entry", async () => {
    const wrapper = mountLive(SduiForm, { schema, modelValue: data });
    const second = wrapper.find('[data-item="items.1"]');
    await second.find('select[data-action="type"]').setValue("open_url");
    expect(lastUpdate(wrapper).items[1].action).toEqual({ type: "open_url", url: "" });
    await second.find('input[data-action="url"]').setValue("https://example.com");
    expect(lastUpdate(wrapper).items[1].action).toEqual({ type: "open_url", url: "https://example.com" });
  });

  it("edits a group inside the widget (the live-data source name)", async () => {
    const wrapper = mount(SduiForm, { props: { schema: widgetDataSchema("data_list", 1)!, modelValue: { source: { name: "a" }, template: [] } } });
    await wrapper.find('[data-field="source.name"]').setValue("doctors_nearby");
    expect(lastUpdate(wrapper).source).toEqual({ name: "doctors_nearby" });
  });

  it("opens every kind of widget's sample, and adding a list entry never makes data the checker cannot read", async () => {
    for (const type of ["table", "key_value", "chips", "steps", "pricing_card", "gallery", "accordion", "form", "list", "rich_text"]) {
      const widget: any = sampleWidget(type, 1, `w_${type}`)!;
      const wrapper = mount(SduiForm, { props: { schema: widgetDataSchema(type, 1)!, modelValue: widget.data } });
      expect(wrapper.find(".sdui-form").exists(), type).toBe(true);
      const addButton = wrapper.find("[data-add]");
      if (addButton.exists()) {
        await addButton.trigger("click");
        expect(Array.isArray(validate(pageWith({ ...widget, data: lastUpdate(wrapper) })).errors), type).toBe(true);
      }
    }
  });
});

describe("SduiActionEditor", () => {
  it("starts an action of the chosen kind and clears it again", async () => {
    const wrapper = mount(SduiActionEditor, { props: { modelValue: undefined } });
    await wrapper.find('select[data-action="type"]').setValue("open_screen");
    expect(lastUpdate(wrapper)).toEqual({ type: "open_screen", screenId: "" });
    await wrapper.find('select[data-action="type"]').setValue("");
    expect(lastUpdate(wrapper)).toBeUndefined();
  });

  it("keeps extra values as an object and reports bad JSON in words", async () => {
    const wrapper = mount(SduiActionEditor, { props: { modelValue: { type: "call_api", name: "start" } } });
    const box = wrapper.find("textarea");
    await box.setValue('{ "source": "home" }');
    expect(lastUpdate(wrapper)).toEqual({ type: "call_api", name: "start", params: { source: "home" } });
    await box.setValue("[1,2]");
    expect(wrapper.text()).toContain("must be an object");
    await box.setValue("{ nope");
    expect(wrapper.find(".sdui-error").exists()).toBe(true);
  });
});

describe("SduiStyleEditor", () => {
  it("takes a number or a name for space, and removes it when emptied", async () => {
    const wrapper = mountLive(SduiStyleEditor, { modelValue: { color: "primary" } });
    await wrapper.find('[data-field="spacing"]').setValue("13");
    expect(lastUpdate(wrapper)).toEqual({ color: "primary", spacing: 13 });
    await wrapper.find('[data-field="spacing"]').setValue("lg");
    expect(lastUpdate(wrapper).spacing).toBe("lg");
    await wrapper.find('[data-field="spacing"]').setValue("");
    expect(lastUpdate(wrapper)).toEqual({ color: "primary" });
  });

  it("ignores values that are not allowed and marks the box", async () => {
    const wrapper = mountLive(SduiStyleEditor, { modelValue: {} });
    await wrapper.find('[data-field="spacing"]').setValue("12px");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    expect(wrapper.find('[data-field="spacing"]').classes()).toContain("sdui-bad");
    await wrapper.find('[data-field="spacing"]').setValue("9999");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("sets one side of the padding without touching the others", async () => {
    const wrapper = mountLive(SduiStyleEditor, { modelValue: { padding: { top: 4 } } });
    await wrapper.find('[data-field="padding-left"]').setValue("20");
    expect(lastUpdate(wrapper).padding).toEqual({ top: 4, left: 20 });
    await wrapper.find('[data-field="padding-top"]').setValue("");
    expect(lastUpdate(wrapper).padding).toEqual({ left: 20 });
  });

  it("takes any colour code or a theme colour name, but not nonsense", async () => {
    const wrapper = mountLive(SduiStyleEditor, { modelValue: {} });
    await wrapper.find('[data-field="color"]').setValue("#ff8800");
    expect(lastUpdate(wrapper).color).toBe("#ff8800");
    await wrapper.find('[data-field="textColor"]').setValue("onPrimary");
    expect(lastUpdate(wrapper).textColor).toBe("onPrimary");
    const count = wrapper.emitted("update:modelValue")!.length;
    await wrapper.find('[data-field="borderColor"]').setValue("orange");
    expect(wrapper.emitted("update:modelValue")!.length).toBe(count);
  });

  it("sets weight, italic, shadow, opacity and a fixed size, and what it makes is valid style", async () => {
    const wrapper = mountLive(SduiStyleEditor, { modelValue: {} });
    await wrapper.find('[data-style="fontWeight"]').setValue("bold");
    await wrapper.find('[data-style="italic"]').setValue(true);
    await wrapper.find('[data-style="shadow"]').setValue("medium");
    await wrapper.find('[data-style="opacity"]').setValue("0.5");
    await wrapper.find('[data-field="width"]').setValue("fill");
    await wrapper.find('[data-field="height"]').setValue("120");
    const style = lastUpdate(wrapper);
    expect(style).toMatchObject({ fontWeight: "bold", italic: true, shadow: "medium", opacity: 0.5, width: "fill", height: 120 });
    const widget: any = { ...sampleWidget("text", 1, "w_t")!, style };
    expect(validate(pageWith(widget)).errors).toEqual([]);
  });
});
