// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { widgetDataSchema } from "../src/index";
import { SduiForm, SduiPreview, defaultTheme, styleCss } from "../src/vue/index";
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
  // The text of the page itself (the preview also carries its own stylesheet, which is not page text).
  const textOf = (wrapper: { find: (selector: string) => { text: () => string } }) => wrapper.find(".sp-content").text();

  const home = () => loadFixture("valid/page-home.json");
  const showcase = () => loadFixture("valid/page-showcase.json");
  const doctors = [
    { id: 7, name: "Dr Rao", specialty: "Dentist", fee: 150, photoUrl: "https://example.com/rao.jpg" },
    { id: 8, name: "Dr Khan", specialty: "Cardiologist", fee: 300 },
  ];

  it("draws the sample page: text, nested widgets and the first tab", () => {
    const text = textOf(mount(SduiPreview, { props: { document: home() } }));
    expect(text).toContain("Welcome"); // banner title
    expect(text).toContain("Popular services"); // section header
    expect(text).toContain("Teeth cleaning"); // card inside the carousel
    expect(text).toContain("A full check in one visit"); // widget inside a card
    expect(text).toContain("Book a visit"); // button
    expect(text).toContain("No upcoming visits"); // first tab
    expect(text).not.toContain("No past visits");
  });

  it("switches tab when clicked", async () => {
    const wrapper = mount(SduiPreview, { props: { document: home() } });
    await wrapper.find('[data-tab="past"]').trigger("click");
    expect(textOf(wrapper)).toContain("No past visits");
    expect(textOf(wrapper)).not.toContain("No upcoming visits");
  });

  it("draws every widget of the showcase page properly (none is left as a grey 'not drawn' box)", () => {
    const wrapper = mount(SduiPreview, { props: { document: showcase() } });
    expect(wrapper.findAll(".sdui-unknown")).toHaveLength(0);
    const text = textOf(wrapper);
    for (const expected of [
      "Spring sale", "Shop now", "Search products", "Orders", "Wishlist", "Latest", "Heads up", "60% complete",
      "Orders this month", "+12%", "Order number", "A-1042", "Notifications", "Setup took five minutes.",
      "Order placed", "We are packing it now", "No messages yet", "How it works", "Sale ends in", "10 seats",
      "Choose Team", "Returns", "Your name *", "Send",
    ]) {
      expect(text, expected).toContain(expected);
    }
    expect(text).toContain("4.6 (212) Customer rating");
  });

  it("gives page content a side margin, but lets pictures and banners run edge to edge", () => {
    const wrapper = mount(SduiPreview, { props: { document: showcase() } });
    const wrapperOf = (type: string) => wrapper.find(`[data-widget="${type}"]`).element.parentElement as HTMLElement;
    for (const type of ["search_bar", "chips", "rich_text", "form"]) expect(wrapperOf(type).className, type).toBe("sp-item");
    for (const type of ["hero", "gallery", "video_card"]) expect(wrapperOf(type).className, type).toBe("sp-bleed");
    // Inside another widget there is no extra margin (the container draws its own children as they are).
    const inner = wrapper.find('[data-id="s_cont_a"]').element.parentElement as HTMLElement;
    expect(inner.className).not.toContain("sp-item");
  });

  it("opens and closes the accordion, one section at a time", async () => {
    const wrapper = mount(SduiPreview, { props: { document: showcase() } });
    expect(textOf(wrapper)).not.toContain("Return anything within 30 days.");
    await wrapper.find('[data-accordion="Returns"]').trigger("click");
    expect(textOf(wrapper)).toContain("Return anything within 30 days.");
    await wrapper.find('[data-accordion="Shipping"]').trigger("click");
    expect(textOf(wrapper)).toContain("Standard shipping takes 3 to 5 days.");
    expect(textOf(wrapper)).not.toContain("Return anything within 30 days.");
  });

  describe("live data", () => {
    it("shows grey boxes and says where the rows come from when it has no example rows", () => {
      const wrapper = mount(SduiPreview, { props: { document: home() } });
      expect(textOf(wrapper)).toContain('Live list from "doctors_nearby"');
      expect(wrapper.findAll(".sp-skel")).toHaveLength(3);
    });

    it("draws the template once per example row, with the row's values filled in", () => {
      const wrapper = mount(SduiPreview, { props: { document: home(), dataSamples: { doctors_nearby: doctors } } });
      const text = textOf(wrapper);
      expect(text).toContain("Dr Rao");
      expect(text).toContain("Dentist · 150 AED");
      expect(text).toContain("Dr Khan");
      expect(text).toContain("Cardiologist · 300 AED");
      expect(text).not.toContain("{{");
    });

    it("leaves out a picture the row does not have instead of inventing one", () => {
      const wrapper = mount(SduiPreview, { props: { document: home(), dataSamples: { doctors_nearby: doctors } } });
      const cards = wrapper.findAll('[data-id="w_doctor_row"]');
      expect(cards).toHaveLength(2);
      expect(cards[0].find("img").exists()).toBe(true); // Dr Rao has a photo
      expect(cards[1].find("img").exists()).toBe(false); // Dr Khan has none
    });

    it("shows the empty text when there are no rows", () => {
      const wrapper = mount(SduiPreview, { props: { document: home(), dataSamples: { doctors_nearby: [] } } });
      expect(textOf(wrapper)).toContain("No doctors found nearby");
    });
  });

  describe("the app's look", () => {
    it("uses the theme for spacing, text size and colours", () => {
      const document = {
        sections: [{ id: "s", widgets: [{ id: "a", type: "text", v: 1, data: { text: "Hi" }, style: { spacing: "lg", textSize: "headline", color: "surface" } }] }],
      };
      const style = (mount(SduiPreview, { props: { document } }).find('[data-widget="text"]').element as HTMLElement).style;
      expect(style.padding).toBe("24px");
      expect(style.fontSize).toBe("24px");
      expect(style.background).toBe("rgb(243, 244, 246)"); // the "surface" colour of the default theme (#F3F4F6)
    });

    it("uses the colours of the theme it is given", () => {
      const theme = loadFixture("valid/manifest.json").theme;
      theme.light.primary = "#123456";
      const wrapper = mount(SduiPreview, { props: { document: home(), theme } });
      expect((wrapper.find(".sp-root").element as HTMLElement).style.getPropertyValue("--sp-primary")).toBe("#123456");
    });

    it("switches to the dark colours of the theme in dark mode", () => {
      const theme = loadFixture("valid/manifest.json").theme;
      const background = (dark: boolean) =>
        (mount(SduiPreview, { props: { document: home(), theme, dark } }).find(".sp-root").element as HTMLElement).style.getPropertyValue("--sp-bg");
      expect(background(false)).toBe("#FFFFFF");
      expect(background(true)).toBe("#0B0F14");
      expect(mount(SduiPreview, { props: { document: home(), theme, dark: true } }).find(".sp-root").attributes("data-dark")).toBe("true");
    });

    it("shows a grey box when a picture cannot load, like the app", async () => {
      const document = { sections: [{ id: "s", widgets: [{ id: "i", type: "image", v: 1, data: { url: "https://example.com/missing.jpg" } }] }] };
      const wrapper = mount(SduiPreview, { props: { document } });
      expect(wrapper.find("img").exists()).toBe(true);
      await wrapper.find("img").trigger("error");
      expect(wrapper.find("img").exists()).toBe(false);
      expect(wrapper.find(".sp-ph").exists()).toBe(true);
    });
  });

  it("draws a screen made of blocks", () => {
    const wrapper = mount(SduiPreview, { props: { document: loadFixture("valid/screen-offers.json") } });
    expect(textOf(wrapper)).toContain("This month's offers");
    expect(textOf(wrapper)).toContain("Book now");
    expect(textOf(wrapper)).toContain("Winter check-ups"); // banner widget embedded in a block
    expect(wrapper.find('[data-block="grid"]').exists()).toBe(true);
  });

  it("marks a widget it does not know instead of crashing", () => {
    const document = { sections: [{ id: "s", widgets: [{ id: "d", type: "doctor_card", v: 1, data: { name: "Dr Rao" } }] }] };
    expect(mount(SduiPreview, { props: { document } }).find(".sdui-unknown").text()).toBe("doctor_card (v1): Dr Rao");
  });

  it("says so when there is nothing to show", () => {
    expect(textOf(mount(SduiPreview, { props: { document: {} } }))).toBe("Nothing to show.");
  });
});

describe("styleCss (what a widget's style looks like in the preview)", () => {
  const css = (style: any, dark = false) => styleCss(style, defaultTheme, dark);

  it("turns exact values into exactly those values", () => {
    expect(css({ color: "#FF8800", spacing: 13, radius: 7, textSize: 17, width: 240, height: 90 })).toMatchObject({
      background: "#FF8800",
      padding: "13px",
      borderRadius: "7px",
      fontSize: "17px",
      width: "240px",
      height: "90px",
    });
  });

  it("still follows the theme (and dark mode) for preset names", () => {
    expect(css({ color: "primary" }).background).toBe(defaultTheme.light.primary);
    expect(css({ color: "primary" }, true).background).toBe(defaultTheme.dark.primary);
    expect(css({ spacing: "lg" }).padding).toBe(`${defaultTheme.spacing.lg}px`);
  });

  it("lets one side differ from the rest", () => {
    expect(css({ spacing: 8, padding: { top: 20 } }).padding).toBe("20px 8px 8px 8px");
    expect(css({ margin: { left: 5, bottom: 9 } }).margin).toBe("0px 0px 9px 5px");
  });

  it("draws borders, shadows, weight, italic and opacity", () => {
    expect(css({ borderWidth: 3, borderColor: "#112233", shadow: "large", fontWeight: "bold", italic: true, opacity: 0.4 })).toMatchObject({
      border: "3px solid #112233",
      fontWeight: "700",
      fontStyle: "italic",
      opacity: "0.4",
    });
    expect(css({ shadow: "large" }).boxShadow).toContain("rgba");
    expect(css({ width: "fill" }).width).toBe("100%");
  });

  it("gives nothing when there is no style", () => expect(css(undefined)).toEqual({}));
});
