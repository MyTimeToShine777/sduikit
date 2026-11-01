import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, onUpdated, ref, watch, type PropType, type VNode } from "vue";
import { alignmentFlex, renderBuildingBlock } from "./blocksPreview.js";
import { attachCanvasEditing, markDraggable, quoteId } from "./canvasEditing.js";
import { fillTemplate } from "../templates.js";
import type { Block, Manifest, Sides, Space, Style, StyleLook, Widget } from "../types.js";

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

// Simple symbols for the icon names. The real app draws proper icons; these are enough to tell them apart.
const ICON_SYMBOLS: Record<string, string> = {
  home: "⌂", search: "⌕", calendar: "▦", phone: "✆", chat: "✉", location: "◎", heart: "♥", star: "★", info: "ⓘ",
  bag: "▣", check: "✓", close: "✕", warning: "⚠", error: "⛔", mail: "✉", share: "⤴", download: "⤓", lock: "🔒",
  clock: "◔", gift: "✦", cart: "🛒", camera: "◉", play: "▶", link: "∞", person: "☺", settings: "⚙", payment: "▤",
  bell: "♫", bookmark: "⚑", help: "?",
};
const iconSymbol = (name: unknown) => (typeof name === "string" ? ICON_SYMBOLS[name] ?? "▢" : "▢");

// ── Look: written once, used by every widget. Sizes follow Flutter's Material 3 defaults so the preview
// looks like the app. The app's own colours, fonts and sizes come in as --sp-* variables. ──
const CSS = `
.sp-root{font-family:var(--sp-font);font-size:14px;font-weight:400;line-height:1.4;letter-spacing:normal;text-align:start;text-transform:none;background:var(--sp-bg);color:var(--sp-on-bg);min-height:100%;box-sizing:border-box;-webkit-font-smoothing:antialiased;overflow-x:clip}
.sp-root *{box-sizing:border-box}
/* A page that shows this preview (a dashboard) has its own rules for headings, buttons, tables and so on.
   Undo them inside the preview, so it looks the same everywhere. The classes below then set what they need. */
.sp-root :where(h1,h2,h3,h4,p,span,strong,em,i,label,small,div,section,ul,li,table,thead,tbody,tr,td,th,button,code,hr,img,svg){margin:0;padding:0;border:0;color:inherit;font:inherit;letter-spacing:inherit;text-transform:none;text-align:inherit;background:none;box-shadow:none;border-radius:0;max-width:none;width:auto;height:auto;min-width:0;min-height:0;list-style:none;text-decoration:none;opacity:1;float:none;filter:none}
.sp-root :where(img,svg){max-width:100%}
.sp-root :where(button){cursor:default}
.sp-root :where(strong){font-weight:700}
.sp-root :where(em){font-style:italic}
.sp-title{font-size:22px;font-weight:500;padding:16px 16px 8px;color:var(--sp-on-bg)}
.sp-item{padding:4px 16px}
.sp-bleed{padding:0}
.sp-muted{color:var(--sp-muted)}
.sp-small{font-size:12px}
.sp-medium{font-size:16px;font-weight:500}
.sp-ph{display:flex;align-items:center;justify-content:center;background:var(--sp-surface);color:var(--sp-muted);width:100%;font-size:22px}
.sp-img{display:block;width:100%}
.sp-btn{display:inline-flex;align-items:center;justify-content:center;height:40px;padding:0 24px;border-radius:20px;border:0;font:inherit;font-weight:500;background:var(--sp-primary);color:var(--sp-on-primary);cursor:default;white-space:nowrap}
.sp-btn--outline{background:transparent;color:var(--sp-primary);border:1px solid var(--sp-outline)}
.sp-btn--text{background:transparent;color:var(--sp-primary);padding:0 12px}
.sp-btn--tonal{background:color-mix(in srgb,var(--sp-primary) 18%,transparent);color:var(--sp-primary)}
.sp-btn--elevated{background:var(--sp-surface);color:var(--sp-primary);box-shadow:0 1px 3px rgba(0,0,0,.3)}
.sp-btn-icon{margin:0 6px}
.sp-line{height:1px;border:0;background:var(--sp-outline);margin:8px 0}
.sp-row{display:flex;align-items:center;gap:8px}
.sp-grow{flex:1;min-width:0}
.sp-card{margin:4px;border-radius:12px;background:var(--sp-surface);box-shadow:0 1px 3px rgba(0,0,0,.2);overflow:hidden;color:var(--sp-on-surface)}
.sp-card-body{padding:12px}
.sp-over{position:relative;overflow:hidden;color:#fff}
.sp-over>.sp-img,.sp-over>.sp-ph{position:absolute;inset:0;height:100%}
.sp-over-text{position:absolute;left:12px;right:12px;bottom:12px;text-shadow:0 1px 4px rgba(0,0,0,.6)}
.sp-over-text strong{font-size:20px;display:block}
.sp-shade{position:absolute;inset:0;background:linear-gradient(transparent,rgba(0,0,0,.55))}
.sp-scroll{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}
.sp-scroll::-webkit-scrollbar{display:none}
.sp-scroll>*{scroll-snap-align:start;flex-shrink:0}
.sp-gridrows{display:grid;gap:8px}
.sp-chip{display:inline-flex;align-items:center;height:32px;padding:0 12px;border-radius:8px;border:1px solid var(--sp-outline);font-size:14px;gap:6px;background:transparent}
.sp-chip--on{background:color-mix(in srgb,var(--sp-secondary) 22%,transparent);border-color:transparent}
.sp-wrap{display:flex;flex-wrap:wrap;gap:8px}
.sp-badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700}
.sp-alert{display:flex;gap:12px;padding:12px;border-radius:8px}
.sp-bar{height:4px;border-radius:2px;background:var(--sp-outline);overflow:hidden}
.sp-bar>i{display:block;height:100%;background:var(--sp-primary)}
.sp-ring{position:relative;width:56px;height:56px}
.sp-ring span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.sp-kv{display:flex;justify-content:space-between;gap:12px;padding:6px 0}
.sp-search{display:flex;align-items:center;gap:8px;padding:12px 16px;border:1px solid var(--sp-outline);border-radius:999px;color:var(--sp-muted)}
.sp-quick{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11px;text-align:center}
.sp-quick i{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:20px;background:color-mix(in srgb,var(--sp-primary) 16%,transparent);color:var(--sp-primary)}
.sp-table{width:100%;border-collapse:collapse}
.sp-table td,.sp-table th{border:1px solid var(--sp-outline);padding:8px;text-align:left}
.sp-table th{font-weight:700}
.sp-step{display:flex;gap:12px;padding:6px 0}
.sp-dot{flex-shrink:0;width:22px;height:22px;margin-top:1px;border-radius:50%;border:2px solid var(--sp-outline);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;line-height:1}
.sp-dot--done{background:var(--sp-primary);border-color:var(--sp-primary);color:var(--sp-on-primary)}
.sp-dot--current{border-color:var(--sp-primary)}
.sp-dot--current::after{content:"";width:8px;height:8px;border-radius:50%;background:var(--sp-primary)}
.sp-acc{display:flex;justify-content:space-between;align-items:center;padding:12px 0;font-weight:500;border-bottom:1px solid var(--sp-outline)}
.sp-chev{width:8px;height:8px;margin:0 4px;border-right:2px solid var(--sp-muted);border-bottom:2px solid var(--sp-muted);transform:rotate(45deg);transition:transform .15s}
.sp-chev--open{transform:rotate(-135deg)}
.sp-dots{display:flex;justify-content:center;gap:6px;padding-top:8px}
.sp-dots i{width:8px;height:8px;border-radius:50%;background:var(--sp-outline)}
.sp-dots i.on{background:var(--sp-primary)}
.sp-price{margin:4px;border-radius:12px;padding:16px;border:1px solid var(--sp-outline);background:var(--sp-surface)}
.sp-price--on{border:2px solid var(--sp-primary)}
.sp-field{display:flex;flex-direction:column;gap:4px;margin-bottom:12px}
.sp-field label{font-size:12px;color:var(--sp-muted)}
.sp-input{padding:12px;border:1px solid var(--sp-outline);border-radius:4px;color:var(--sp-muted);min-height:48px;background:transparent}
.sp-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:56px;height:56px;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px}
.sp-skel{height:64px;margin-bottom:8px;border-radius:8px;background:var(--sp-surface)}
.sp-edit [data-id]{cursor:pointer}
.sp-edit [data-id]:hover{outline:1.5px dashed color-mix(in srgb,var(--sp-primary) 70%,transparent);outline-offset:-1.5px}
.sp-edit .sp-selected{outline:2px solid #2563EB!important;outline-offset:-2px}
.sp-edit .sp-dragging{opacity:.4}
.sp-edit .sp-drop-before{box-shadow:0 -3px 0 0 #2563EB!important}
.sp-edit .sp-drop-after{box-shadow:0 3px 0 0 #2563EB!important}
.sp-edit .sp-editing{outline:2px solid #2563EB!important;background:color-mix(in srgb,#2563EB 10%,transparent);cursor:text;user-select:text}
.sp-stack>:not([data-widget="positioned"]){grid-area:1/1}
.sp-unknown{border:1px dashed var(--sp-muted);padding:8px;margin:4px;border-radius:8px;color:var(--sp-muted);font-size:12px}
`;

// ── Tokens → CSS, using the app's theme for light or dark ──
function paletteOf(theme: Theme, dark: boolean) {
  return dark ? theme.dark : theme.light;
}

function themeVars(theme: Theme, dark: boolean): Record<string, string> {
  const p = paletteOf(theme, dark);
  return {
    "--sp-primary": p.primary,
    "--sp-on-primary": p.onPrimary,
    "--sp-secondary": p.secondary,
    "--sp-bg": p.background,
    "--sp-on-bg": p.onBackground,
    "--sp-surface": p.surface,
    "--sp-on-surface": p.onSurface,
    "--sp-muted": p.muted,
    "--sp-outline": `color-mix(in srgb, ${p.onBackground} 22%, transparent)`,
    "--sp-font": `${theme.fonts.body}, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
  };
}

// What a widget's `style` means here. A preset name follows the app's theme; a number or "#RRGGBB" is used as given.
const SHADOWS = {
  none: "none",
  small: "0 1px 3px rgba(0,0,0,.2)",
  medium: "0 4px 12px rgba(0,0,0,.22)",
  large: "0 12px 28px rgba(0,0,0,.28)",
};
const WEIGHTS = { normal: "400", medium: "500", bold: "700" };

export function styleCss(style: StyleLook | undefined, theme: Theme, dark: boolean): Record<string, string> {
  const css: Record<string, string> = {};
  if (!style) return css;
  const p = paletteOf(theme, dark);
  const space = (value: Space) => `${typeof value === "number" ? value : theme.spacing[value]}px`;
  const colour = (value: string) => (value.startsWith("#") ? value : (p as any)[value]);
  const sidesCss = (sides: Sides) =>
    (["top", "right", "bottom", "left"] as const).map((side) => (sides[side] === undefined ? "0px" : space(sides[side]!)));

  if (style.spacing !== undefined) css.padding = space(style.spacing);
  if (style.padding) {
    // Sides that were not given keep the overall spacing, so one side can differ from the rest.
    const base = style.spacing === undefined ? 0 : style.spacing;
    const merged = { top: base, right: base, bottom: base, left: base, ...style.padding };
    css.padding = sidesCss(merged).join(" ");
  }
  if (style.margin) css.margin = sidesCss(style.margin).join(" ");
  if (style.radius !== undefined) {
    css.borderRadius = `${typeof style.radius === "number" ? style.radius : theme.radii[style.radius]}px`;
    css.overflow = "hidden";
  }
  if (style.color) css.background = colour(style.color);
  if (style.textColor) css.color = colour(style.textColor);
  if (style.textSize !== undefined) css.fontSize = `${typeof style.textSize === "number" ? style.textSize : theme.textSizes[style.textSize]}px`;
  if (style.fontWeight) css.fontWeight = WEIGHTS[style.fontWeight];
  if (style.italic) css.fontStyle = "italic";
  if (style.textDecoration) css.textDecorationLine = { none: "none", underline: "underline", lineThrough: "line-through", overline: "overline" }[style.textDecoration];
  if (style.letterSpacing !== undefined) css.letterSpacing = `${style.letterSpacing}px`;
  if (style.lineHeight !== undefined) css.lineHeight = String(style.lineHeight);

  // Lines and overflow: how many lines show, and what happens to the rest.
  const ending = style.textOverflow ?? (style.maxLines !== undefined ? "ellipsis" : undefined);
  if (style.softWrap === false) css.whiteSpace = "nowrap";
  if (style.maxLines === 1) {
    css.whiteSpace = "nowrap";
    css.overflow = "hidden";
  } else if (style.maxLines !== undefined && ending !== "visible") {
    if (ending === "ellipsis") Object.assign(css, { display: "-webkit-box", WebkitLineClamp: String(style.maxLines), WebkitBoxOrient: "vertical", overflow: "hidden" });
    else Object.assign(css, { overflow: "hidden", maxHeight: `${style.maxLines * (style.lineHeight ?? 1.4)}em` });
  }
  if (ending === "ellipsis" && (style.maxLines === 1 || style.softWrap === false)) {
    css.textOverflow = "ellipsis";
    css.overflow = "hidden";
  } else if (ending === "clip" && style.softWrap === false) {
    css.overflow = "hidden";
  } else if (ending === "fade" && (style.maxLines !== undefined || style.softWrap === false)) {
    css.overflow = "hidden";
    css.maskImage = "linear-gradient(to right, #000 80%, transparent)";
    css.WebkitMaskImage = css.maskImage;
  }
  if (style.overflow) css.overflow = style.overflow;
  if (style.align) css.textAlign = style.align === "start" ? "start" : style.align === "end" ? "end" : "center";
  if (style.width !== undefined) css.width = style.width === "fill" ? "100%" : `${style.width}px`;
  if (style.height !== undefined) css.height = style.height === "fill" ? "100%" : `${style.height}px`;
  if (style.borderWidth) {
    css.border = `${style.borderWidth}px solid ${style.borderColor ? colour(style.borderColor) : "var(--sp-outline)"}`;
  } else if (style.borderColor) {
    css.border = `1px solid ${colour(style.borderColor)}`;
  }
  if (style.shadow) css.boxShadow = SHADOWS[style.shadow];
  if (style.opacity !== undefined) css.opacity = String(style.opacity);
  if (css.width || css.height || css.margin || css.border) css.boxSizing = "border-box";
  return css;
}

interface Context {
  theme: Theme;
  dark: boolean;
  samples: Record<string, unknown[]>;
  editable: boolean;
}

const toneColor = (ctx: Context, tone: unknown): string => {
  const p = paletteOf(ctx.theme, ctx.dark);
  return tone === "info" ? p.secondary : tone === "success" ? p.success : tone === "warning" ? p.warning : tone === "error" ? p.error : p.muted;
};
const tint = (color: string, percent = 14) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;

// ── Small components that remember something (an open tab, a failed picture...) ──
const SpImage = defineComponent({
  name: "SpImage",
  props: {
    url: { type: String, required: true },
    alt: String,
    ratio: Number,
    fit: { type: String, default: "cover" },
    height: Number,
    // Fill the whole box the picture sits in (used where the box already has a size, like a gallery slide).
    fill: Boolean,
    position: String, // where the picture sits inside its box (CSS object-position)
    repeat: String, // noRepeat, repeat, repeatX, repeatY
    grayscale: Boolean,
    placeholderColor: String, // the colour shown before the picture is there, or when it fails
    errorText: String, // shown instead of the picture when it cannot load
    loader: Boolean, // show a plain box while the picture loads
  },
  setup(props) {
    const failed = ref(false);
    const loaded = ref(false);
    return () => {
      const box: Record<string, string> = {};
      if (props.ratio) box.aspectRatio = String(props.ratio);
      if (props.height) box.height = `${props.height}px`;
      if (props.fill) box.height = "100%";
      const filter = props.grayscale ? "grayscale(1)" : undefined;
      // A picture that cannot load shows a grey box of the same size instead, exactly as the app does.
      if (failed.value) return h("div", { class: "sp-ph", style: { ...box, background: props.placeholderColor, height: box.height ?? (props.ratio ? undefined : "120px") } }, props.errorText ?? "▨");
      if (props.repeat && props.repeat !== "noRepeat") {
        const tiling = ({ repeat: "repeat", repeatX: "repeat-x", repeatY: "repeat-y" } as Record<string, string>)[props.repeat];
        return h("div", { class: "sp-img", style: { ...box, height: box.height ?? "160px", backgroundImage: `url("${props.url}")`, backgroundRepeat: tiling, backgroundPosition: props.position, filter } });
      }
      return h("img", {
        class: "sp-img",
        src: props.url,
        alt: props.alt ?? "",
        onLoad: () => (loaded.value = true),
        onError: () => (failed.value = true),
        style: { ...box, objectFit: props.fit, objectPosition: props.position, filter, background: props.placeholderColor ?? (props.loader && !loaded.value ? "var(--sp-surface)" : undefined) },
      });
    };
  },
});

const SpTabs = defineComponent({
  name: "SpTabs",
  props: {
    tabs: { type: Array as PropType<Array<{ id: string; label: string; icon?: string; widgets: Widget[] }>>, required: true },
    ctx: { type: Object as PropType<Context>, required: true },
    part: { type: Function as PropType<Part>, required: true },
    initial: { type: Number, default: 0 }, // which tab starts open
    variant: { type: String, default: "chips" }, // chips, underline or segmented
    scrollable: Boolean,
    alignment: { type: String, default: "start" }, // start, center, end or stretch
  },
  setup(props) {
    const open = ref(Math.min(Math.max(props.initial, 0), Math.max(props.tabs.length - 1, 0)));
    return () => {
      const justify = ({ start: "flex-start", center: "center", end: "flex-end", stretch: "stretch" } as Record<string, string>)[props.alignment] ?? "flex-start";
      const stretch = props.alignment === "stretch" ? { flex: "1", justifyContent: "center" } : {};
      return h("div", {}, [
        h("div", {
          style: {
            display: "flex", gap: props.variant === "chips" ? "8px" : "0", justifyContent: justify, flexWrap: props.scrollable ? "nowrap" : "wrap", overflowX: props.scrollable ? "auto" : undefined, padding: "0 0 8px",
            ...(props.variant === "underline" ? { borderBottom: "1px solid var(--sp-outline)", marginBottom: "8px", paddingBottom: "0" } : {}),
          },
        }, props.tabs.map((tab, index) => {
          const on = index === open.value;
          const look = props.variant === "underline"
            ? { border: "0", borderBottom: `2px solid ${on ? "var(--sp-primary)" : "transparent"}`, borderRadius: "0", background: "transparent", color: on ? "var(--sp-primary)" : "inherit", height: "40px", padding: "0 16px", ...stretch }
            : props.variant === "segmented"
              ? { borderRadius: index === 0 ? "8px 0 0 8px" : index === props.tabs.length - 1 ? "0 8px 8px 0" : "0", marginInlineStart: index === 0 ? "0" : "-1px", ...stretch }
              : stretch;
          return h("button", props.part("tab", {
            type: "button",
            "data-tab": tab.id,
            class: ["sp-chip", on ? "sp-chip--on" : ""],
            style: { font: "inherit", color: "inherit", cursor: "default", display: "inline-flex", alignItems: "center", gap: "6px", ...look },
            onClick: () => (open.value = index),
          }), [tab.icon ? h("span", iconSymbol(tab.icon)) : null, tab.label]);
        })),
        h("div", props.part("content"), (props.tabs[open.value]?.widgets ?? []).map((widget) => renderWidget(props.ctx, widget))),
      ]);
    };
  },
});

const SpAccordion = defineComponent({
  name: "SpAccordion",
  props: {
    items: { type: Array as PropType<Array<{ title: string; subtitle?: string; icon?: string; widgets: Widget[] }>>, required: true },
    multiple: Boolean,
    ctx: { type: Object as PropType<Context>, required: true },
    part: { type: Function as PropType<Part>, required: true },
    initial: { type: Array as PropType<number[]>, default: () => [] }, // which sections start open
    dividers: { type: Boolean, default: true },
    iconPosition: { type: String, default: "end" }, // start or end
  },
  setup(props) {
    const open = ref<number[]>(props.multiple ? [...props.initial] : props.initial.slice(0, 1));
    const toggle = (index: number) => {
      if (open.value.includes(index)) open.value = open.value.filter((each) => each !== index);
      else open.value = props.multiple ? [...open.value, index] : [index];
    };
    return () =>
      h("div", {}, props.items.flatMap((item, index) => {
        const arrow = h("span", { class: `sp-chev${open.value.includes(index) ? " sp-chev--open" : ""}` });
        const text = h("span", { style: { flex: "1" } }, [h("span", {}, [item.icon ? h("span", { style: { marginInlineEnd: "8px" } }, iconSymbol(item.icon)) : null, item.title]), item.subtitle ? h("span", { class: "sp-muted sp-small", style: { display: "block", fontWeight: "400" } }, item.subtitle) : null]);
        return [
          h("div", props.part("header", { class: "sp-acc", "data-accordion": item.title, style: { gap: "12px", ...(props.dividers ? {} : { borderBottom: "0" }) }, onClick: () => toggle(index) }), props.iconPosition === "start" ? [arrow, text] : [text, arrow]),
          ...(open.value.includes(index) ? [h("div", props.part("content"), item.widgets.map((widget) => renderWidget(props.ctx, widget)))] : []),
        ];
      }));
  },
});

const SpGallery = defineComponent({
  name: "SpGallery",
  props: {
    images: { type: Array as PropType<Array<{ url: string; alt?: string; caption?: string }>>, required: true },
    ratio: { type: Number, default: 16 / 9 },
    dots: { type: Boolean, default: true },
    part: { type: Function as PropType<Part>, required: true },
    fraction: { type: Number, default: 1 }, // how much of the width each picture takes (less than 1 lets the next one peek in)
    fit: { type: String, default: "cover" },
    counter: Boolean, // shows "2 / 5"
  },
  setup(props) {
    const page = ref(0);
    return () =>
      h("div", { style: { position: "relative" } }, [
        h("div", {
          class: "sp-scroll",
          style: { aspectRatio: String(props.ratio) },
          onScroll: (event: Event) => {
            const element = event.target as HTMLElement;
            page.value = Math.round(element.scrollLeft / Math.max(element.clientWidth * props.fraction, 1));
          },
        }, props.images.map((image) => h("div", props.part("image", { style: { width: `${props.fraction * 100}%`, height: "100%", position: "relative" } }), [
          h(SpImage, { url: image.url, alt: image.alt, fill: true, fit: props.fit }),
          image.caption ? h("div", { class: "sp-over-text sp-small", style: { color: "#fff" } }, image.caption) : null,
        ]))),
        props.counter ? h("span", { class: "sp-badge", style: { position: "absolute", top: "8px", right: "8px", background: "rgba(0,0,0,.55)", color: "#fff" } }, `${page.value + 1} / ${props.images.length}`) : null,
        props.dots && props.images.length > 1 ? h("div", props.part("dots", { class: "sp-dots" }), props.images.map((_, index) => h("i", { class: index === page.value ? "on" : "" }))) : null,
      ]);
  },
});

// ── Rows for live data: the template is drawn once per example row, like the app does it ──
function renderDataList(ctx: Context, widget: Widget, tag: Record<string, unknown>, part: Part): VNode {
  const data = widget.data as Record<string, any>;
  const name: string | undefined = data.source?.name;
  const template = Array.isArray(data.template) ? data.template[0] : undefined;
  const rows = name ? ctx.samples[name] : undefined;
  const layout: string = data.layout ?? "list";
  let content: VNode | VNode[];

  if (!rows) {
    // No example rows from the server yet: grey boxes, and a note saying where the rows will come from.
    content = [
      ...[0, 1, 2].map(() => h("div", { class: "sp-skel" })),
      h("p", { class: "sp-muted sp-small", style: { textAlign: "center" } }, `Live list from "${name ?? "?"}" (no example rows available here)`),
    ];
  } else if (!rows.length) {
    content = h("p", { style: { padding: "16px" } }, data.emptyText ?? "");
  } else {
    const items = rows.map((row) => {
      const filled = fillTemplate(template, row as Record<string, unknown>) as Widget | undefined;
      const drawn = filled ? renderWidget(ctx, filled) : null;
      return drawn ? h("div", part("item"), [drawn]) : null;
    });
    content = layout === "grid"
      ? h("div", { class: "sp-gridrows", style: { gridTemplateColumns: `repeat(${data.columns ?? 2}, 1fr)` } }, items)
      : layout === "carousel"
        ? h("div", { class: "sp-scroll" }, items.map((item) => h("div", { style: { width: "85%" } }, [item])))
        : h("div", {}, items);
  }
  return h("div", { ...tag }, content);
}

// Widgets that run from one edge of the phone to the other. Everything else gets a side margin on a page,
// the same rule the Flutter app follows (see SduiRender.pageChildren), so the preview matches it.
export const FULL_BLEED_WIDGETS = new Set(["hero", "banner", "gallery", "video_card", "image", "carousel", "divider"]);

// A widget placed directly on a page (not inside another widget), with its page margin.
function renderOnPage(ctx: Context, widget: Widget): VNode | null {
  const drawn = renderWidget(ctx, widget);
  if (!drawn) return null;
  return h("div", { class: FULL_BLEED_WIDGETS.has(widget.type) ? "sp-bleed" : "sp-item" }, [drawn]);
}

// ── Named pieces inside a widget (a card's title, a button's label...) ──
// `style.parts.title` is a whole look for that piece. The piece is marked with data-part so it can be found
// (and clicked) on its own, and the look is added to whatever the preview already gives it.
type Part = (name: string, props?: Record<string, any>) => Record<string, any>;
function makePart(ctx: Context, widget: Widget): Part {
  const looks = (widget.style?.parts ?? {}) as Record<string, StyleLook>;
  return (name, props = {}) => ({
    ...props,
    "data-part": name,
    style: { ...(props.style ?? {}), ...(looks[name] ? styleCss(looks[name], ctx.theme, ctx.dark) : {}) },
  });
}

// ── Shared bits for drawing the original widgets ──
const FIT_CSS: Record<string, string> = { cover: "cover", contain: "contain", fill: "fill", fitWidth: "cover", fitHeight: "cover", none: "none", scaleDown: "scale-down" };
const POSITION_CSS: Record<string, string> = {
  topLeft: "0% 0%", topCenter: "50% 0%", topRight: "100% 0%", centerLeft: "0% 50%", center: "50% 50%", centerRight: "100% 50%", bottomLeft: "0% 100%", bottomCenter: "50% 100%", bottomRight: "100% 100%",
};
const FLEX_MAIN: Record<string, string> = { start: "flex-start", end: "flex-end", center: "center", spaceBetween: "space-between", spaceAround: "space-around", spaceEvenly: "space-evenly" };
const FLEX_CROSS: Record<string, string> = { start: "flex-start", end: "flex-end", center: "center", stretch: "stretch" };
// Full, empty and half symbols for each kind of rating mark.
const GLYPHS: Record<string, [string, string, string]> = { star: ["★", "☆", "⯪"], heart: ["♥", "♡", "♥"], thumb: ["👍", "👍", "👍"], circle: ["●", "○", "◐"] };

// Show at most this many lines, ending with "...".
const clamp = (lines: unknown): Record<string, string> =>
  typeof lines === "number" ? { display: "-webkit-box", WebkitLineClamp: String(lines), WebkitBoxOrient: "vertical", overflow: "hidden" } : {};

// The dark layer over a picture (banner, hero), in the colour and strength the page asked for.
function shade(data: Record<string, any>, colour: (value: unknown) => string | undefined, part: Part): VNode {
  // A colour you choose is laid over the picture at 40% unless you say how strong; the default is a fade to dark.
  const look = data.overlayColor ? { background: colour(data.overlayColor), opacity: String(data.overlayOpacity ?? 0.4) } : data.overlayOpacity === undefined ? {} : { opacity: String(data.overlayOpacity) };
  return h("div", part("overlay", { class: "sp-shade", style: look }));
}

// Text on top of a picture sits at the bottom left, or wherever `contentAlignment` says.
function overText(alignment: unknown): Record<string, unknown> {
  if (typeof alignment !== "string") return { class: "sp-over-text" };
  const [across, down] = alignmentFlex(alignment);
  return { class: "sp-over-text", style: { top: "12px", display: "flex", flexDirection: "column", justifyContent: down, alignItems: across, textAlign: across === "center" ? "center" : across === "flex-end" ? "right" : "left" } };
}

// "2d 3h 4m", "2 days 3 hours 4 minutes" or "51:04:00", the time that is left.
function countdownText(milliseconds: number, data: Record<string, any>): string {
  const total = Math.floor(milliseconds / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  if (data.format === "clock") return `${pad(days * 24 + hours)}:${pad(minutes)}${data.showSeconds ? `:${pad(seconds)}` : ""}`;
  const plural = (value: number, word: string) => `${value} ${word}${value === 1 ? "" : "s"}`;
  if (data.format === "long") {
    const pieces = [days ? plural(days, "day") : "", days || hours ? plural(hours, "hour") : "", plural(minutes, "minute"), data.showSeconds ? plural(seconds, "second") : ""];
    return pieces.filter(Boolean).join(" ");
  }
  const compact = days ? `${days}d ${hours}h ${minutes}m` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  return data.showSeconds ? `${compact} ${seconds}s` : compact;
}

// ── One widget ──
function renderWidget(ctx: Context, widget: Widget): VNode | null {
  if (!widget || typeof widget !== "object") return null;
  const data = (widget.data ?? {}) as Record<string, any>;
  const tag = { "data-widget": widget.type, "data-id": widget.id, style: styleCss(widget.style, ctx.theme, ctx.dark) };
  const list = (value: unknown): Widget[] => (Array.isArray(value) ? (value as Widget[]) : []);
  const kids = (value: unknown) => list(value).map((child) => renderWidget(ctx, child));
  const p = paletteOf(ctx.theme, ctx.dark);
  const part = makePart(ctx, widget);
  // A theme colour name or "#RRGGBB"; a number or theme name for a space; a size name or a number of pixels.
  const colour = (value: unknown): string | undefined => (typeof value !== "string" ? undefined : value.startsWith("#") ? value : (p as any)[value]);
  const space = (value: unknown): number => (typeof value === "number" ? value : ctx.theme.spacing[value as keyof Theme["spacing"]] ?? 0);
  const sized = (value: unknown, small: number, medium: number, large: number): number => (typeof value === "number" ? value : value === "small" ? small : value === "large" ? large : medium);
  const fitOf = (value: unknown): string => FIT_CSS[value as string] ?? "cover";

  switch (widget.type) {
    case "text":
      return h("p", { ...tag, ...(data.semanticsLabel ? { "aria-label": data.semanticsLabel } : {}), style: { ...(data.selectable ? { userSelect: "text" } : {}), ...tag.style, ...(data.maxLines && widget.style?.maxLines === undefined ? { display: "-webkit-box", WebkitLineClamp: String(data.maxLines), WebkitBoxOrient: "vertical", overflow: "hidden" } : {}) } }, data.text);
    case "image":
      return h("div", tag, [h("div", part("image"), [h(SpImage, { url: data.url, alt: data.alt, ratio: data.aspectRatio, fit: fitOf(data.fit), position: POSITION_CSS[data.alignment as string], repeat: data.repeat, grayscale: data.grayscale === true, placeholderColor: colour(data.placeholderColor), errorText: data.errorText, loader: data.showLoader === true })])]);
    case "button": {
      const variant = { outline: " sp-btn--outline", text: " sp-btn--text", tonal: " sp-btn--tonal", elevated: " sp-btn--elevated" }[data.variant as string] ?? "";
      const size = data.size === "small" ? { height: "32px", padding: "0 16px", fontSize: "12px" } : data.size === "large" ? { height: "52px", padding: "0 32px", fontSize: "16px" } : {};
      const icon = data.icon ? h("span", { class: "sp-btn-icon" }, iconSymbol(data.icon)) : null;
      const label = data.loading ? h("span", { class: "sp-btn-icon" }, "◌") : null;
      return h("div", tag, [
        h("button", part("button", {
          type: "button",
          title: data.tooltip,
          disabled: data.enabled === false || undefined,
          class: `sp-btn${variant}`,
          style: { ...size, ...(data.fullWidth ? { display: "flex", width: "100%" } : {}), ...(data.enabled === false ? { opacity: "0.38" } : {}) },
        }), data.iconPosition === "end" ? [label, data.label, icon] : [label, icon, data.label]),
      ]);
    }
    case "spacer": {
      const side = (value: unknown, fallback: number) => (value === undefined ? fallback : space(value));
      const size = data.size === undefined ? 0 : space(data.size);
      return h("div", { ...tag, style: { width: `${side(data.width, size)}px`, height: `${side(data.height, size)}px`, ...tag.style } });
    }
    case "divider": {
      const thickness = data.thickness ?? 1;
      const line = colour(data.color) ?? "var(--sp-outline)";
      const extent = data.space === undefined ? 16 : space(data.space);
      const vertical = data.vertical === true;
      return h("div", { ...tag, style: { display: vertical ? "inline-flex" : "flex", alignItems: "center", justifyContent: "center", ...(vertical ? { width: `${extent}px`, alignSelf: "stretch" } : { height: `${extent}px` }), ...tag.style } }, [
        h("div", part("line", { style: { background: line, ...(vertical ? { width: `${thickness}px`, alignSelf: "stretch" } : { height: `${thickness}px`, flex: "1" }), marginInlineStart: data.indent === undefined ? undefined : `${space(data.indent)}px`, marginInlineEnd: data.endIndent === undefined ? undefined : `${space(data.endIndent)}px` } })),
      ]);
    }
    case "section_header":
      return h("div", tag, [
        h("div", { class: "sp-row" }, [
          data.icon ? h("span", { class: "sp-btn-icon" }, iconSymbol(data.icon)) : null,
          h("div", { class: "sp-grow" }, [h("p", part("title", { class: "sp-medium", style: { ...(data.uppercase ? { textTransform: "uppercase" } : {}), ...clamp(data.titleMaxLines) } }), data.title), data.subtitle ? h("p", part("subtitle", { class: "sp-muted sp-small" }), data.subtitle) : null]),
          data.actionLabel ? h("span", part("action", { class: "sp-btn sp-btn--text" }), [data.actionLabel, data.actionIcon ? h("span", { class: "sp-btn-icon" }, iconSymbol(data.actionIcon)) : null]) : null,
        ]),
        data.showDivider ? h("hr", { class: "sp-line" }) : null,
      ]);
    case "card": {
      const picture = data.imageUrl
        ? h("div", part("image"), [h(SpImage, { url: data.imageUrl, height: data.imageAspectRatio ? undefined : data.imageHeight ?? 120, ratio: data.imageAspectRatio, fit: fitOf(data.imageFit) })])
        : null;
      const body = h("div", part("body", { class: "sp-card-body" }), [
        data.title ? h("p", part("title", { class: "sp-medium" }), data.title) : null,
        data.subtitle ? h("p", part("subtitle", { class: "sp-muted sp-small" }), data.subtitle) : null,
        ...kids(data.children),
      ]);
      const elevation = typeof data.elevation === "number" ? { boxShadow: data.elevation === 0 ? "none" : `0 ${data.elevation / 2}px ${data.elevation * 1.5}px rgba(0,0,0,${Math.min(0.12 + data.elevation * 0.01, 0.4)})` } : {};
      const outlined = data.outlined ? { border: "1px solid var(--sp-outline)", boxShadow: "none" } : {};
      return h("div", { ...tag, class: "sp-card", style: { ...elevation, ...outlined, ...tag.style } }, data.imagePosition === "bottom" ? [body, picture] : [picture, body]);
    }
    case "banner":
      return h("div", { ...tag, class: "sp-over", style: { height: `${data.height ?? 160}px`, ...tag.style } }, [
        h("div", part("image"), [h(SpImage, { url: data.imageUrl, height: data.height ?? 160, fit: fitOf(data.imageFit) })]),
        shade(data, colour, part),
        data.title || data.subtitle || data.ctaLabel ? h("div", overText(data.contentAlignment), [data.title ? h("strong", part("title"), data.title) : null, data.subtitle ? h("span", part("subtitle"), data.subtitle) : null, data.ctaLabel ? h("span", part("button", { class: "sp-btn", style: { marginTop: "8px" } }), data.ctaLabel) : null]) : null,
      ]);
    case "hero":
      return h("div", { ...tag, class: "sp-over", style: { height: `${data.height ?? 240}px`, ...tag.style } }, [
        h("div", part("image"), [h(SpImage, { url: data.imageUrl, height: data.height ?? 240, fit: fitOf(data.imageFit) })]),
        shade(data, colour, part),
        h("div", overText(data.contentAlignment), [
          h("strong", part("title", { style: { fontSize: "26px" } }), data.title),
          data.subtitle ? h("span", part("subtitle", { style: { fontSize: "16px", display: "block" } }), data.subtitle) : null,
          data.ctaLabel ? h("span", part("button", { class: "sp-btn", style: { marginTop: "12px" } }), data.ctaLabel) : null,
        ]),
      ]);
    case "carousel": {
      const width = `${Math.round((data.viewportFraction ?? 0.85) * 100)}%`;
      const cards = kids(data.items).map((item, index) => h("div", part("item", { style: { width, ...(data.enlargeCenter && index !== (data.initialIndex ?? 0) ? { transform: "scale(0.92)" } : {}) } }), [item]));
      return h("div", { ...tag, style: { ...(data.height ? { height: `${data.height}px` } : {}), ...tag.style } }, [
        h("div", { class: "sp-scroll", style: { gap: `${data.spacing === undefined ? 0 : space(data.spacing)}px`, ...(data.height ? { height: "100%" } : {}) } }, cards),
        data.showDots ? h("div", { class: "sp-dots" }, cards.map((_, index) => h("i", { class: index === (data.initialIndex ?? 0) ? "on" : "" }))) : null,
      ]);
    }
    case "list":
      return h("div", { ...tag, style: { ...(data.height ? { height: `${data.height}px`, overflowY: "auto" } : {}), ...(data.reverse ? { display: "flex", flexDirection: "column-reverse" } : {}), ...tag.style } }, kids(data.items).flatMap((item, index) => [
        index > 0 && data.dividers ? h("hr", part("divider", { class: "sp-line", style: { ...(data.dividerIndent === undefined ? {} : { marginInlineStart: `${space(data.dividerIndent)}px` }), ...(data.dividerThickness === undefined ? {} : { height: `${data.dividerThickness}px` }) } })) : null,
        h("div", part("item", { style: index > 0 && data.spacing !== undefined ? { marginTop: `${space(data.spacing)}px` } : {} }), [item]),
      ]));
    case "grid":
      return h("div", { ...tag, class: "sp-gridrows", style: { gridTemplateColumns: `repeat(${data.columns ?? 2}, 1fr)`, ...(data.mainAxisSpacing === undefined ? {} : { rowGap: `${space(data.mainAxisSpacing)}px` }), ...(data.crossAxisSpacing === undefined ? {} : { columnGap: `${space(data.crossAxisSpacing)}px` }), ...tag.style } }, kids(data.items).map((item) => h("div", part("item", { style: data.childAspectRatio ? { aspectRatio: String(data.childAspectRatio), overflow: "hidden" } : {} }), [item])));
    case "container":
      return h("div", { ...tag, style: { display: "flex", flexDirection: data.direction === "horizontal" ? "row" : "column", gap: `${ctx.theme.spacing[data.gap as keyof Theme["spacing"]] ?? 0}px`, ...(data.mainAxisAlignment ? { justifyContent: FLEX_MAIN[data.mainAxisAlignment as string] } : {}), ...(data.crossAxisAlignment ? { alignItems: FLEX_CROSS[data.crossAxisAlignment as string] } : {}), ...(data.wrap ? { flexWrap: "wrap" } : {}), ...tag.style } }, kids(data.children));
    case "tabs":
      return h("div", tag, [h(SpTabs, { tabs: Array.isArray(data.tabs) ? data.tabs : [], ctx, part, initial: data.initialIndex ?? 0, variant: data.variant ?? "chips", scrollable: data.scrollable === true, alignment: data.tabAlignment ?? "start" })]);
    case "accordion":
      return h("div", tag, [h(SpAccordion, { items: Array.isArray(data.items) ? data.items : [], multiple: data.allowMultiple === true, ctx, part, initial: Array.isArray(data.initiallyOpen) ? data.initiallyOpen : [], dividers: data.dividers !== false, iconPosition: data.iconPosition ?? "end" })]);
    case "data_list":
      return renderDataList(ctx, widget, tag, part);
    case "rich_text":
      return h("p", { ...tag, style: { ...(data.selectable ? { userSelect: "text" } : {}), ...tag.style } }, list(data.spans).map((span: any) =>
        h("span", {
          onClick: span.action ? () => undefined : undefined,
          style: {
            fontWeight: span.weight ? { normal: "400", medium: "500", bold: "700" }[span.weight as string] : span.bold ? "700" : undefined,
            fontStyle: span.italic ? "italic" : undefined,
            textDecoration: [span.underline || span.action ? "underline" : "", span.strikethrough ? "line-through" : ""].filter(Boolean).join(" ") || undefined,
            color: colour(span.color) ?? (span.action ? p.primary : undefined),
            background: colour(span.background),
            letterSpacing: span.letterSpacing === undefined ? undefined : `${span.letterSpacing}px`,
            fontSize: span.size === undefined ? undefined : `${typeof span.size === "number" ? span.size : ctx.theme.textSizes[span.size as keyof Theme["textSizes"]]}px`,
          },
        }, span.text),
      ));
    case "quote": {
      const bar = data.showBar === false ? {} : { borderInlineStart: `${data.barWidth ?? 4}px solid ${colour(data.barColor) ?? p.primary}`, paddingInlineStart: "12px" };
      const avatar = data.avatarSize ?? 28;
      return h("div", { ...tag, style: { ...bar, ...tag.style } }, [
        h("p", part("text", { style: { fontStyle: data.italic === false ? "normal" : "italic", fontSize: "16px" } }), [data.showQuoteMark ? h("span", { style: { fontSize: "28px", lineHeight: "0", marginInlineEnd: "4px", color: p.muted } }, "“") : null, data.text]),
        data.author || data.role || data.avatarUrl ? h("div", { class: "sp-row", style: { marginTop: "8px" } }, [
          data.avatarUrl ? h("div", part("avatar", { style: { width: `${avatar}px`, height: `${avatar}px`, borderRadius: "50%", overflow: "hidden" } }), [h(SpImage, { url: data.avatarUrl, height: avatar })]) : null,
          h("span", part("author", { class: "sp-small" }), [data.author, data.role].filter(Boolean).join(", ")),
        ]) : null,
      ]);
    }
    case "icon": {
      const size = sized(data.size, 16, 24, 40);
      const boxed = data.shape && data.shape !== "none";
      const pad = data.padding === undefined ? (boxed ? 8 : 0) : space(data.padding);
      return h("span", {
        ...tag,
        title: data.tooltip,
        style: {
          fontSize: `${size}px`, display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: "1", padding: `${pad}px`,
          color: colour(data.color),
          background: colour(data.background),
          borderRadius: data.shape === "circle" ? "50%" : data.shape === "rounded" ? "12px" : undefined,
          transform: [data.rotation ? `rotate(${data.rotation}deg)` : "", data.flipX ? "scaleX(-1)" : ""].filter(Boolean).join(" ") || undefined,
          ...tag.style,
        },
      }, iconSymbol(data.name));
    }
    case "avatar": {
      const size = sized(data.size, 32, 48, 80);
      const radius = data.shape === "square" ? "0" : data.shape === "rounded" ? `${Math.round(size / 5)}px` : "50%";
      const dotColor = { online: "#22C55E", offline: "#9CA3AF", busy: "#EF4444", away: "#F59E0B" }[data.status as string];
      return h("div", { ...tag, style: { position: "relative", width: `${size}px`, height: `${size}px`, flexShrink: "0", ...tag.style } }, [
        h("div", { style: { width: "100%", height: "100%", borderRadius: radius, overflow: "hidden", position: "relative", background: colour(data.backgroundColor) ?? tint(p.primary, 20), color: colour(data.foregroundColor), display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: `${Math.round(size / 2.6)}px`, ...(data.borderWidth || data.borderColor ? { border: `${data.borderWidth ?? 2}px solid ${colour(data.borderColor) ?? "var(--sp-outline)"}` } : {}) } }, [
          data.initials ? h("span", part("initials"), data.initials) : null,
          data.imageUrl ? h("div", { style: { position: "absolute", inset: "0" } }, [h(SpImage, { url: data.imageUrl, height: size })]) : null,
        ]),
        dotColor ? h("span", { style: { position: "absolute", right: "0", bottom: "0", width: `${Math.max(8, size / 4)}px`, height: `${Math.max(8, size / 4)}px`, borderRadius: "50%", background: dotColor, border: "2px solid var(--sp-bg)" } }) : null,
      ]);
    }
    case "badge": {
      const color = toneColor(ctx, data.tone);
      const look = data.variant === "solid" ? { background: color, color: "#fff" } : data.variant === "outline" ? { background: "transparent", color, border: `1px solid ${color}` } : { background: tint(color, 15), color };
      const size = data.size === "small" ? { fontSize: "9px", padding: "1px 6px" } : data.size === "large" ? { fontSize: "13px", padding: "4px 12px" } : {};
      const radius = data.shape === "square" ? "0" : data.shape === "rounded" ? "6px" : undefined;
      if (data.dot) return h("span", { ...tag, class: "sp-badge", style: { width: "10px", height: "10px", padding: "0", borderRadius: "50%", background: color, ...tag.style } });
      return h("span", { ...tag, class: "sp-badge", style: { ...look, ...size, ...(radius === undefined ? {} : { borderRadius: radius }), ...tag.style } }, [data.icon ? h("span", { style: { marginInlineEnd: "4px" } }, iconSymbol(data.icon)) : null, data.label]);
    }
    case "alert": {
      const color = toneColor(ctx, data.tone);
      const variant = data.variant === "solid" ? { background: color, color: "#fff" } : data.variant === "outline" ? { background: "transparent", border: `1px solid ${color}` } : data.variant === "accent" ? { background: tint(color, 12), borderInlineStart: `4px solid ${color}`, borderRadius: "4px" } : { background: tint(color, 12) };
      const glyph = data.icon ? iconSymbol(data.icon) : data.tone === "success" ? "✓" : data.tone === "warning" ? "⚠" : data.tone === "error" ? "⛔" : "ⓘ";
      return h("div", { ...tag, class: "sp-alert", style: { ...variant, ...tag.style } }, [
        data.showIcon === false ? null : h("span", part("icon", { style: { color: data.variant === "solid" ? "#fff" : color, fontSize: "20px" } }), glyph),
        h("div", { style: { flex: "1" } }, [data.title ? h("p", part("title", { style: { fontWeight: "500" } }), data.title) : null, h("p", part("message"), data.message), data.actionLabel ? h("span", { class: "sp-btn sp-btn--text", style: { height: "28px", padding: "0", marginTop: "4px" } }, data.actionLabel) : null]),
        data.dismissible ? h("span", { style: { cursor: "default", opacity: "0.7" }, title: "Close" }, "✕") : null,
      ]);
    }
    case "progress": {
      const indeterminate = data.indeterminate === true;
      const value = Math.max(0, Math.min(1, Number(data.value) || 0));
      const stroke = data.strokeWidth ?? 4;
      if (data.shape === "circular") {
        const diameter = data.size ?? 56;
        const unit = stroke / (diameter / 36);
        return h("div", { ...tag, class: "sp-ring", style: { width: `${diameter}px`, height: `${diameter}px`, ...tag.style } }, [
          h("svg", { viewBox: "0 0 36 36", width: diameter, height: diameter, style: { transform: "rotate(-90deg)" } }, [
            h("circle", part("track", { cx: 18, cy: 18, r: 15.9, fill: "none", stroke: "var(--sp-outline)", "stroke-width": unit })),
            h("circle", part("fill", { cx: 18, cy: 18, r: 15.9, fill: "none", stroke: "var(--sp-primary)", "stroke-width": unit, "stroke-dasharray": `${indeterminate ? 25 : value * 100} 100`, "stroke-linecap": data.rounded === false ? "butt" : "round" })),
          ]),
          indeterminate ? null : h("span", part("label"), `${Math.round(value * 100)}%`),
        ]);
      }
      const radius = data.rounded === false ? "0" : `${stroke / 2}px`;
      return h("div", tag, [
        data.label || data.showPercent ? h("div", { class: "sp-row", style: { justifyContent: "space-between", marginBottom: "4px" } }, [h("p", part("label"), data.label ?? ""), data.showPercent && !indeterminate ? h("span", { class: "sp-small" }, `${Math.round(value * 100)}%`) : null]) : null,
        h("div", part("track", { class: "sp-bar", style: { height: `${stroke}px`, borderRadius: radius } }), [h("i", part("fill", { style: { width: indeterminate ? "40%" : `${value * 100}%`, marginInlineStart: indeterminate ? "30%" : undefined, borderRadius: radius } }))]),
      ]);
    }
    case "stat": {
      const trend = data.trend as string | undefined;
      const color = trend === "up" ? p.success : trend === "down" ? p.error : p.muted;
      return h("div", tag, [
        h("p", part("label", { class: "sp-muted sp-small" }), [data.icon ? h("span", { style: { marginInlineEnd: "4px" } }, iconSymbol(data.icon)) : null, data.label]),
        h("p", part("value", { style: { fontSize: "24px" } }), [data.prefix ?? "", data.value, data.suffix ?? ""].join("")),
        data.delta ? h("p", part("delta", { class: "sp-small", style: { color } }), `${trend === "up" ? "↑ " : trend === "down" ? "↓ " : ""}${data.delta}`) : null,
      ]);
    }
    case "key_value": {
      const stacked = data.layout === "stacked";
      return h("div", tag, list(data.rows).map((row: any, index: number) => h("div", part("row", { class: "sp-kv", style: { ...(stacked ? { flexDirection: "column", gap: "2px" } : {}), ...(data.dividers && index > 0 ? { borderTop: "1px solid var(--sp-outline)" } : {}) } }), [
        h("span", part("label", { class: "sp-muted", style: data.labelFraction && !stacked ? { width: `${data.labelFraction * 100}%`, flexShrink: "0" } : {} }), [row.icon ? h("span", { style: { marginInlineEnd: "6px" } }, iconSymbol(row.icon)) : null, row.label]),
        h("strong", part("value", { style: { flex: "1", textAlign: data.valueAlign === "start" ? "start" : stacked ? "start" : "end" } }), String(row.value ?? "")),
      ])));
    }
    case "list_item": {
      const imageSize = data.imageSize ?? 40;
      const imageRadius = data.imageShape === "circle" ? "50%" : data.imageShape === "square" ? "0" : "8px";
      return h("div", { ...tag, class: "sp-row", style: { padding: data.dense ? "2px 0" : "8px 0", ...(data.selected ? { background: tint(p.primary, 12) } : {}), ...tag.style } }, [
        data.imageUrl ? h("div", part("image", { style: { width: `${imageSize}px`, height: `${imageSize}px`, borderRadius: imageRadius, overflow: "hidden", flexShrink: "0" } }), [h(SpImage, { url: data.imageUrl, height: imageSize })]) : data.icon ? h("span", part("icon", { style: { fontSize: "22px", width: "40px", textAlign: "center" } }), iconSymbol(data.icon)) : null,
        h("div", { class: "sp-grow" }, [h("p", part("title", { class: "sp-medium", style: { fontSize: data.dense ? "14px" : "16px", ...clamp(data.titleMaxLines) } }), data.title), data.subtitle ? h("p", part("subtitle", { class: "sp-muted sp-small", style: clamp(data.subtitleMaxLines) }), data.subtitle) : null]),
        data.badge ? h("span", { class: "sp-badge", style: { background: tint(p.primary, 15), color: p.primary } }, data.badge) : null,
        data.trailingText ? h("span", part("trailing", { class: "sp-muted" }), data.trailingText) : null,
        data.trailingIcon ? h("span", { class: "sp-muted" }, iconSymbol(data.trailingIcon)) : null,
        data.chevron ? h("span", { class: "sp-muted" }, "›") : null,
      ]);
    }
    case "empty_state":
      return h("div", { ...tag, style: { padding: data.compact ? "8px" : "24px", textAlign: "center", ...tag.style } }, [
        data.imageUrl ? h("div", { style: { maxWidth: "200px", margin: "0 auto 12px" } }, [h(SpImage, { url: data.imageUrl, ratio: 1.5 })]) : null,
        data.icon ? h("div", part("icon", { style: { fontSize: `${data.iconSize ?? 48}px`, color: p.muted } }), iconSymbol(data.icon)) : null,
        h("p", part("title", { class: "sp-medium", style: { marginTop: "12px" } }), data.title),
        data.message ? h("p", part("message", { style: { marginTop: "4px" } }), data.message) : null,
        data.actionLabel ? h("span", part("button", { class: "sp-btn", style: { marginTop: "16px" } }), data.actionLabel) : null,
      ]);
    case "rating": {
      const value = Number(data.value) || 0;
      const count = data.max ?? 5;
      const [full, empty, half] = GLYPHS[(data.icon as string) ?? "star"] ?? GLYPHS.star;
      const stars = Array.from({ length: count }, (_, index) => ({ glyph: value >= index + 1 ? full : value >= index + 0.5 ? half : empty, filled: value >= index + 0.5 }));
      const summary = [data.showValue === false ? "" : value.toFixed(1), data.showCount !== false && data.count !== undefined ? ` (${data.count})` : "", data.label ? ` ${data.label}` : ""].join("").trim();
      return h("div", { ...tag, class: "sp-row" }, [
        h("span", part("stars", { style: { letterSpacing: "1px", fontSize: `${data.size ?? 18}px` } }), stars.map((star) => h("span", { style: { color: star.filled ? colour(data.color) ?? "#FBBF24" : colour(data.emptyColor) ?? colour(data.color) ?? "#FBBF24" } }, star.glyph))),
        summary ? h("span", part("text"), summary) : null,
      ]);
    }
    case "table": {
      const columns: string[] = list(data.columns) as unknown as string[];
      const alignOf = (index: number) => ({ start: "left", center: "center", end: "right" }[(data.columnAlign as string[] | undefined)?.[index] ?? "start"] ?? "left");
      const pad = data.dense ? "4px 8px" : "8px";
      const border = data.border === "none" ? { border: "0" } : data.border === "horizontal" ? { border: "0", borderBottom: "1px solid var(--sp-outline)" } : {};
      return h("div", { ...tag, style: { overflowX: "auto", ...tag.style } }, [
        h("table", { class: "sp-table" }, [
          Array.isArray(data.columnWidths) ? h("colgroup", data.columnWidths.map((width: number) => h("col", { style: { width: `${width * 20}%` } }))) : null,
          h("thead", [h("tr", columns.map((column, index) => h("th", part("header", { style: { textAlign: alignOf(index), padding: pad, ...border } }), column)))]),
          h("tbody", (list(data.rows) as unknown as string[][]).map((row, rowIndex) => h("tr", { style: data.striped && rowIndex % 2 === 1 ? { background: tint(p.muted, 10) } : {} }, columns.map((_, index) => h("td", part("cell", { style: { textAlign: alignOf(index), padding: pad, ...border, ...(data.firstColumnBold && index === 0 ? { fontWeight: "700" } : {}) } }), row?.[index] ?? ""))))),
        ]),
      ]);
    }
    case "steps": {
      const horizontal = data.direction === "horizontal";
      const all = list(data.steps) as any[];
      return h("div", { ...tag, style: { ...(horizontal ? { display: "flex", gap: "8px" } : {}), ...tag.style } }, all.map((step: any, index: number) =>
        h("div", { class: "sp-step", style: horizontal ? { flex: "1", flexDirection: "column" } : { position: "relative" } }, [
          h("span", part("dot", { class: `sp-dot${step.state === "done" ? " sp-dot--done" : step.state === "current" ? " sp-dot--current" : ""}` }), step.icon ? iconSymbol(step.icon) : step.state === "done" ? "✓" : data.numbered && step.state !== "current" ? String(index + 1) : ""),
          data.showConnector && index < all.length - 1 && !horizontal ? h("span", { style: { position: "absolute", left: "10px", top: "28px", bottom: "-6px", width: "2px", background: "var(--sp-outline)" } }) : null,
          h("div", {}, [h("p", part("title", { style: { fontWeight: "500" } }), step.title), step.description ? h("p", part("description", { class: "sp-muted sp-small" }), step.description) : null]),
        ]),
      ));
    }
    case "countdown": {
      const left = new Date(data.until).getTime() - Date.now();
      if (!Number.isFinite(left)) return h("p", tag, "");
      if (left <= 0) return data.hideWhenEnded ? h("p", { ...tag, style: { display: "none" } }, "") : h("p", tag, data.endedText ?? "");
      const text = countdownText(left, data);
      return h("p", { ...tag, class: "sp-medium" }, [data.prefix ?? "", data.label ? `${data.label} ${text}` : text, data.suffix ?? ""].join(""));
    }
    case "gallery":
      return h("div", tag, [h(SpGallery, { images: Array.isArray(data.images) ? data.images : [], ratio: data.aspectRatio ?? 16 / 9, dots: data.showDots !== false, part, fraction: data.viewportFraction ?? 1, fit: fitOf(data.fit), counter: data.showCounter === true })]);
    case "video_card":
      return h("div", { ...tag, class: "sp-over", style: { aspectRatio: String(data.aspectRatio ?? 16 / 9), ...tag.style } }, [
        h("div", part("image"), [h(SpImage, { url: data.thumbnailUrl })]),
        h("div", { class: "sp-shade", style: data.overlayOpacity === undefined ? {} : { opacity: String(data.overlayOpacity) } }),
        data.showPlay === false ? null : h("div", part("play", { class: "sp-play" }), "▶"),
        data.badge ? h("span", { class: "sp-badge", style: { position: "absolute", left: "12px", top: "12px", background: "#EF4444", color: "#fff" } }, data.badge) : null,
        data.title || data.subtitle ? h("div", { class: "sp-over-text", style: { right: "64px" } }, [data.title ? h("strong", part("title", { style: { fontSize: "14px" } }), data.title) : null, data.subtitle ? h("span", { class: "sp-small", style: { display: "block" } }, data.subtitle) : null]) : null,
        data.duration ? h("span", part("duration", { style: { position: "absolute", right: "12px", bottom: "12px", textShadow: "0 1px 4px rgba(0,0,0,.6)" } }), data.duration) : null,
      ]);
    case "pricing_card":
      return h("div", { ...tag, class: `sp-price${data.highlighted ? " sp-price--on" : ""}`, style: { position: "relative", ...tag.style } }, [
        data.badge ? h("span", { class: "sp-badge", style: { position: "absolute", top: "-10px", right: "12px", background: p.primary, color: p.onPrimary } }, data.badge) : null,
        h("p", part("name", { class: "sp-medium" }), data.name),
        data.description ? h("p", { class: "sp-muted sp-small" }, data.description) : null,
        h("p", part("price", { style: { fontSize: "28px" } }), [data.originalPrice ? h("span", { class: "sp-muted", style: { fontSize: "16px", textDecoration: "line-through", marginInlineEnd: "8px" } }, data.originalPrice) : null, data.price, data.period ? h("span", part("period", { class: "sp-muted sp-small", style: { marginInlineStart: "6px" } }), data.period) : null]),
        h("div", { style: { margin: "8px 0" } }, [
          ...list(data.features).map((feature) => h("p", part("feature", { style: { padding: "2px 0" } }), [h("span", { style: { color: p.primary } }, `${data.featureIcon ? iconSymbol(data.featureIcon) : "✓"} `), String(feature)])),
          ...(Array.isArray(data.disabledFeatures) ? data.disabledFeatures : []).map((feature: unknown) => h("p", part("feature", { style: { padding: "2px 0", opacity: "0.5", textDecoration: "line-through" } }), [h("span", "✕ "), String(feature)])),
        ]),
        data.ctaLabel ? h("span", part("button", { class: "sp-btn", style: { display: "flex", marginTop: "12px" } }), data.ctaLabel) : null,
      ]);
    case "search_bar":
      return h("div", tag, [h("div", part("field", { class: "sp-search", style: { ...(data.filled ? { background: "var(--sp-surface)", borderColor: "transparent" } : {}), ...(data.height ? { height: `${data.height}px` } : {}) } }), [h("span", data.leadingIcon ? iconSymbol(data.leadingIcon) : "⌕"), h("span", { style: { flex: "1" } }, data.placeholder), data.trailingIcon ? h("span", iconSymbol(data.trailingIcon)) : null])]);
    case "chips":
      return h("div", { ...tag, class: "sp-wrap", style: { ...(data.spacing === undefined ? {} : { columnGap: `${space(data.spacing)}px` }), ...(data.runSpacing === undefined ? {} : { rowGap: `${space(data.runSpacing)}px` }), ...(data.scrollable ? { flexWrap: "nowrap", overflowX: "auto" } : {}), ...(data.alignment ? { justifyContent: FLEX_MAIN[data.alignment as string] } : {}), ...tag.style } }, list(data.chips).map((chip: any) =>
        h("span", part("chip", { class: `sp-chip${chip.selected ? " sp-chip--on" : ""}`, style: chip.disabled ? { opacity: "0.38" } : {} }), [
          chip.avatarUrl ? h("span", { style: { width: "20px", height: "20px", borderRadius: "50%", overflow: "hidden", display: "inline-block" } }, [h(SpImage, { url: chip.avatarUrl, height: 20 })]) : chip.icon ? h("span", iconSymbol(chip.icon)) : null,
          chip.selected && (data.variant ?? "filter") === "filter" ? h("span", "✓") : null,
          chip.label,
          data.variant === "input" ? h("span", { style: { opacity: "0.6" } }, "✕") : null,
        ])));
    case "quick_actions": {
      const diameter = data.size ?? 48;
      const radius = data.shape === "square" ? "0" : data.shape === "rounded" ? "14px" : "50%";
      return h("div", { ...tag, class: "sp-gridrows", style: { gridTemplateColumns: `repeat(${data.columns ?? 4}, 1fr)`, ...(data.spacing === undefined ? {} : { gap: `${space(data.spacing)}px` }), ...tag.style } }, list(data.items).map((item: any) =>
        h("div", part("item", { class: "sp-quick" }), [
          h("i", part("icon", { style: { width: `${diameter}px`, height: `${diameter}px`, borderRadius: radius, fontSize: `${data.iconSize ?? 20}px`, position: "relative" } }), [iconSymbol(item.icon), item.badge ? h("b", { style: { position: "absolute", top: "-4px", right: "-4px", minWidth: "16px", height: "16px", borderRadius: "8px", background: "#EF4444", color: "#fff", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", fontStyle: "normal" } }, item.badge) : null]),
          data.showLabels === false ? null : h("span", part("label", { style: clamp(data.labelMaxLines ?? 2) }), item.label),
        ]),
      ));
    }
    case "form": {
      const variant = data.fieldVariant === "filled" ? { background: "var(--sp-surface)", border: "0", borderBottom: "1px solid var(--sp-muted)", borderRadius: "4px 4px 0 0" } : data.fieldVariant === "underline" ? { border: "0", borderBottom: "1px solid var(--sp-muted)", borderRadius: "0" } : {};
      return h("div", { ...tag, style: { ...(data.spacing === undefined ? {} : { display: "flex", flexDirection: "column", gap: `${space(data.spacing)}px` }), ...tag.style } }, [
        ...list(data.fields).map((field: any) =>
          field.type === "checkbox" || field.type === "switch"
            ? h("div", { class: "sp-row sp-field" }, [h("span", field.type === "switch" ? "◐" : "☐"), h("span", part("label"), `${field.label}${field.required ? " *" : ""}`)])
            : h("div", { class: "sp-field", style: data.spacing === undefined ? {} : { marginBottom: "0" } }, [
                h("label", part("label"), `${field.label}${field.required ? " *" : ""}`),
                h("div", part("field", { class: "sp-input", style: { ...variant, ...(field.rows ? { minHeight: `${field.rows * 22 + 24}px` } : {}), ...(field.readOnly ? { opacity: "0.7" } : {}) } }), [field.icon ? h("span", { style: { marginInlineEnd: "8px" } }, iconSymbol(field.icon)) : null, field.initialValue ?? (field.type === "select" ? "Choose…  ⌄" : field.placeholder ?? (field.type === "date" ? "Choose a date  ▦" : ""))]),
                field.helperText ? h("small", { class: "sp-muted sp-small" }, field.helperText) : null,
              ]),
        ),
        h("div", { class: "sp-row" }, [
          h("span", part("button", { class: "sp-btn", style: { display: "flex", ...(data.submitFullWidth ? { flex: "1" } : {}) } }), [data.submitIcon ? h("span", { class: "sp-btn-icon" }, iconSymbol(data.submitIcon)) : null, data.submitLabel]),
          data.resetLabel ? h("span", { class: "sp-btn sp-btn--text" }, data.resetLabel) : null,
        ]),
      ]);
    }
    default: {
      const block = renderBuildingBlock(widget.type, data, tag, {
        space: (value) => (typeof value === "number" ? value : ctx.theme.spacing[value as keyof Theme["spacing"]] ?? 0),
        colour: (value) => (typeof value !== "string" ? undefined : value.startsWith("#") ? value : (p as any)[value]),
        kids: (value) => kids(value),
        editable: ctx.editable,
      });
      if (block !== undefined) return block;
      // A widget this preview does not know (an app's own widget). It shows its name and main texts so staff can still see what is there.
      return h("div", { ...tag, class: "sp-unknown sdui-unknown" }, `${widget.type} (v${widget.v})${mainTexts(data)}`);
    }
  }
}

function mainTexts(data: Record<string, any>): string {
  const texts = ["title", "label", "message", "text", "name", "placeholder", "value"]
    .map((key) => data[key])
    .filter((value) => typeof value === "string" || typeof value === "number");
  return texts.length ? `: ${texts.join(" · ")}` : "";
}

// ── Screens made of building blocks ──
function renderBlock(ctx: Context, block: Block): VNode | null {
  if (!block || typeof block !== "object") return null;
  const gap = "gap" in block && block.gap ? ctx.theme.spacing[block.gap] : 0;
  const style = "style" in block ? styleCss(block.style, ctx.theme, ctx.dark) : {};
  const children = (list: Block[]) => (Array.isArray(list) ? list.map((child) => renderBlock(ctx, child)) : []);
  const attrs = { "data-block": block.block };

  switch (block.block) {
    case "column":
      return h("div", { ...attrs, style: { ...style, display: "flex", flexDirection: "column", gap: `${gap}px` } }, children(block.children));
    case "row":
      return h("div", { ...attrs, style: { ...style, display: "flex", flexDirection: "row", gap: `${gap}px`, alignItems: "flex-start" } }, children(block.children).map((child) => h("div", { style: { flex: "0 1 auto", minWidth: "0" } }, [child])));
    case "stack":
      return h("div", { ...attrs, style: { ...style, position: "relative" } }, children(block.children));
    case "grid":
      return h("div", { ...attrs, class: "sp-gridrows", style: { ...style, gridTemplateColumns: `repeat(${block.columns}, 1fr)`, gap: `${gap || 8}px` } }, children(block.children));
    case "scroll":
      return h("div", { ...attrs, style: { ...style, overflowY: "auto" } }, children(block.children));
    case "widget":
      return renderWidget(ctx, block.widget);
    default: {
      // text, image, button, spacer and divider blocks look the same as the widgets of the same name.
      const { block: kind, style: blockStyle, action, ...data } = block as any;
      return renderWidget(ctx, { id: "block", type: kind, v: 1, data, style: blockStyle, action } as Widget);
    }
  }
}

/**
 * Shows a page or screen roughly the way the app draws it: Material-style widgets, the app's colours,
 * sizes and fonts (pass the manifest `theme`), light or dark mode, and example rows for live-data lists
 * (pass `dataSamples`). It is a close look for staff, not a pixel-exact copy of the Flutter app.
 */
export const SduiPreview = defineComponent({
  name: "SduiPreview",
  props: {
    document: { type: Object as PropType<Record<string, any>>, required: true },
    theme: { type: Object as PropType<Theme>, default: () => defaultTheme },
    dark: { type: Boolean, default: false },
    // Example rows for data_list widgets, by source name, e.g. { doctors_nearby: [{ name: "Dr Rao" }] }.
    dataSamples: { type: Object as PropType<Record<string, unknown[]>>, default: () => ({}) },
    // Turns the preview into a design canvas: click to select, drag to move, double-click text to retype it.
    editable: { type: Boolean, default: false },
    selectedId: { type: String, default: "" },
  },
  emits: ["select", "edit", "move"],
  setup(props, { emit }) {
    const root = ref<HTMLElement>();
    let detach: (() => void) | undefined;
    // Adds the selection mark to the chosen widget and makes every widget draggable (the page is redrawn often).
    const refresh = () => {
      if (!root.value || !props.editable) return;
      markDraggable(root.value, true);
      root.value.querySelectorAll(".sp-selected").forEach((el) => el.classList.remove("sp-selected"));
      if (props.selectedId) root.value.querySelector(`[data-id="${quoteId(props.selectedId)}"]`)?.classList.add("sp-selected");
    };
    onMounted(() => {
      if (root.value) detach = attachCanvasEditing(root.value, () => props.document, {
        select: (id) => props.editable && emit("select", id),
        edit: (change) => emit("edit", change),
        move: (change) => emit("move", change),
      });
      refresh();
    });
    onUpdated(refresh);
    watch(() => [props.selectedId, props.editable], () => nextTick(refresh));
    onBeforeUnmount(() => detach?.());
    const vars = computed(() => themeVars(props.theme, props.dark));
    return () => {
      const ctx: Context = { theme: props.theme, dark: props.dark, samples: props.dataSamples, editable: props.editable };
      const document = props.document;
      let body: Array<VNode | null>;

      if (Array.isArray(document.sections)) {
        body = document.sections.flatMap((section: { id: string; title?: string; widgets: Widget[] }) => [
          section.title ? h("h2", { class: "sp-title", "data-section-title": section.id }, section.title) : null,
          ...(Array.isArray(section.widgets) ? section.widgets : []).map((widget) => renderOnPage(ctx, widget)),
        ]);
      } else if (document.root) {
        body = [renderBlock(ctx, document.root as Block)];
      } else {
        body = [h("p", { class: "sp-muted", style: { padding: "16px" } }, "Nothing to show.")];
      }

      return h("div", { ref: root, class: props.editable ? "sp-root sdui-preview sp-edit" : "sp-root sdui-preview", style: vars.value, "data-dark": props.dark ? "true" : "false" }, [h("style", CSS), h("div", { class: "sp-content" }, body)]);
    };
  },
});
