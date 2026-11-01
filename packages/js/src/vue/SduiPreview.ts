import { defineComponent, h, ref, type PropType, type VNode } from "vue";
import type { Block, Manifest, Style, Widget } from "../types.js";

type Theme = Manifest["theme"];

// Used when the dashboard does not pass the app's real theme.
export const defaultTheme: Theme = {
  light: {
    primary: "#0B6E4F", onPrimary: "#FFFFFF", secondary: "#3B82F6", onSecondary: "#FFFFFF",
    background: "#FFFFFF", onBackground: "#111827", surface: "#F3F4F6", onSurface: "#111827",
    muted: "#6B7280", success: "#16A34A", warning: "#D97706", error: "#DC2626",
  },
  dark: {
    primary: "#34D399", onPrimary: "#06281D", secondary: "#60A5FA", onSecondary: "#0B1E3A",
    background: "#0B0F14", onBackground: "#F9FAFB", surface: "#161B22", onSurface: "#F9FAFB",
    muted: "#9CA3AF", success: "#4ADE80", warning: "#FBBF24", error: "#F87171",
  },
  fonts: { body: "sans-serif", heading: "sans-serif" },
  textSizes: { caption: 12, body: 14, title: 18, headline: 24, display: 32 },
  spacing: { none: 0, xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radii: { none: 0, sm: 4, md: 8, lg: 16, full: 999 },
};

// Turns token names into real CSS using the theme.
function styleToCss(style: Style | undefined, theme: Theme): Record<string, string> {
  const css: Record<string, string> = {};
  if (!style) return css;
  if (style.spacing) css.padding = `${theme.spacing[style.spacing]}px`;
  if (style.radius) css.borderRadius = `${theme.radii[style.radius]}px`;
  if (style.color) css.background = theme.light[style.color];
  if (style.textColor) css.color = theme.light[style.textColor];
  if (style.textSize) css.fontSize = `${theme.textSizes[style.textSize]}px`;
  if (style.align) css.textAlign = style.align === "start" ? "left" : style.align === "end" ? "right" : "center";
  return css;
}

// A tab strip needs to remember which tab is open, so it is its own small component.
const TabsPreview = defineComponent({
  name: "TabsPreview",
  props: {
    tabs: { type: Array as PropType<Array<{ id: string; label: string; widgets: Widget[] }>>, required: true },
    theme: { type: Object as PropType<Theme>, required: true },
  },
  setup(props) {
    const openTab = ref(0);
    return () =>
      h("div", { class: "sdui-tabs" }, [
        h(
          "div",
          { class: "sdui-tab-strip", style: { display: "flex", gap: "8px" } },
          props.tabs.map((tab, index) =>
            h("button", { type: "button", "data-tab": tab.id, onClick: () => (openTab.value = index) }, tab.label),
          ),
        ),
        ...(props.tabs[openTab.value]?.widgets ?? []).map((widget) => renderWidget(widget, props.theme)),
      ]);
  },
});

function renderWidget(widget: Widget, theme: Theme): VNode {
  const data = widget.data as Record<string, any>;
  const style = styleToCss(widget.style, theme);
  const items = (list: unknown): Widget[] => (Array.isArray(list) ? (list as Widget[]) : []);
  const attrs = { "data-widget": widget.type, "data-id": widget.id };

  switch (widget.type) {
    case "text":
      return h("p", { ...attrs, style }, data.text);
    case "image":
      return h("img", { ...attrs, src: data.url, alt: data.alt ?? "", style: { ...style, maxWidth: "100%" } });
    case "button":
      return h("button", { ...attrs, type: "button", style }, data.label);
    case "spacer":
      return h("div", { ...attrs, style: { height: `${theme.spacing[data.size as keyof Theme["spacing"]] ?? 0}px` } });
    case "divider":
      return h("hr", { ...attrs, style });
    case "section_header":
      return h("div", { ...attrs, style }, [
        h("h3", data.title),
        data.subtitle ? h("p", data.subtitle) : null,
        data.actionLabel ? h("a", data.actionLabel) : null,
      ]);
    case "card":
      return h("div", { ...attrs, style: { border: "1px solid #ddd", ...style } }, [
        data.imageUrl ? h("img", { src: data.imageUrl, alt: "", style: { maxWidth: "100%" } }) : null,
        data.title ? h("h4", data.title) : null,
        data.subtitle ? h("p", data.subtitle) : null,
        ...items(data.children).map((child) => renderWidget(child, theme)),
      ]);
    case "banner":
      return h("div", { ...attrs, style }, [
        h("img", { src: data.imageUrl, alt: "", style: { maxWidth: "100%" } }),
        data.title ? h("strong", data.title) : null,
        data.subtitle ? h("p", data.subtitle) : null,
      ]);
    case "carousel":
      return h(
        "div",
        { ...attrs, style: { ...style, display: "flex", gap: "8px", overflowX: "auto" } },
        items(data.items).map((child) => renderWidget(child, theme)),
      );
    case "list":
      return h(
        "div",
        { ...attrs, style },
        items(data.items).flatMap((child, index) => [
          index > 0 && data.dividers ? h("hr") : null,
          renderWidget(child, theme),
        ]),
      );
    case "grid":
      return h(
        "div",
        { ...attrs, style: { ...style, display: "grid", gridTemplateColumns: `repeat(${data.columns}, 1fr)`, gap: "8px" } },
        items(data.items).map((child) => renderWidget(child, theme)),
      );
    case "tabs":
      return h("div", { ...attrs, style }, [h(TabsPreview, { tabs: data.tabs ?? [], theme })]);
    case "data_list": {
      // The preview has no access to the app's data, so it shows the template once, placeholders and all.
      const source = data.source as { name?: string } | undefined;
      return h("div", { ...attrs, style: { ...style, border: "1px dashed #999", padding: "8px" } }, [
        h("small", `Live data: ${source?.name ?? "?"}`),
        ...items(data.template).slice(0, 1).map((child) => renderWidget(child, theme)),
      ]);
    }
    default:
      // A widget this preview does not know (for example an app's own widget).
      return h("div", { ...attrs, class: "sdui-unknown", style: { border: "1px dashed #999", padding: "8px" } }, `${widget.type} (v${widget.v})`);
  }
}

function renderBlock(block: Block, theme: Theme): VNode | null {
  if (!block) return null;
  const style = "style" in block ? styleToCss(block.style, theme) : {};
  const gap = "gap" in block && block.gap ? `${theme.spacing[block.gap]}px` : "0px";
  const children = (list: Block[]) => list.map((child) => renderBlock(child, theme));
  const attrs = { "data-block": block.block };

  switch (block.block) {
    case "column":
      return h("div", { ...attrs, style: { ...style, display: "flex", flexDirection: "column", gap } }, children(block.children));
    case "row":
      return h("div", { ...attrs, style: { ...style, display: "flex", flexDirection: "row", gap } }, children(block.children));
    case "stack":
      return h("div", { ...attrs, style: { ...style, position: "relative" } }, children(block.children));
    case "grid":
      return h(
        "div",
        { ...attrs, style: { ...style, display: "grid", gridTemplateColumns: `repeat(${block.columns}, 1fr)`, gap } },
        children(block.children),
      );
    case "scroll":
      return h("div", { ...attrs, style: { ...style, overflowY: "auto" } }, children(block.children));
    case "text":
      return h("p", { ...attrs, style }, block.text);
    case "image":
      return h("img", { ...attrs, src: block.url, alt: block.alt ?? "", style: { ...style, maxWidth: "100%" } });
    case "button":
      return h("button", { ...attrs, type: "button", style }, block.label);
    case "spacer":
      return h("div", { ...attrs, style: { height: `${theme.spacing[block.size]}px` } });
    case "divider":
      return h("hr", { ...attrs, style });
    case "widget":
      return renderWidget(block.widget, theme);
  }
}

// Shows a page or screen roughly the way the app will draw it. It is a quick look for staff,
// not a pixel-perfect copy of the Flutter app.
export const SduiPreview = defineComponent({
  name: "SduiPreview",
  props: {
    document: { type: Object as PropType<Record<string, any>>, required: true },
    theme: { type: Object as PropType<Theme>, default: () => defaultTheme },
  },
  setup(props) {
    return () => {
      const document = props.document;
      if (Array.isArray(document.sections)) {
        return h(
          "div",
          { class: "sdui-preview" },
          document.sections.map((section: { id: string; title?: string; widgets: Widget[] }) =>
            h("section", { "data-section": section.id }, [
              section.title ? h("h2", section.title) : null,
              ...section.widgets.map((widget) => renderWidget(widget, props.theme)),
            ]),
          ),
        );
      }
      if (document.root) return h("div", { class: "sdui-preview" }, [renderBlock(document.root as Block, props.theme)]);
      return h("div", { class: "sdui-preview sdui-empty" }, "Nothing to show.");
    };
  },
});
