// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { schemaFiles } from "../src/generated/schemas";
import { builtInCatalogue } from "../src/registry";
import { validate, widgetDataSchema } from "../src/index";
import { SduiPreview } from "../src/vue/index";
import { page, repoRoot, widget } from "./helpers";

const text = { id: "t1", type: "text", v: 1, data: { text: "Hello" } };
const check = (type: string, data: unknown) => validate(page(widget(type, data, { id: "w" })));
const draw = (type: string, data: unknown) => mount(SduiPreview, { props: { document: page(widget(type, data, { id: "w" })) as any } });
const style = (wrapper: any, selector = '[data-id="w"]') => (wrapper.find(selector).element as HTMLElement).style;

// Every option of every original widget, with a value that is valid. A test below makes sure none is forgotten.
const originals = Object.entries(builtInCatalogue.types).filter(([, entry]) => entry.group !== "Building blocks");

describe("every option of every widget is accepted, and a wrong one is named", () => {
  const good: Record<string, Record<string, unknown>> = {
    text: { text: "Hi", selectable: true, semanticsLabel: "Greeting" },
    image: { url: "https://example.com/a.jpg", fit: "scaleDown", alignment: "topRight", repeat: "repeatX", placeholderColor: "#CCCCCC", showLoader: true, errorText: "No picture", grayscale: true },
    button: { label: "Go", variant: "tonal", icon: "check", iconPosition: "end", size: "large", fullWidth: true, enabled: false, loading: true, tooltip: "Do it" },
    spacer: { size: 13, width: "lg", height: 7 },
    divider: { thickness: 3, indent: 8, endIndent: "md", color: "#FF0000", vertical: true, space: 20 },
    section_header: { title: "T", icon: "star", actionLabel: "All", actionIcon: "link", showDivider: true, titleMaxLines: 2, uppercase: true },
    card: { title: "T", elevation: 8, outlined: true, imageUrl: "https://example.com/a.jpg", imageHeight: 90, imageAspectRatio: 1.5, imageFit: "contain", imagePosition: "bottom" },
    banner: { imageUrl: "https://example.com/a.jpg", height: 200, overlayColor: "#000000", overlayOpacity: 0.3, contentAlignment: "center", imageFit: "fill", ctaLabel: "Go" },
    hero: { imageUrl: "https://example.com/a.jpg", title: "T", height: 320, overlayColor: "primary", overlayOpacity: 0.6, contentAlignment: "topLeft", imageFit: "none" },
    carousel: { items: [text], height: 180, autoplayInterval: 6, showDots: true, spacing: 12, enlargeCenter: true, initialIndex: 1, loop: false, animationDuration: 700 },
    list: { items: [text], spacing: 6, height: 300, reverse: true, dividerIndent: 16, dividerThickness: 2, dividers: true },
    grid: { columns: 2, items: [text], mainAxisSpacing: 4, crossAxisSpacing: "lg", childAspectRatio: 0.8 },
    tabs: { tabs: [{ id: "a", label: "A", icon: "home", widgets: [text] }], initialIndex: 0, variant: "underline", scrollable: true, tabAlignment: "stretch" },
    container: { children: [text], mainAxisAlignment: "spaceBetween", crossAxisAlignment: "center", wrap: true },
    accordion: { items: [{ title: "Q", subtitle: "Sub", icon: "help", widgets: [text] }], initiallyOpen: [0], dividers: false, iconPosition: "start" },
    data_list: { source: { name: "doctors" }, template: [text], spacing: 8, dividers: true, loadingRows: 5, errorText: "Oops", retryLabel: "Again", itemWidth: 0.6, height: 400 },
    rich_text: { spans: [{ text: "Hi", strikethrough: true, background: "#FFFF00", action: { type: "dismiss" }, weight: "bold", letterSpacing: 2, color: "#112233", size: 18 }], selectable: true },
    quote: { text: "Q", showBar: false, barColor: "#FF0000", barWidth: 6, italic: false, avatarSize: 40, showQuoteMark: true },
    icon: { name: "star", size: 64, color: "#FF8800", rotation: 45, flipX: true, background: "#EEEEEE", shape: "circle", padding: 12, tooltip: "Star" },
    avatar: { initials: "AB", size: 100, shape: "rounded", backgroundColor: "#112233", foregroundColor: "#FFFFFF", status: "online", borderColor: "#FF0000", borderWidth: 3 },
    badge: { label: "New", icon: "star", size: "small", variant: "solid", shape: "square", dot: true },
    alert: { message: "M", icon: "bell", showIcon: false, variant: "accent", dismissible: true, actionLabel: "Undo" },
    progress: { indeterminate: true, strokeWidth: 10, size: 90, showPercent: true, rounded: false, shape: "circular" },
    stat: { label: "L", value: "1", icon: "bag", prefix: "$", suffix: "k" },
    key_value: { rows: [{ label: "a", value: "b", icon: "phone" }], dividers: true, layout: "stacked", valueAlign: "start", labelFraction: 0.4 },
    list_item: { title: "T", dense: true, selected: true, trailingIcon: "link", imageSize: 64, imageShape: "circle", titleMaxLines: 1, subtitleMaxLines: 2, badge: "3" },
    empty_state: { title: "T", imageUrl: "https://example.com/a.png", iconSize: 80, compact: true },
    steps: { steps: [{ title: "One", icon: "check" }], direction: "horizontal", showConnector: true, numbered: true },
    table: { columns: ["A"], rows: [["1"]], striped: true, border: "horizontal", columnAlign: ["end"], columnWidths: [2], dense: true, firstColumnBold: true },
    countdown: { until: "2030-01-01T00:00:00Z", format: "clock", showSeconds: true, hideWhenEnded: true, prefix: "In ", suffix: "!" },
    rating: { value: 7, max: 10, size: 30, icon: "heart", color: "#FF0000", emptyColor: "#CCCCCC", showValue: false, showCount: false },
    gallery: { images: [{ url: "https://example.com/a.jpg", caption: "Cap" }], viewportFraction: 0.8, autoplay: true, autoplayInterval: 3, fit: "contain", showCounter: true, loop: false },
    video_card: { thumbnailUrl: "https://example.com/a.jpg", aspectRatio: 1.2, subtitle: "S", badge: "LIVE", showPlay: false, overlayOpacity: 0.2 },
    pricing_card: { name: "N", price: "$1", badge: "Best", originalPrice: "$2", description: "D", featureIcon: "check", disabledFeatures: ["No support"] },
    search_bar: { placeholder: "P", leadingIcon: "person", trailingIcon: "settings", filled: true, height: 56 },
    chips: { chips: [{ label: "A", icon: "star", avatarUrl: "https://example.com/a.jpg", disabled: true }], variant: "input", spacing: 4, runSpacing: 2, scrollable: true, alignment: "center" },
    quick_actions: { items: [{ label: "A", icon: "home", badge: "2" }], shape: "rounded", iconSize: 28, size: 64, showLabels: false, spacing: 12, labelMaxLines: 1 },
    form: { submitLabel: "Send", fields: [{ name: "a", type: "text", label: "A", helperText: "h", initialValue: "x", minLength: 1, maxLength: 20, min: 0, max: 9, pattern: "^a", patternMessage: "bad", rows: 3, readOnly: true, icon: "mail" }], spacing: 8, fieldVariant: "filled", submitFullWidth: true, submitIcon: "check", resetLabel: "Clear" },
  };

  // The older options too, so the examples really cover everything. Lists get theirs on the first entry.
  const first = (type: string, key: string, extra: Record<string, unknown>) => Object.assign((good[type][key] as any[])[0], extra);
  Object.assign(good.text, { maxLines: 3 });
  Object.assign(good.image, { alt: "A picture", aspectRatio: 1.5 });
  Object.assign(good.section_header, { subtitle: "Sub" });
  Object.assign(good.card, { subtitle: "Sub", children: [text] });
  Object.assign(good.banner, { title: "T", subtitle: "S" });
  Object.assign(good.carousel, { autoplay: true, viewportFraction: 0.8 });
  Object.assign(good.data_list, { layout: "grid", columns: 3, emptyText: "None" });
  first("rich_text", "spans", { bold: true, italic: true, underline: true });
  Object.assign(good.quote, { author: "Sam", role: "Founder", avatarUrl: "https://example.com/a.jpg" });
  Object.assign(good.avatar, { imageUrl: "https://example.com/a.jpg" });
  Object.assign(good.badge, { tone: "success" });
  Object.assign(good.alert, { title: "T", tone: "warning" });
  Object.assign(good.progress, { value: 0.5, label: "Upload" });
  Object.assign(good.stat, { delta: "+3%", trend: "up" });
  Object.assign(good.list_item, { subtitle: "S", icon: "home", imageUrl: "https://example.com/a.jpg", trailingText: "On", chevron: true });
  Object.assign(good.empty_state, { message: "M", icon: "bag", actionLabel: "Go" });
  first("steps", "steps", { description: "D", state: "current" });
  Object.assign(good.accordion, { allowMultiple: true });
  Object.assign(good.countdown, { label: "Ends in", endedText: "Over" });
  first("gallery", "images", { alt: "A" });
  Object.assign(good.gallery, { aspectRatio: 1.5, showDots: false });
  Object.assign(good.video_card, { title: "T", duration: "3:20" });
  Object.assign(good.hero, { subtitle: "S", ctaLabel: "Go" });
  Object.assign(good.pricing_card, { period: "/mo", features: ["Fast"], highlighted: true, ctaLabel: "Buy" });
  first("chips", "chips", { selected: true, action: { type: "dismiss" } });
  first("quick_actions", "items", { action: { type: "dismiss" } });
  Object.assign(good.quick_actions, { columns: 3 });
  Object.assign(good.rating, { count: 12, label: "reviews" });
  Object.assign(good.container, { direction: "horizontal", gap: "md" });
  first("form", "fields", { required: true, placeholder: "p", options: [{ value: "a", label: "A" }] });

  it("has a full example for every original widget", () => {
    expect(Object.keys(good).sort()).toEqual(originals.map(([type]) => type).sort());
  });

  // Every property in every schema (also inside lists) is used in the example, so a new option cannot be added without a test.
  function keysOf(schema: any, path = ""): string[] {
    const found: string[] = [];
    for (const [key, property] of Object.entries<any>(schema.properties ?? {})) {
      found.push(path + key);
      const inner = property.type === "array" ? property.items : property;
      if (inner?.properties) found.push(...keysOf(inner, `${path}${key}.`));
    }
    return found;
  }
  function pathsUsed(value: unknown, path = ""): string[] {
    if (Array.isArray(value)) return value.flatMap((entry) => pathsUsed(entry, path));
    if (value && typeof value === "object") return Object.entries(value).flatMap(([key, inner]) => [path + key, ...pathsUsed(inner, `${path}${key}.`)]);
    return [];
  }

  for (const [type] of originals) {
    it(`${type}: the example uses every option, and the page is valid`, () => {
      const used = new Set(pathsUsed(good[type]));
      const unused = keysOf(widgetDataSchema(type, 1)).filter((key) => !used.has(key) && !/(^|\.)(source\.params|params)$/.test(key));
      expect(unused, `options of ${type} that no example uses`).toEqual([]);
      expect(check(type, good[type]).errors).toEqual([]);
    });
  }

  it("names a wrong value in plain words", () => {
    expect(check("button", { label: "Go", size: "huge" }).errors[0].message).toContain("Must be one of");
    expect(check("image", { url: "https://example.com/a.jpg", fit: "squash" }).errors.length).toBeGreaterThan(0);
    expect(check("spacer", { size: -3 }).errors.length).toBeGreaterThan(0);
    expect(check("icon", { name: "star", size: 2 }).errors.length).toBeGreaterThan(0);
    expect(check("rating", { value: 4, max: 11 }).errors.length).toBeGreaterThan(0);
    expect(check("progress", { value: 2 }).errors.length).toBeGreaterThan(0);
    expect(check("carousel", { items: [text], height: 5 }).errors.length).toBeGreaterThan(0);
    expect(check("table", { columns: ["A"], rows: [], border: "dotted" }).errors.length).toBeGreaterThan(0);
  });

  it("still accepts every page written before these options existed", () => {
    for (const [type, data] of [["button", { label: "Go", variant: "outline" }], ["spacer", { size: "md" }], ["progress", { value: 0.5 }], ["icon", { name: "star", size: "large" }], ["image", { url: "https://example.com/a.jpg", fit: "contain" }]] as const) {
      expect(check(type, data).errors, type).toEqual([]);
    }
  });
});

describe("the options show up in the preview", () => {
  it("button: a tonal variant, an icon, a size, full width and a disabled look", () => {
    const wrapper = draw("button", { label: "Go", variant: "tonal", icon: "check", size: "large", fullWidth: true, enabled: false });
    const button = wrapper.find("button");
    expect(button.classes()).toContain("sp-btn--tonal");
    expect(button.text()).toContain("Go");
    expect(button.find(".sp-btn-icon").exists()).toBe(true);
    expect((button.element as HTMLElement).style.height).toBe("52px");
    expect((button.element as HTMLElement).style.width).toBe("100%");
    expect(button.attributes("disabled")).toBeDefined();
  });

  it("button: the icon can come after the label", () => {
    const wrapper = draw("button", { label: "Go", icon: "check", iconPosition: "end" });
    const children = Array.from(wrapper.find("button").element.childNodes).map((node) => node.textContent);
    expect(children.indexOf("Go")).toBeLessThan(children.findIndex((value) => value === "✓"));
  });

  it("spacer: a number, or each side by itself", () => {
    expect(style(draw("spacer", { size: 13 }))).toMatchObject({ width: "13px", height: "13px" });
    expect(style(draw("spacer", { width: 40, height: "lg" }))).toMatchObject({ width: "40px", height: "24px" });
  });

  it("divider: thickness, colour, indent and a vertical line", () => {
    const wrapper = draw("divider", { thickness: 4, color: "#FF0000", indent: 10, vertical: true, space: 30 });
    const line = style(wrapper, '[data-part="line"]');
    expect(line.width).toBe("4px");
    expect(line.background).toContain("rgb(255, 0, 0)");
    expect(line.marginInlineStart).toBe("10px");
    expect(style(wrapper).width).toBe("30px");
  });

  it("image: how it fits, where it sits and grey", () => {
    const wrapper = draw("image", { url: "https://example.com/a.jpg", fit: "scaleDown", alignment: "topRight", grayscale: true });
    const picture = style(wrapper, "img");
    expect(picture.objectFit).toBe("scale-down");
    expect(picture.objectPosition).toBe("100% 0%");
    expect(wrapper.find("img").attributes("style")).toContain("grayscale");
  });

  it("card: a bottom picture, a set height, outline and shadow", () => {
    const wrapper = draw("card", { title: "T", imageUrl: "https://example.com/a.jpg", imagePosition: "bottom", imageHeight: 90, outlined: true });
    const card = wrapper.find(".sp-card").element;
    expect(card.lastElementChild?.getAttribute("data-part")).toBe("image");
    expect((card as HTMLElement).style.border).toContain("1px solid");
    expect(wrapper.find("img").attributes("style")).toContain("height: 90px");
    expect(style(draw("card", { title: "T", elevation: 12 }), ".sp-card").boxShadow).toContain("18px");
  });

  it("banner and hero: height, a coloured overlay at the strength given, and the text where you put it", () => {
    const banner = draw("banner", { imageUrl: "https://example.com/a.jpg", title: "T", height: 220, overlayColor: "#112233", overlayOpacity: 0.7, contentAlignment: "center", ctaLabel: "Go" });
    expect(style(banner).height).toBe("220px");
    const shade = style(banner, '[data-part="overlay"]');
    expect(shade.background).toContain("rgb(17, 34, 51)");
    expect(shade.opacity).toBe("0.7");
    expect(style(banner, ".sp-over-text").justifyContent).toBe("center");
    expect(banner.find('[data-part="button"]').text()).toBe("Go");
    expect(style(draw("hero", { imageUrl: "https://example.com/a.jpg", title: "T", overlayColor: "#000000" }), '[data-part="overlay"]').opacity).toBe("0.4");
  });

  it("carousel: a set height, dots, space between cards", () => {
    const wrapper = draw("carousel", { items: [text, text], height: 150, showDots: true, spacing: 12 });
    expect(style(wrapper).height).toBe("150px");
    expect(wrapper.findAll(".sp-dots i")).toHaveLength(2);
    expect(style(wrapper, ".sp-scroll").gap).toBe("12px");
  });

  it("list and grid: space, reverse and a fixed height; gaps and cell shape", () => {
    const list = draw("list", { items: [text, text], height: 120, reverse: true, dividers: true, dividerThickness: 3 });
    expect(style(list)).toMatchObject({ height: "120px", flexDirection: "column-reverse" });
    expect(style(list, ".sp-line").height).toBe("3px");
    const grid = draw("grid", { columns: 2, items: [text, text], mainAxisSpacing: 5, crossAxisSpacing: 9, childAspectRatio: 2 });
    expect(style(grid)).toMatchObject({ rowGap: "5px", columnGap: "9px" });
    expect(style(grid, '[data-part="item"]').aspectRatio).toMatch(/^2( \/ 1)?$/);
  });

  it("tabs: the tab to start on, an underline bar and an icon", async () => {
    const wrapper = draw("tabs", { tabs: [{ id: "a", label: "A", widgets: [text] }, { id: "b", label: "B", icon: "home", widgets: [{ ...text, id: "t2", data: { text: "Second" } }] }], initialIndex: 1, variant: "underline" });
    expect(wrapper.text()).toContain("Second");
    expect(wrapper.find('[data-tab="b"]').text()).toContain("B");
    expect(style(wrapper, '[data-tab="b"]').borderBottom).toContain("2px solid");
  });

  it("accordion: open sections to start, no dividers, the arrow first", () => {
    const wrapper = draw("accordion", { items: [{ title: "Q1", widgets: [text] }, { title: "Q2", widgets: [{ ...text, id: "t2", data: { text: "Answer two" } }] }], initiallyOpen: [1], dividers: false, iconPosition: "start" });
    expect(wrapper.text()).toContain("Answer two");
    expect(wrapper.text()).not.toContain("Hello");
    const header = wrapper.find("[data-accordion]").element;
    expect(header.firstElementChild?.className).toContain("sp-chev");
    expect(style(wrapper, "[data-accordion]").borderBottom).toBe("0px");
  });

  it("icon, avatar and badge: any size, colour, shape, a status dot and a solid look", () => {
    const icon = draw("icon", { name: "star", size: 64, color: "#FF0000", rotation: 90, shape: "circle", background: "#EEEEEE" });
    expect(style(icon)).toMatchObject({ fontSize: "64px", borderRadius: "50%" });
    expect(style(icon).transform).toContain("rotate(90deg)");
    const avatar = draw("avatar", { initials: "AB", size: 100, shape: "square", status: "online" });
    expect(style(avatar).width).toBe("100px");
    expect(avatar.html()).toContain("rgb(34, 197, 94)");
    const badge = draw("badge", { label: "New", variant: "solid", shape: "square", size: "large" });
    expect(style(badge).background).not.toBe("");
    expect(style(badge).borderRadius).toBe("0px");
    expect(style(draw("badge", { label: "x", dot: true })).width).toBe("10px");
  });

  it("alert: another look, no icon, a close button and an action", () => {
    const wrapper = draw("alert", { message: "M", tone: "error", variant: "accent", showIcon: false, dismissible: true, actionLabel: "Undo" });
    expect(wrapper.find('[data-part="icon"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("Undo");
    expect(wrapper.text()).toContain("✕");
    expect(style(wrapper).borderInlineStart).toContain("4px solid");
  });

  it("progress: unknown amount, thickness, percent and a bigger ring", () => {
    const bar = draw("progress", { indeterminate: true, strokeWidth: 12, rounded: false });
    expect(style(bar, '[data-part="track"]').height).toBe("12px");
    expect(style(bar, '[data-part="fill"]').width).toBe("40%");
    expect(style(draw("progress", { value: 0.5, showPercent: true }), "[data-widget]").height).toBe("");
    expect(draw("progress", { value: 0.5, showPercent: true }).text()).toContain("50%");
    expect(style(draw("progress", { value: 0.5, shape: "circular", size: 90 })).width).toBe("90px");
  });

  it("rating: more marks, another symbol and colour, with the number hidden", () => {
    const wrapper = draw("rating", { value: 3, max: 10, icon: "heart", color: "#FF0000", showValue: false, showCount: false, count: 4 });
    expect(wrapper.find('[data-part="stars"]').text()).toHaveLength(10);
    expect(wrapper.find('[data-part="stars"]').text()).toContain("♥");
    expect(wrapper.find('[data-part="text"]').exists()).toBe(false);
  });

  it("countdown: a clock, seconds, a prefix, and nothing at all once it has ended", () => {
    const soon = new Date(Date.now() + 3 * 3600 * 1000 + 5 * 60 * 1000 + 20 * 1000).toISOString();
    const words = (wrapper: any) => wrapper.find('[data-id="w"]').text();
    expect(words(draw("countdown", { until: soon, format: "clock", showSeconds: true, prefix: "In " }))).toMatch(/^In 03:0[45]:\d\d$/);
    expect(words(draw("countdown", { until: soon, format: "long" }))).toMatch(/3 hours 5 minutes/);
    expect(style(draw("countdown", { until: "2000-01-01T00:00:00Z", endedText: "Over", hideWhenEnded: true })).display).toBe("none");
    expect(words(draw("countdown", { until: "2000-01-01T00:00:00Z", endedText: "Over" }))).toBe("Over");
  });

  it("table: stripes, alignment, a bold first column and no border", () => {
    const wrapper = draw("table", { columns: ["A", "B"], rows: [["1", "2"], ["3", "4"], ["5", "6"]], striped: true, columnAlign: ["start", "end"], firstColumnBold: true, border: "none", dense: true });
    const rows = wrapper.findAll("tbody tr");
    expect((rows[1].element as HTMLElement).style.background).not.toBe("");
    expect((rows[0].element as HTMLElement).style.background).toBe("");
    expect((wrapper.findAll("td")[1].element as HTMLElement).style.textAlign).toBe("right");
    expect((wrapper.findAll("td")[0].element as HTMLElement).style.fontWeight).toBe("700");
  });

  it("steps: numbered dots, a line between, side by side", () => {
    const wrapper = draw("steps", { steps: [{ title: "A" }, { title: "B" }], numbered: true, showConnector: true });
    expect(wrapper.findAll('[data-part="dot"]')[0].text()).toBe("1");
    expect(style(draw("steps", { steps: [{ title: "A" }], direction: "horizontal" })).display).toBe("flex");
  });

  it("chips, quick actions and form: variant, shape, helper text, a reset button", () => {
    const chips = draw("chips", { chips: [{ label: "A", selected: true }], variant: "input", scrollable: true, spacing: 3 });
    expect(chips.text()).toContain("✕");
    expect(chips.text()).not.toContain("✓");
    expect(style(chips).overflowX).toBe("auto");
    const quick = draw("quick_actions", { items: [{ label: "A", icon: "home", badge: "9" }], shape: "square", size: 70, showLabels: false });
    expect(style(quick, '[data-part="icon"]').width).toBe("70px");
    expect(quick.find('[data-part="label"]').exists()).toBe(false);
    expect(quick.text()).toContain("9");
    const form = draw("form", { submitLabel: "Send", resetLabel: "Clear", fields: [{ name: "a", type: "text", label: "A", helperText: "Help me", initialValue: "typed" }] });
    expect(form.text()).toContain("Help me");
    expect(form.text()).toContain("typed");
    expect(form.text()).toContain("Clear");
  });

  it("pricing card, gallery, video card: badge, old price, counter, caption", () => {
    const price = draw("pricing_card", { name: "N", price: "$1", badge: "Best", originalPrice: "$2", disabledFeatures: ["No support"], features: ["Fast"] });
    expect(price.text()).toContain("Best");
    expect(price.text()).toContain("$2");
    expect(price.text()).toContain("No support");
    const gallery = draw("gallery", { images: [{ url: "https://example.com/a.jpg", caption: "Cap" }, { url: "https://example.com/b.jpg" }], showCounter: true });
    expect(gallery.text()).toContain("1 / 2");
    expect(gallery.text()).toContain("Cap");
    const video = draw("video_card", { thumbnailUrl: "https://example.com/a.jpg", badge: "LIVE", subtitle: "Sub", showPlay: false });
    expect(video.text()).toContain("LIVE");
    expect(video.find('[data-part="play"]').exists()).toBe(false);
  });

  it("rich text: weight, strikethrough, a background and a tappable piece", () => {
    const wrapper = draw("rich_text", { spans: [{ text: "Hi", weight: "bold", strikethrough: true, background: "#FFFF00", action: { type: "dismiss" } }] });
    const span = style(wrapper, "p span");
    expect(span.fontWeight).toBe("700");
    expect(span.textDecoration).toContain("line-through");
    expect(span.background).toContain("rgb(255, 255, 0)");
    expect(span.textDecoration).toContain("underline");
  });

  it("key value, list item, stat, quote, empty state, section header, search bar", () => {
    expect(draw("key_value", { rows: [{ label: "a", value: "b" }, { label: "c", value: "d" }], layout: "stacked", dividers: true }).find(".sp-kv").attributes("style")).toContain("column");
    const item = draw("list_item", { title: "T", badge: "3", trailingIcon: "link", selected: true, imageUrl: "https://example.com/a.jpg", imageSize: 64, imageShape: "circle" });
    expect(item.text()).toContain("3");
    expect(style(item, '[data-part="image"]').borderRadius).toBe("50%");
    expect(draw("stat", { label: "L", value: "5", prefix: "$", suffix: "k" }).find('[data-part="value"]').text()).toBe("$5k");
    expect(draw("quote", { text: "Q", showQuoteMark: true }).text()).toContain("“");
    expect(style(draw("quote", { text: "Q", showBar: false })).borderInlineStart).toBe("");
    expect(draw("empty_state", { title: "T", imageUrl: "https://example.com/a.png" }).find("img").exists()).toBe(true);
    expect(draw("section_header", { title: "t", uppercase: true, showDivider: true }).find(".sp-line").exists()).toBe(true);
    expect(style(draw("section_header", { title: "t", uppercase: true }), '[data-part="title"]').textTransform).toBe("uppercase");
    expect(style(draw("search_bar", { placeholder: "P", filled: true, height: 60 }), '[data-part="field"]').height).toBe("60px");
  });
});

// A few options only change how the app behaves over time (autoplay timing, validation rules, animation length). The preview
// shows a still picture, so it accepts them without drawing anything. Anything not listed here must be drawn.
const behaviourOnly = new Set([
  "carousel.autoplay", "carousel.autoplayInterval", "carousel.loop", "carousel.animationDuration", "carousel.initialIndex",
  "gallery.autoplay", "gallery.autoplayInterval", "gallery.loop",
  "data_list.errorText", "data_list.retryLabel", "data_list.loadingRows", "data_list.dividers", "data_list.itemWidth",
  "button.loading", "text.semanticsLabel", "icon.tooltip", "button.tooltip", "text.selectable",
  "form.fields.options", "form.fields.minLength", "form.fields.maxLength", "form.fields.min", "form.fields.max", "form.fields.pattern", "form.fields.patternMessage",
  "progress.size", "rich_text.spans.action", "rich_text.selectable",
]);

describe("the preview and the Flutter code each handle every option", () => {
  const preview = ["SduiPreview.ts", "blocksPreview.ts"].map((file) => readFileSync(join(repoRoot, "packages", "js", "src", "vue", file), "utf8")).join("\n");
  const dart = ["builtin_widgets", "display_widgets", "interactive_widgets", "form_widget", "data_list_widget", "options", "images", "layout"]
    .map((name) => readFileSync(join(repoRoot, "packages", "flutter", "lib", "src", `${name}.dart`), "utf8").replace(/\r\n/g, "\n"))
    .join("\n");

  // The last part of every option's name (`fields.helperText` -> `helperText`), as a whole word.
  const mentioned = (source: string, key: string) => new RegExp(`\\b${key}\\b`).test(source);
  function leaves(schema: any, path = ""): string[] {
    const out: string[] = [];
    for (const [key, property] of Object.entries<any>(schema.properties ?? {})) {
      const inner = property.type === "array" ? property.items : property;
      if (inner?.properties) out.push(...leaves(inner, `${path}${key}.`));
      out.push(path + key);
    }
    return out;
  }

  for (const [type] of originals) {
    it(`${type}`, () => {
      const options = leaves(widgetDataSchema(type, 1)!).filter((path) => !/params$/.test(path));
      const notInPreview = options.filter((path) => !behaviourOnly.has(`${type}.${path}`) && !mentioned(preview, path.split(".").pop()!));
      const notInDart = options.filter((path) => !mentioned(dart, path.split(".").pop()!));
      expect(notInPreview, `${type} options the preview never draws`).toEqual([]);
      expect(notInDart, `${type} options the Flutter code never reads`).toEqual([]);
    });
  }

  it("keeps the shared schema files in step with the catalogue", () => {
    expect(schemaFiles["common/layout.json"]).toBeDefined();
  });
});
