// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { widgetDataSchema } from "../src/index";
import { SduiForm, SduiPreview } from "../src/vue/index";
import { loadFixture } from "./helpers";

describe("SduiForm", () => {
  const bannerSchema = widgetDataSchema("banner", 1)!;
  const lastUpdate = (wrapper: any) => wrapper.emitted("update:modelValue")!.at(-1)![0];

  it("shows a labelled field for each property, with * on required ones", () => {
    const wrapper = mount(SduiForm, { props: { schema: bannerSchema, modelValue: {} } });
    expect(wrapper.find('[data-row="imageUrl"]').text()).toContain("Image url *");
    expect(wrapper.find('[data-row="title"]').text()).toBe("Title");
  });

  it("shows the current values", () => {
    const wrapper = mount(SduiForm, { props: { schema: bannerSchema, modelValue: { title: "Hi" } } });
    expect((wrapper.find('[data-field="title"]').element as HTMLInputElement).value).toBe("Hi");
  });

  it("hands back the changed data when someone types", async () => {
    const wrapper = mount(SduiForm, { props: { schema: bannerSchema, modelValue: { title: "Hi" } } });
    await wrapper.find('[data-field="imageUrl"]').setValue("https://example.com/a.jpg");
    expect(lastUpdate(wrapper)).toEqual({ title: "Hi", imageUrl: "https://example.com/a.jpg" });
  });

  it("leaves a field out when it is cleared", async () => {
    const wrapper = mount(SduiForm, { props: { schema: bannerSchema, modelValue: { title: "Hi" } } });
    await wrapper.find('[data-field="title"]').setValue("");
    expect(lastUpdate(wrapper)).toEqual({});
  });

  it("does not change the data it was given", async () => {
    const data = { title: "Hi" };
    const wrapper = mount(SduiForm, { props: { schema: bannerSchema, modelValue: data } });
    await wrapper.find('[data-field="title"]').setValue("Changed");
    expect(data).toEqual({ title: "Hi" });
  });

  it("sends numbers as numbers, checkboxes as true/false and choices as text", async () => {
    const carousel = mount(SduiForm, { props: { schema: widgetDataSchema("carousel", 1)!, modelValue: {} } });
    await carousel.find('[data-field="viewportFraction"]').setValue("0.8");
    expect(lastUpdate(carousel)).toEqual({ viewportFraction: 0.8 });
    await carousel.find('[data-field="autoplay"]').setValue(true);
    expect(lastUpdate(carousel).autoplay).toBe(true);

    const spacer = mount(SduiForm, { props: { schema: widgetDataSchema("spacer", 1)!, modelValue: {} } });
    await spacer.find('[data-field="size"]').setValue("lg");
    expect(lastUpdate(spacer)).toEqual({ size: "lg" });
    await spacer.find('[data-field="size"]').setValue("");
    expect(lastUpdate(spacer)).toEqual({});
  });

  it("tells staff where to edit nested widgets", () => {
    const wrapper = mount(SduiForm, {
      props: { schema: widgetDataSchema("carousel", 1)!, modelValue: { items: [{}, {}] } },
    });
    expect(wrapper.find('[data-field="items"]').text()).toContain("2 widget(s) inside");
  });
});

describe("SduiPreview", () => {
  it("draws the sample page: text, nested widgets and the first tab", () => {
    const wrapper = mount(SduiPreview, { props: { document: loadFixture("valid/page-home.json") } });
    const text = wrapper.text();
    expect(text).toContain("Welcome"); // banner title
    expect(text).toContain("Popular services"); // section header
    expect(text).toContain("Teeth cleaning"); // card inside the carousel
    expect(text).toContain("A full check in one visit"); // widget inside a card
    expect(text).toContain("Book a visit"); // button
    expect(text).toContain("No upcoming visits"); // first tab
    expect(text).not.toContain("No past visits");
    expect(text).toContain("Live data: doctors_nearby"); // data_list shows its source and template
    expect(text).toContain("{{name}}");
  });

  it("switches tab when clicked", async () => {
    const wrapper = mount(SduiPreview, { props: { document: loadFixture("valid/page-home.json") } });
    await wrapper.find('[data-tab="past"]').trigger("click");
    expect(wrapper.text()).toContain("No past visits");
    expect(wrapper.text()).not.toContain("No upcoming visits");
  });

  it("shows the name and main texts of widgets it does not draw in detail", () => {
    const wrapper = mount(SduiPreview, { props: { document: loadFixture("valid/page-showcase.json") } });
    expect(wrapper.text()).toContain("hero (v1): Spring sale");
    expect(wrapper.text()).toContain("pricing_card (v1): Team");
    expect(wrapper.findAll(".sdui-unknown").length).toBeGreaterThan(20);
  });

  it("uses the theme for spacing and colours", () => {
    const wrapper = mount(SduiPreview, {
      props: {
        document: {
          sections: [{ id: "s", widgets: [{ id: "a", type: "text", v: 1, data: { text: "Hi" }, style: { spacing: "lg", textSize: "headline" } }] }],
        },
      },
    });
    const style = (wrapper.find('[data-widget="text"]').element as HTMLElement).style;
    expect(style.padding).toBe("24px");
    expect(style.fontSize).toBe("24px");
  });

  it("draws a screen made of blocks", () => {
    const wrapper = mount(SduiPreview, { props: { document: loadFixture("valid/screen-offers.json") } });
    expect(wrapper.text()).toContain("This month's offers");
    expect(wrapper.text()).toContain("Book now");
    expect(wrapper.text()).toContain("Winter check-ups"); // banner widget embedded in a block
    expect(wrapper.find('[data-block="grid"]').exists()).toBe(true);
  });

  it("marks a widget it does not know instead of crashing", () => {
    const wrapper = mount(SduiPreview, {
      props: { document: { sections: [{ id: "s", widgets: [{ id: "d", type: "doctor_card", v: 1, data: {} }] }] } },
    });
    expect(wrapper.find(".sdui-unknown").text()).toBe("doctor_card (v1)");
  });

  it("says so when there is nothing to show", () => {
    expect(mount(SduiPreview, { props: { document: {} } }).text()).toBe("Nothing to show.");
  });
});
