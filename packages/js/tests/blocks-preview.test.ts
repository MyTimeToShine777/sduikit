// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { listWidgets } from "../src/index";
import { SduiPreview } from "../src/vue/index";
import { loadFixture, page, widget } from "./helpers";

const text = (value: string, id = `t_${value}`) => widget("text", { text: value }, { id });
const draw = (document: unknown, props: Record<string, unknown> = {}) => mount(SduiPreview, { props: { document: document as any, ...props } });
const styleOf = (wrapper: any, id: string) => (wrapper.find(`[data-id="${id}"]`).element as HTMLElement).style;

describe("building blocks in the preview", () => {
  it("draws every widget of the showcase pages, none as an unknown box", () => {
    for (const file of ["valid/page-blocks.json", "valid/page-showcase.json", "valid/page-home.json"]) {
      const wrapper = draw(loadFixture(file));
      expect(wrapper.find(".sdui-unknown").exists(), file).toBe(false);
    }
  });

  it("knows how to draw every building block in the catalogue", () => {
    const types = listWidgets().filter((entry) => entry.group === "Building blocks").map((entry) => entry.type);
    expect(types).toHaveLength(28);
    const blocks = loadFixture("valid/page-blocks.json");
    const wrapper = draw(blocks);
    for (const type of types) expect(wrapper.find(`[data-widget="${type}"]`).exists(), type).toBe(true);
  });

  it("lays out a row and a column the way Flutter does", () => {
    const wrapper = draw(page(
      widget("row", { children: [text("a"), text("b")], mainAxisAlignment: "spaceBetween", crossAxisAlignment: "center", spacing: 12 }, { id: "row" }),
      widget("column", { children: [text("c")], spacing: "md" }, { id: "col" }),
    ));
    expect(styleOf(wrapper, "row")).toMatchObject({ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: "12px" });
    expect(styleOf(wrapper, "col")).toMatchObject({ flexDirection: "column" });
  });

  it("places a positioned widget at exact distances inside a stack", () => {
    const wrapper = draw(page(widget("stack", { children: [widget("positioned", { left: 10, bottom: 4, children: [text("x")] }, { id: "pos" })] }, { id: "stack" })));
    expect(styleOf(wrapper, "pos")).toMatchObject({ position: "absolute", left: "10px", bottom: "4px" });
    expect(styleOf(wrapper, "stack").position).toBe("relative");
  });

  it("gives padding a different amount on each side", () => {
    const wrapper = draw(page(widget("padding", { padding: { top: 4, left: "lg" }, children: [text("x")] }, { id: "pad" })));
    expect(styleOf(wrapper, "pad").padding).toBe("4px 0px 0px 24px");
  });

  it("draws a box with a gradient, rounded corners, border and shadow", () => {
    const wrapper = draw(page(widget("box", {
      width: 200, height: 80, borderRadius: 12, borderWidth: 2, borderColor: "#112233",
      gradient: { colors: ["#FF0000", "#0000FF"], begin: "topLeft", end: "bottomRight" },
      shadows: [{ color: "#00000040", offsetY: 4, blur: 12 }], children: [text("x")],
    }, { id: "box" })));
    const style = styleOf(wrapper, "box");
    expect(style.width).toBe("200px");
    expect(style.borderRadius).toBe("12px");
    expect(style.backgroundImage).toContain("linear-gradient(");
    expect(style.boxShadow).toContain("12px");
    expect(style.border).toContain("2px solid");
  });

  it("shows only the chosen widget of an indexed stack", () => {
    const wrapper = draw(page(widget("indexed_stack", { index: 1, children: [text("first"), text("second")] })));
    expect(wrapper.text()).toContain("second");
    expect(wrapper.text()).not.toContain("first");
  });

  it("hides a widget in the app view but keeps it findable while editing", () => {
    const hidden = page(widget("visibility", { visible: false, children: [text("secret")] }, { id: "vis" }));
    expect(styleOf(draw(hidden), "vis").display).toBe("none");
    expect(styleOf(draw(hidden, { editable: true }), "vis").opacity).toBe("0.3");
  });

  it("turns, fades and blurs", () => {
    const wrapper = draw(page(
      widget("transform", { rotate: 10, scale: 2, translateX: 5, children: [text("a")] }, { id: "tr" }),
      widget("opacity", { opacity: 0.25, children: [text("b")] }, { id: "op" }),
      widget("backdrop_blur", { sigma: 6, children: [text("c")] }, { id: "bl" }),
    ));
    expect(styleOf(wrapper, "tr").transform).toContain("rotate(10deg)");
    expect(styleOf(wrapper, "op").opacity).toBe("0.25");
    expect(styleOf(wrapper, "bl").backdropFilter).toBe("blur(6px)");
  });

  it("lets any widget take the shared style on top of its own look", () => {
    const wrapper = draw(page(widget("column", { children: [text("x")] }, { id: "col", style: { color: "#FF8800", radius: 10, margin: { top: 8 } } })));
    const style = styleOf(wrapper, "col");
    expect(style.background).toContain("rgb(255, 136, 0)");
    expect(style.marginTop).toBe("8px");
  });
});
