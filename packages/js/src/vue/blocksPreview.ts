import { h, type VNode } from "vue";

// How the preview draws the building blocks (row, column, stack, padding, box...). They are named after
// Flutter's widgets and behave the same way, so a person who knows Flutter gets what they expect.

export interface BlockHelpers {
  space(value: unknown): number; // a theme name ("md") or a number, in pixels
  colour(value: unknown): string | undefined; // a theme colour name or "#RRGGBB"
  kids(value: unknown): Array<VNode | null>; // the drawn widgets of a list
  editable: boolean; // staff are editing, so hidden things are shown faintly instead of vanishing
}

type Css = Record<string, string>;
type Data = Record<string, any>;

// Where something sits inside its space, as flex placement (left/centre/right, top/centre/bottom).
const ALIGN: Record<string, [string, string]> = {
  topLeft: ["flex-start", "flex-start"], topCenter: ["center", "flex-start"], topRight: ["flex-end", "flex-start"],
  centerLeft: ["flex-start", "center"], center: ["center", "center"], centerRight: ["flex-end", "center"],
  bottomLeft: ["flex-start", "flex-end"], bottomCenter: ["center", "flex-end"], bottomRight: ["flex-end", "flex-end"],
};
const alignOf = (value: unknown, fallback = "topLeft"): [string, string] => ALIGN[typeof value === "string" && ALIGN[value] ? value : fallback];
// Where an alignment is, as x and y from -1 to 1 (used for gradient direction and transform origin).
const POINT = (value: unknown, fallback: string): [number, number] => {
  const name = typeof value === "string" && ALIGN[value] ? value : fallback;
  const [x, y] = ALIGN[name];
  return [x === "flex-start" ? -1 : x === "flex-end" ? 1 : 0, y === "flex-start" ? -1 : y === "flex-end" ? 1 : 0];
};

const MAIN: Record<string, string> = { start: "flex-start", end: "flex-end", center: "center", spaceBetween: "space-between", spaceAround: "space-around", spaceEvenly: "space-evenly" };
const CROSS: Record<string, string> = { start: "flex-start", end: "flex-end", center: "center", stretch: "stretch" };
const px = (value: unknown) => (typeof value === "number" ? `${value}px` : undefined);
const length = (value: unknown) => (value === "fill" ? "100%" : px(value));
const SHADOW_CSS = (entry: Data, colour: BlockHelpers["colour"]) =>
  `${entry.offsetX ?? 0}px ${entry.offsetY ?? 0}px ${entry.blur ?? 0}px ${entry.spread ?? 0}px ${colour(entry.color) ?? "rgba(0,0,0,.25)"}`;

function sides(value: unknown, helpers: BlockHelpers): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const sidesObject = value as Data;
  return (["top", "right", "bottom", "left"] as const).map((side) => `${sidesObject[side] === undefined ? 0 : helpers.space(sidesObject[side])}px`).join(" ");
}

function gradientCss(gradient: unknown, helpers: BlockHelpers): string | undefined {
  if (!gradient || typeof gradient !== "object") return undefined;
  const { type, colors, begin, end } = gradient as Data;
  const list = (Array.isArray(colors) ? colors : []).map((each) => helpers.colour(each)).filter(Boolean) as string[];
  if (list.length < 2) return undefined;
  if (type === "radial") return `radial-gradient(circle, ${list.join(", ")})`;
  const [x1, y1] = POINT(begin, "topCenter");
  const [x2, y2] = POINT(end, "bottomCenter");
  // CSS angles start at "up" and go clockwise.
  const angle = Math.round((Math.atan2(x2 - x1, -(y2 - y1)) * 180) / Math.PI);
  return `linear-gradient(${angle}deg, ${list.join(", ")})`;
}

/** Draws one building block, or returns undefined when `type` is not one of them. */
export function renderBuildingBlock(type: string, data: Data, tag: Record<string, any>, helpers: BlockHelpers): VNode | null | undefined {
  const own: Css = tag.style ?? {};
  const make = (css: Css, children: Array<VNode | null> | undefined, extra: Record<string, unknown> = {}) =>
    h("div", { ...tag, ...extra, style: { ...own, ...css } }, children);
  const inside = () => helpers.kids(data.children);
  const gap = data.spacing === undefined ? 0 : helpers.space(data.spacing);

  switch (type) {
    case "row":
    case "column": {
      const row = type === "row";
      return make(
        {
          display: "flex",
          flexDirection: row ? "row" : "column",
          justifyContent: MAIN[data.mainAxisAlignment] ?? "flex-start",
          alignItems: CROSS[data.crossAxisAlignment] ?? "flex-start",
          gap: `${gap}px`,
          // A row takes all the width it can unless told to shrink to its contents.
          ...(row && data.mainAxisSize !== "min" ? { width: "100%" } : {}),
        },
        inside(),
      );
    }
    case "stack": {
      const [x, y] = alignOf(data.alignment);
      return make(
        { display: "grid", position: "relative", justifyItems: x, alignItems: y, ...(data.clip === false ? {} : { overflow: "hidden" }), width: length(data.width) ?? "100%", ...(data.height !== undefined ? { height: length(data.height)! } : {}) },
        inside(),
        { class: "sp-stack" },
      );
    }
    case "positioned":
      return make(
        {
          position: "absolute",
          ...(px(data.left) ? { left: px(data.left)! } : {}),
          ...(px(data.top) ? { top: px(data.top)! } : {}),
          ...(px(data.right) ? { right: px(data.right)! } : {}),
          ...(px(data.bottom) ? { bottom: px(data.bottom)! } : {}),
          ...(px(data.width) ? { width: px(data.width)! } : {}),
          ...(px(data.height) ? { height: px(data.height)! } : {}),
        },
        inside(),
      );
    case "padding":
      return make({ padding: sides(data.padding, helpers) ?? "0px" }, inside());
    case "align": {
      const [x, y] = alignOf(data.alignment, "center");
      return make({ display: "flex", justifyContent: x, alignItems: y, width: "100%" }, inside());
    }
    case "center":
      return make({ display: "flex", justifyContent: "center", alignItems: "center", width: "100%" }, inside());
    case "sized_box":
      return make({ ...(length(data.width) ? { width: length(data.width)! } : {}), ...(length(data.height) ? { height: length(data.height)! } : {}) }, inside());
    case "expanded":
      return make({ flex: `${data.flex ?? 1} 1 0%`, minWidth: "0", minHeight: "0" }, inside());
    case "flexible":
      return make({ flex: `${data.flex ?? 1} 1 ${data.fit === "tight" ? "0%" : "auto"}`, minWidth: "0", minHeight: "0" }, inside());
    case "aspect_ratio":
      return make({ aspectRatio: String(data.aspectRatio ?? 1), width: "100%", overflow: "hidden" }, inside());
    case "fractionally_sized_box": {
      const [x, y] = alignOf(data.alignment, "center");
      return make(
        { display: "flex", justifyContent: x, alignItems: y, width: "100%" },
        [h("div", { style: { width: data.widthFactor === undefined ? "auto" : `${data.widthFactor * 100}%`, ...(data.heightFactor === undefined ? {} : { height: `${data.heightFactor * 100}%` }) } }, inside())],
      );
    }
    case "constrained_box":
      return make(
        {
          ...(px(data.minWidth) ? { minWidth: px(data.minWidth)! } : {}),
          ...(px(data.maxWidth) ? { maxWidth: px(data.maxWidth)! } : {}),
          ...(px(data.minHeight) ? { minHeight: px(data.minHeight)! } : {}),
          ...(px(data.maxHeight) ? { maxHeight: px(data.maxHeight)! } : {}),
        },
        inside(),
      );
    case "fitted_box": {
      const [x, y] = alignOf(data.alignment, "center");
      // The real widget scales its contents; here they are kept inside the space, which is the common result.
      return make({ display: "flex", justifyContent: x, alignItems: y, overflow: "hidden", maxWidth: "100%" }, inside());
    }
    case "wrap": {
      const vertical = data.direction === "vertical";
      return make(
        {
          display: "flex",
          flexWrap: "wrap",
          flexDirection: vertical ? "column" : "row",
          justifyContent: MAIN[data.alignment] ?? "flex-start",
          alignContent: MAIN[data.runAlignment] ?? "flex-start",
          alignItems: CROSS[data.crossAxisAlignment] ?? "flex-start",
          columnGap: `${data.spacing === undefined ? 0 : helpers.space(data.spacing)}px`,
          rowGap: `${data.runSpacing === undefined ? 0 : helpers.space(data.runSpacing)}px`,
        },
        inside(),
      );
    }
    case "single_child_scroll_view": {
      const sideways = data.scrollDirection === "horizontal";
      return make({ ...(sideways ? { overflowX: "auto" } : { overflowY: "auto" }), padding: sides(data.padding, helpers) ?? "0px", scrollbarWidth: "none" }, inside());
    }
    case "list_view": {
      const sideways = data.scrollDirection === "horizontal";
      return make(
        {
          display: "flex",
          flexDirection: sideways ? "row" : "column",
          gap: `${gap}px`,
          padding: sides(data.padding, helpers) ?? "0px",
          ...(sideways ? { overflowX: "auto", alignItems: "flex-start" } : {}),
          ...(typeof data.height === "number" ? { height: `${data.height}px`, ...(sideways ? {} : { overflowY: "auto" }) } : {}),
        },
        inside(),
      );
    }
    case "grid_view": {
      const ratio = typeof data.childAspectRatio === "number" && data.childAspectRatio > 0 ? data.childAspectRatio : 1;
      const mainGap = data.mainAxisSpacing === undefined ? 0 : helpers.space(data.mainAxisSpacing);
      const crossGap = data.crossAxisSpacing === undefined ? 0 : helpers.space(data.crossAxisSpacing);
      return make(
        {
          display: "grid",
          gridTemplateColumns: `repeat(${data.crossAxisCount ?? 2}, minmax(0, 1fr))`,
          rowGap: `${mainGap}px`,
          columnGap: `${crossGap}px`,
          padding: sides(data.padding, helpers) ?? "0px",
          ...(typeof data.height === "number" ? { height: `${data.height}px`, overflowY: "auto", alignContent: "start" } : {}),
        },
        inside().map((child) => h("div", { style: { aspectRatio: String(ratio), overflow: "hidden", minWidth: "0" } }, [child])),
      );
    }
    case "indexed_stack": {
      const shown = inside()[typeof data.index === "number" ? data.index : 0];
      return make({}, shown ? [shown] : []);
    }
    case "opacity":
      return make({ opacity: String(data.opacity ?? 1) }, inside());
    case "transform": {
      const [ox, oy] = POINT(data.alignment, "center");
      const flip = data.flipX ? -1 : 1;
      const scale = typeof data.scale === "number" ? data.scale : 1;
      return make(
        {
          transform: `translate(${data.translateX ?? 0}px, ${data.translateY ?? 0}px) rotate(${data.rotate ?? 0}deg) scale(${(data.scaleX ?? scale) * flip}, ${data.scaleY ?? scale})`,
          transformOrigin: `${50 + ox * 50}% ${50 + oy * 50}%`,
        },
        inside(),
      );
    }
    case "rotated_box": {
      const turns = typeof data.quarterTurns === "number" ? data.quarterTurns : 0;
      return make({ display: "inline-block", transform: `rotate(${turns * 90}deg)` }, inside());
    }
    case "clip":
      return make(
        {
          overflow: "hidden",
          ...(data.shape === "oval" ? { borderRadius: "50%" } : data.shape === "rect" ? {} : { borderRadius: `${data.radius === undefined ? 8 : helpers.space(data.radius)}px` }),
        },
        inside(),
      );
    case "box": {
      const gradient = gradientCss(data.gradient, helpers);
      const colour = helpers.colour(data.color);
      const [x, y] = alignOf(data.alignment);
      const width = length(data.width);
      const height = length(data.height);
      return make(
        {
          ...(width ? { width } : {}),
          ...(height ? { height } : {}),
          ...(data.alignment ? { display: "flex", justifyContent: x, alignItems: y } : {}),
          ...(data.padding ? { padding: sides(data.padding, helpers)! } : {}),
          ...(data.margin ? { margin: sides(data.margin, helpers)! } : {}),
          ...(colour ? { backgroundColor: colour } : {}),
          ...(gradient ? { backgroundImage: gradient } : {}),
          ...(typeof data.backgroundImageUrl === "string" ? { backgroundImage: `${gradient ? gradient + "," : ""}url("${data.backgroundImageUrl}")`, backgroundSize: data.backgroundFit === "contain" ? "contain" : "cover", backgroundPosition: "center" } : {}),
          ...(data.shape === "circle" ? { borderRadius: "50%" } : data.borderRadius !== undefined ? { borderRadius: `${helpers.space(data.borderRadius)}px` } : {}),
          ...(data.borderWidth || data.borderColor ? { border: `${data.borderWidth ?? 1}px solid ${helpers.colour(data.borderColor) ?? "rgba(0,0,0,.2)"}` } : {}),
          ...(Array.isArray(data.shadows) && data.shadows.length ? { boxShadow: data.shadows.map((each: Data) => SHADOW_CSS(each, helpers.colour)).join(", ") } : {}),
          ...(data.shape === "circle" || data.borderRadius !== undefined ? { overflow: "hidden" } : {}),
          boxSizing: "border-box",
        },
        inside(),
      );
    }
    case "visibility": {
      if (data.visible !== false) return make({}, inside());
      // Hidden in the app. While editing it stays on the canvas, faint and dashed, so it can still be found.
      if (helpers.editable) return make({ opacity: "0.3", outline: "1px dashed currentColor" }, inside());
      return make(data.maintainSpace ? { visibility: "hidden" } : { display: "none" }, inside());
    }
    case "backdrop_blur":
      return make({ backdropFilter: `blur(${data.sigma ?? 8}px)`, WebkitBackdropFilter: `blur(${data.sigma ?? 8}px)` }, inside());
    case "ink_well":
      return make({ cursor: "pointer", ...(data.borderRadius !== undefined ? { borderRadius: `${helpers.space(data.borderRadius)}px`, overflow: "hidden" } : {}) }, inside());
    case "safe_area":
      return make({}, inside());
    default:
      return undefined;
  }
}
