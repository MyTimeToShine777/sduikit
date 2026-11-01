import { computed, defineComponent, h, ref, type PropType, type VNode } from "vue";
import { fillTemplate } from "../templates.js";
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

// What a widget's `style` tokens mean here: padding, background, rounded corners, text size and so on.
function styleCss(style: Style | undefined, theme: Theme, dark: boolean): Record<string, string> {
  const css: Record<string, string> = {};
  if (!style) return css;
  const p = paletteOf(theme, dark);
  if (style.spacing) css.padding = `${theme.spacing[style.spacing]}px`;
  if (style.radius) {
    css.borderRadius = `${theme.radii[style.radius]}px`;
    css.overflow = "hidden";
  }
  if (style.color) css.background = p[style.color];
  if (style.textColor) css.color = p[style.textColor];
  if (style.textSize) css.fontSize = `${theme.textSizes[style.textSize]}px`;
  if (style.align) css.textAlign = style.align === "start" ? "start" : style.align === "end" ? "end" : "center";
  return css;
}

interface Context {
  theme: Theme;
  dark: boolean;
  samples: Record<string, unknown[]>;
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
  },
  setup(props) {
    const failed = ref(false);
    return () => {
      const box: Record<string, string> = {};
      if (props.ratio) box.aspectRatio = String(props.ratio);
      if (props.height) box.height = `${props.height}px`;
      if (props.fill) box.height = "100%";
      // A picture that cannot load shows a grey box of the same size instead, exactly as the app does.
      if (failed.value) return h("div", { class: "sp-ph", style: { ...box, height: box.height ?? (props.ratio ? undefined : "120px") } }, "▨");
      return h("img", { class: "sp-img", src: props.url, alt: props.alt ?? "", style: { ...box, objectFit: props.fit }, onError: () => (failed.value = true) });
    };
  },
});

const SpTabs = defineComponent({
  name: "SpTabs",
  props: { tabs: { type: Array as PropType<Array<{ id: string; label: string; widgets: Widget[] }>>, required: true }, ctx: { type: Object as PropType<Context>, required: true } },
  setup(props) {
    const open = ref(0);
    return () =>
      h("div", {}, [
        h("div", { class: "sp-wrap", style: { padding: "0 0 8px" } }, props.tabs.map((tab, index) =>
          h("button", { type: "button", "data-tab": tab.id, class: ["sp-chip", index === open.value ? "sp-chip--on" : ""], style: { font: "inherit", color: "inherit", cursor: "default" }, onClick: () => (open.value = index) }, tab.label),
        )),
        ...(props.tabs[open.value]?.widgets ?? []).map((widget) => renderWidget(props.ctx, widget)),
      ]);
  },
});

const SpAccordion = defineComponent({
  name: "SpAccordion",
  props: { items: { type: Array as PropType<Array<{ title: string; widgets: Widget[] }>>, required: true }, multiple: Boolean, ctx: { type: Object as PropType<Context>, required: true } },
  setup(props) {
    const open = ref<number[]>([]);
    const toggle = (index: number) => {
      if (open.value.includes(index)) open.value = open.value.filter((each) => each !== index);
      else open.value = props.multiple ? [...open.value, index] : [index];
    };
    return () =>
      h("div", {}, props.items.flatMap((item, index) => [
        h("div", { class: "sp-acc", "data-accordion": item.title, onClick: () => toggle(index) }, [h("span", item.title), h("span", { class: `sp-chev${open.value.includes(index) ? " sp-chev--open" : ""}` })]),
        ...(open.value.includes(index) ? item.widgets.map((widget) => renderWidget(props.ctx, widget)) : []),
      ]));
  },
});

const SpGallery = defineComponent({
  name: "SpGallery",
  props: { images: { type: Array as PropType<Array<{ url: string; alt?: string }>>, required: true }, ratio: { type: Number, default: 16 / 9 }, dots: { type: Boolean, default: true } },
  setup(props) {
    const page = ref(0);
    return () =>
      h("div", {}, [
        h("div", {
          class: "sp-scroll",
          style: { aspectRatio: String(props.ratio) },
          onScroll: (event: Event) => {
            const element = event.target as HTMLElement;
            page.value = Math.round(element.scrollLeft / Math.max(element.clientWidth, 1));
          },
        }, props.images.map((image) => h("div", { style: { width: "100%", height: "100%" } }, [h(SpImage, { url: image.url, alt: image.alt, fill: true, fit: "cover" })]))),
        props.dots && props.images.length > 1 ? h("div", { class: "sp-dots" }, props.images.map((_, index) => h("i", { class: index === page.value ? "on" : "" }))) : null,
      ]);
  },
});

// ── Rows for live data: the template is drawn once per example row, like the app does it ──
function renderDataList(ctx: Context, widget: Widget, tag: Record<string, unknown>): VNode {
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
      return filled ? renderWidget(ctx, filled) : null;
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

// ── One widget ──
function renderWidget(ctx: Context, widget: Widget): VNode | null {
  if (!widget || typeof widget !== "object") return null;
  const data = (widget.data ?? {}) as Record<string, any>;
  const tag = { "data-widget": widget.type, "data-id": widget.id, style: styleCss(widget.style, ctx.theme, ctx.dark) };
  const list = (value: unknown): Widget[] => (Array.isArray(value) ? (value as Widget[]) : []);
  const kids = (value: unknown) => list(value).map((child) => renderWidget(ctx, child));
  const p = paletteOf(ctx.theme, ctx.dark);

  switch (widget.type) {
    case "text":
      return h("p", { ...tag, style: { ...tag.style, ...(data.maxLines ? { display: "-webkit-box", WebkitLineClamp: String(data.maxLines), WebkitBoxOrient: "vertical", overflow: "hidden" } : {}) } }, data.text);
    case "image":
      return h("div", tag, [h(SpImage, { url: data.url, alt: data.alt, ratio: data.aspectRatio, fit: data.fit === "contain" ? "contain" : "cover" })]);
    case "button": {
      const variant = data.variant === "outline" ? " sp-btn--outline" : data.variant === "text" ? " sp-btn--text" : "";
      return h("div", tag, [h("button", { type: "button", class: `sp-btn${variant}` }, data.label)]);
    }
    case "spacer": {
      const size = ctx.theme.spacing[data.size as keyof Theme["spacing"]] ?? 0;
      return h("div", { ...tag, style: { ...tag.style, width: `${size}px`, height: `${size}px` } });
    }
    case "divider":
      return h("div", tag, [h("hr", { class: "sp-line" })]);
    case "section_header":
      return h("div", { ...tag, class: "sp-row" }, [
        h("div", { class: "sp-grow" }, [h("p", { class: "sp-medium" }, data.title), data.subtitle ? h("p", { class: "sp-muted sp-small" }, data.subtitle) : null]),
        data.actionLabel ? h("span", { class: "sp-btn sp-btn--text" }, data.actionLabel) : null,
      ]);
    case "card":
      return h("div", { ...tag, class: "sp-card" }, [
        data.imageUrl ? h(SpImage, { url: data.imageUrl, height: 120 }) : null,
        h("div", { class: "sp-card-body" }, [
          data.title ? h("p", { class: "sp-medium" }, data.title) : null,
          data.subtitle ? h("p", { class: "sp-muted sp-small" }, data.subtitle) : null,
          ...kids(data.children),
        ]),
      ]);
    case "banner":
      return h("div", { ...tag, class: "sp-over", style: { ...tag.style, height: "160px" } }, [
        h(SpImage, { url: data.imageUrl, height: 160 }),
        h("div", { class: "sp-shade" }),
        data.title || data.subtitle ? h("div", { class: "sp-over-text" }, [data.title ? h("strong", data.title) : null, data.subtitle ? h("span", data.subtitle) : null]) : null,
      ]);
    case "hero":
      return h("div", { ...tag, class: "sp-over", style: { ...tag.style, height: "240px" } }, [
        h(SpImage, { url: data.imageUrl, height: 240 }),
        h("div", { class: "sp-shade" }),
        h("div", { class: "sp-over-text" }, [
          h("strong", { style: { fontSize: "26px" } }, data.title),
          data.subtitle ? h("span", { style: { fontSize: "16px", display: "block" } }, data.subtitle) : null,
          data.ctaLabel ? h("span", { class: "sp-btn", style: { marginTop: "12px" } }, data.ctaLabel) : null,
        ]),
      ]);
    case "carousel": {
      const width = `${Math.round((data.viewportFraction ?? 0.85) * 100)}%`;
      return h("div", { ...tag, class: "sp-scroll" }, kids(data.items).map((item) => h("div", { style: { width } }, [item])));
    }
    case "list":
      return h("div", tag, kids(data.items).flatMap((item, index) => [index > 0 && data.dividers ? h("hr", { class: "sp-line" }) : null, item]));
    case "grid":
      return h("div", { ...tag, class: "sp-gridrows", style: { ...tag.style, gridTemplateColumns: `repeat(${data.columns ?? 2}, 1fr)` } }, kids(data.items));
    case "container":
      return h("div", { ...tag, style: { ...tag.style, display: "flex", flexDirection: data.direction === "horizontal" ? "row" : "column", gap: `${ctx.theme.spacing[data.gap as keyof Theme["spacing"]] ?? 0}px` } }, kids(data.children));
    case "tabs":
      return h("div", tag, [h(SpTabs, { tabs: Array.isArray(data.tabs) ? data.tabs : [], ctx })]);
    case "accordion":
      return h("div", tag, [h(SpAccordion, { items: Array.isArray(data.items) ? data.items : [], multiple: data.allowMultiple === true, ctx })]);
    case "data_list":
      return renderDataList(ctx, widget, tag);
    case "rich_text":
      return h("p", tag, list(data.spans).map((span: any) =>
        h("span", { style: { fontWeight: span.bold ? "700" : undefined, fontStyle: span.italic ? "italic" : undefined, textDecoration: span.underline ? "underline" : undefined, color: span.color ? p[span.color as keyof typeof p] : undefined, fontSize: span.size ? `${ctx.theme.textSizes[span.size as keyof Theme["textSizes"]]}px` : undefined } }, span.text),
      ));
    case "quote":
      return h("div", { ...tag, style: { ...tag.style, borderInlineStart: `4px solid ${p.primary}`, paddingInlineStart: "12px" } }, [
        h("p", { style: { fontStyle: "italic", fontSize: "16px" } }, data.text),
        data.author || data.role || data.avatarUrl ? h("div", { class: "sp-row", style: { marginTop: "8px" } }, [
          data.avatarUrl ? h("div", { style: { width: "28px", height: "28px", borderRadius: "50%", overflow: "hidden" } }, [h(SpImage, { url: data.avatarUrl, height: 28 })]) : null,
          h("span", { class: "sp-small" }, [data.author, data.role].filter(Boolean).join(", ")),
        ]) : null,
      ]);
    case "icon": {
      const size = data.size === "small" ? 16 : data.size === "large" ? 40 : 24;
      return h("span", { ...tag, style: { ...tag.style, fontSize: `${size}px`, display: "inline-block", lineHeight: "1" } }, iconSymbol(data.name));
    }
    case "avatar": {
      const size = data.size === "small" ? 32 : data.size === "large" ? 80 : 48;
      return h("div", { ...tag, style: { ...tag.style, width: `${size}px`, height: `${size}px`, borderRadius: "50%", overflow: "hidden", position: "relative", background: tint(p.primary, 20), display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700" } }, [
        data.initials ? h("span", data.initials) : null,
        data.imageUrl ? h("div", { style: { position: "absolute", inset: "0" } }, [h(SpImage, { url: data.imageUrl, height: size })]) : null,
      ]);
    }
    case "badge": {
      const color = toneColor(ctx, data.tone);
      return h("span", { ...tag, class: "sp-badge", style: { ...tag.style, background: tint(color, 15), color } }, data.label);
    }
    case "alert": {
      const color = toneColor(ctx, data.tone);
      return h("div", { ...tag, class: "sp-alert", style: { ...tag.style, background: tint(color, 12) } }, [
        h("span", { style: { color, fontSize: "20px" } }, data.tone === "success" ? "✓" : data.tone === "warning" ? "⚠" : data.tone === "error" ? "⛔" : "ⓘ"),
        h("div", {}, [data.title ? h("p", { style: { fontWeight: "500" } }, data.title) : null, h("p", data.message)]),
      ]);
    }
    case "progress": {
      const value = Math.max(0, Math.min(1, Number(data.value) || 0));
      if (data.shape === "circular") {
        return h("div", { ...tag, class: "sp-ring" }, [
          h("svg", { viewBox: "0 0 36 36", width: 56, height: 56, style: { transform: "rotate(-90deg)" } }, [
            h("circle", { cx: 18, cy: 18, r: 15.9, fill: "none", stroke: "var(--sp-outline)", "stroke-width": 3 }),
            h("circle", { cx: 18, cy: 18, r: 15.9, fill: "none", stroke: "var(--sp-primary)", "stroke-width": 3, "stroke-dasharray": `${value * 100} 100`, "stroke-linecap": "round" }),
          ]),
          h("span", `${Math.round(value * 100)}%`),
        ]);
      }
      return h("div", tag, [data.label ? h("p", { style: { marginBottom: "4px" } }, data.label) : null, h("div", { class: "sp-bar" }, [h("i", { style: { width: `${value * 100}%` } })])]);
    }
    case "stat": {
      const trend = data.trend as string | undefined;
      const color = trend === "up" ? p.success : trend === "down" ? p.error : p.muted;
      return h("div", tag, [
        h("p", { class: "sp-muted sp-small" }, data.label),
        h("p", { style: { fontSize: "24px" } }, data.value),
        data.delta ? h("p", { class: "sp-small", style: { color } }, `${trend === "up" ? "↑ " : trend === "down" ? "↓ " : ""}${data.delta}`) : null,
      ]);
    }
    case "key_value":
      return h("div", tag, list(data.rows).map((row: any) => h("div", { class: "sp-kv" }, [h("span", { class: "sp-muted" }, row.label), h("strong", String(row.value ?? ""))])));
    case "list_item":
      return h("div", { ...tag, class: "sp-row", style: { ...tag.style, padding: tag.style.padding ?? "8px 0" } }, [
        data.imageUrl ? h("div", { style: { width: "40px", height: "40px", borderRadius: "8px", overflow: "hidden", flexShrink: "0" } }, [h(SpImage, { url: data.imageUrl, height: 40 })]) : data.icon ? h("span", { style: { fontSize: "22px", width: "40px", textAlign: "center" } }, iconSymbol(data.icon)) : null,
        h("div", { class: "sp-grow" }, [h("p", { class: "sp-medium", style: { fontSize: "16px" } }, data.title), data.subtitle ? h("p", { class: "sp-muted sp-small" }, data.subtitle) : null]),
        data.trailingText ? h("span", { class: "sp-muted" }, data.trailingText) : null,
        data.chevron ? h("span", { class: "sp-muted" }, "›") : null,
      ]);
    case "empty_state":
      return h("div", { ...tag, style: { ...tag.style, padding: "24px", textAlign: "center" } }, [
        data.icon ? h("div", { style: { fontSize: "48px", color: p.muted } }, iconSymbol(data.icon)) : null,
        h("p", { class: "sp-medium", style: { marginTop: "12px" } }, data.title),
        data.message ? h("p", { style: { marginTop: "4px" } }, data.message) : null,
        data.actionLabel ? h("span", { class: "sp-btn", style: { marginTop: "16px" } }, data.actionLabel) : null,
      ]);
    case "rating": {
      const value = Number(data.value) || 0;
      const stars = [1, 2, 3, 4, 5].map((star) => (value >= star ? "★" : value >= star - 0.5 ? "⯪" : "☆"));
      return h("div", { ...tag, class: "sp-row" }, [
        h("span", { style: { color: "#FBBF24", letterSpacing: "1px", fontSize: "18px" } }, stars.join("")),
        h("span", [value.toFixed(1), data.count !== undefined ? ` (${data.count})` : "", data.label ? ` ${data.label}` : ""].join("")),
      ]);
    }
    case "table": {
      const columns: string[] = list(data.columns) as unknown as string[];
      return h("div", { ...tag, style: { ...tag.style, overflowX: "auto" } }, [
        h("table", { class: "sp-table" }, [
          h("thead", [h("tr", columns.map((column) => h("th", column)))]),
          h("tbody", (list(data.rows) as unknown as string[][]).map((row) => h("tr", columns.map((_, index) => h("td", row?.[index] ?? ""))))),
        ]),
      ]);
    }
    case "steps":
      return h("div", tag, list(data.steps).map((step: any) =>
        h("div", { class: "sp-step" }, [
          h("span", { class: `sp-dot${step.state === "done" ? " sp-dot--done" : step.state === "current" ? " sp-dot--current" : ""}` }, step.state === "done" ? "✓" : ""),
          h("div", {}, [h("p", { style: { fontWeight: "500" } }, step.title), step.description ? h("p", { class: "sp-muted sp-small" }, step.description) : null]),
        ]),
      ));
    case "countdown": {
      const left = new Date(data.until).getTime() - Date.now();
      if (!Number.isFinite(left)) return h("p", tag, "");
      if (left <= 0) return h("p", tag, data.endedText ?? "");
      const minutes = Math.floor(left / 60000);
      const text = minutes >= 1440 ? `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h ${minutes % 60}m` : minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
      return h("p", { ...tag, class: "sp-medium" }, data.label ? `${data.label} ${text}` : text);
    }
    case "gallery":
      return h("div", tag, [h(SpGallery, { images: Array.isArray(data.images) ? data.images : [], ratio: data.aspectRatio ?? 16 / 9, dots: data.showDots !== false })]);
    case "video_card":
      return h("div", { ...tag, class: "sp-over", style: { ...tag.style, aspectRatio: "16 / 9" } }, [
        h(SpImage, { url: data.thumbnailUrl }),
        h("div", { class: "sp-shade" }),
        h("div", { class: "sp-play" }, "▶"),
        data.title ? h("div", { class: "sp-over-text", style: { right: "64px" } }, [h("strong", { style: { fontSize: "14px" } }, data.title)]) : null,
        data.duration ? h("span", { style: { position: "absolute", right: "12px", bottom: "12px", textShadow: "0 1px 4px rgba(0,0,0,.6)" } }, data.duration) : null,
      ]);
    case "pricing_card":
      return h("div", { ...tag, class: `sp-price${data.highlighted ? " sp-price--on" : ""}` }, [
        h("p", { class: "sp-medium" }, data.name),
        h("p", { style: { fontSize: "28px" } }, [data.price, data.period ? h("span", { class: "sp-muted sp-small", style: { marginInlineStart: "6px" } }, data.period) : null]),
        h("div", { style: { margin: "8px 0" } }, list(data.features).map((feature) => h("p", { style: { padding: "2px 0" } }, [h("span", { style: { color: p.primary } }, "✓ "), String(feature)]))),
        data.ctaLabel ? h("span", { class: "sp-btn", style: { display: "flex", marginTop: "12px" } }, data.ctaLabel) : null,
      ]);
    case "search_bar":
      return h("div", tag, [h("div", { class: "sp-search" }, [h("span", "⌕"), h("span", data.placeholder)])]);
    case "chips":
      return h("div", { ...tag, class: "sp-wrap" }, list(data.chips).map((chip: any) => h("span", { class: `sp-chip${chip.selected ? " sp-chip--on" : ""}` }, [chip.selected ? h("span", "✓") : null, chip.label])));
    case "quick_actions":
      return h("div", { ...tag, class: "sp-gridrows", style: { ...tag.style, gridTemplateColumns: `repeat(${data.columns ?? 4}, 1fr)` } }, list(data.items).map((item: any) =>
        h("div", { class: "sp-quick" }, [h("i", iconSymbol(item.icon)), h("span", item.label)]),
      ));
    case "form":
      return h("div", tag, [
        ...list(data.fields).map((field: any) =>
          field.type === "checkbox" || field.type === "switch"
            ? h("div", { class: "sp-row sp-field" }, [h("span", field.type === "switch" ? "◐" : "☐"), h("span", `${field.label}${field.required ? " *" : ""}`)])
            : h("div", { class: "sp-field" }, [h("label", `${field.label}${field.required ? " *" : ""}`), h("div", { class: "sp-input" }, field.type === "select" ? "Choose…  ⌄" : field.placeholder ?? (field.type === "date" ? "Choose a date  ▦" : ""))]),
        ),
        h("span", { class: "sp-btn", style: { display: "flex" } }, data.submitLabel),
      ]);
    default:
      // A widget this preview does not know (an app's own widget). It shows its name and main texts so staff can still see what is there.
      return h("div", { ...tag, class: "sp-unknown sdui-unknown" }, `${widget.type} (v${widget.v})${mainTexts(data)}`);
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
  },
  setup(props) {
    const vars = computed(() => themeVars(props.theme, props.dark));
    return () => {
      const ctx: Context = { theme: props.theme, dark: props.dark, samples: props.dataSamples };
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

      return h("div", { class: "sp-root sdui-preview", style: vars.value, "data-dark": props.dark ? "true" : "false" }, [h("style", CSS), h("div", { class: "sp-content" }, body)]);
    };
  },
});
