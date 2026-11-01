export type SpacingToken = "none" | "xs" | "sm" | "md" | "lg" | "xl";
export type RadiusToken = "none" | "sm" | "md" | "lg" | "full";
export type ColorToken =
  | "primary" | "onPrimary" | "secondary" | "onSecondary"
  | "background" | "onBackground" | "surface" | "onSurface"
  | "muted" | "success" | "warning" | "error";
export type TextSizeToken = "caption" | "body" | "title" | "headline" | "display";
export type AlignToken = "start" | "center" | "end";

/** A preset name follows the app's theme; a number or "#RRGGBB" is used exactly as given. */
export type Space = SpacingToken | number;
export type Sides = { top?: Space; right?: Space; bottom?: Space; left?: Space };
export type Colour = ColorToken | string; // a ColorToken or "#RRGGBB" / "#RRGGBBAA"

/** One look: everything a widget (or one part of a widget) can be told about how it is drawn. */
export interface StyleLook {
  spacing?: Space;
  padding?: Sides;
  margin?: Sides;
  radius?: RadiusToken | number;
  color?: Colour;
  textColor?: Colour;
  textSize?: TextSizeToken | number;
  fontWeight?: "normal" | "medium" | "bold";
  italic?: boolean;
  textDecoration?: "none" | "underline" | "lineThrough" | "overline";
  letterSpacing?: number;
  lineHeight?: number;
  maxLines?: number;
  textOverflow?: "clip" | "ellipsis" | "fade" | "visible";
  softWrap?: boolean;
  overflow?: "visible" | "hidden";
  align?: AlignToken;
  width?: number | "fill";
  height?: number | "fill";
  borderWidth?: number;
  borderColor?: Colour;
  shadow?: "none" | "small" | "medium" | "large";
  opacity?: number;
}

/** A widget's style: its own look, plus a look for each named part inside it (`parts: { title: { textSize: 20 } }`). */
export interface Style extends StyleLook {
  parts?: Record<string, StyleLook>;
}

export type Action =
  | { type: "open_screen"; screenId: string }
  | { type: "open_sheet"; screenId: string }
  | { type: "open_url"; url: string; external?: boolean }
  | { type: "open_native"; name: string; params?: Record<string, unknown> }
  | { type: "call_api"; name: string; params?: Record<string, unknown> }
  | { type: "share"; text: string; url?: string }
  | { type: "dismiss" };

export interface Rules {
  countries?: string[];
  // The host app decides the keys. A client matches when, for every key, it has at least one listed value.
  audience?: Record<string, string[]>;
  minAppVersion?: string;
  from?: string;
  to?: string; // exclusive
}

export interface Widget {
  id: string;
  type: string;
  v: number;
  data: Record<string, any>;
  style?: Style;
  action?: Action;
  analytics?: { event: string; params?: Record<string, unknown> };
  rules?: Rules;
  fallback?: Widget | null;
}

export interface Section {
  id: string;
  title?: string;
  widgets: Widget[];
}

export interface Page {
  schema: 1;
  id: string;
  revision: string;
  title?: string;
  sections: Section[];
}

export type Block =
  | { block: "column" | "row"; children: Block[]; gap?: SpacingToken; style?: Style; action?: Action }
  | { block: "stack"; children: Block[]; style?: Style; action?: Action }
  | { block: "grid"; columns: number; children: Block[]; gap?: SpacingToken; style?: Style }
  | { block: "scroll"; children: Block[]; style?: Style }
  | { block: "text"; text: string; style?: Style; action?: Action }
  | { block: "image"; url: string; alt?: string; aspectRatio?: number; fit?: "cover" | "contain"; style?: Style; action?: Action }
  | { block: "button"; label: string; variant?: "filled" | "outline" | "text"; style?: Style; action?: Action }
  | { block: "spacer"; size: SpacingToken }
  | { block: "divider"; style?: Style }
  | { block: "widget"; widget: Widget };

export interface Screen {
  schema: 1;
  id: string;
  revision: string;
  title?: string;
  root: Block;
}

type Palette = Record<ColorToken, string>;

export interface Manifest {
  schema: 1;
  minAppVersion?: string;
  theme: {
    light: Palette;
    dark: Palette;
    fonts: { body: string; heading: string };
    textSizes: Record<TextSizeToken, number>;
    spacing: Record<SpacingToken, number>;
    radii: Record<RadiusToken, number>;
  };
  navigation: {
    bottomBar: Array<{ id: string; label: string; icon: string; pageId: string }>;
    pages: Array<{
      id: string;
      title: string;
      icon?: string;
      tabs?: Array<{ id: string; label: string; pageId: string }>;
    }>;
  };
  killSwitches?: { widgets?: string[]; actions?: string[] };
}

// Describes the app that is asking for a page.
export interface ClientInfo {
  appVersion: string; // like "1.2.0" ("1.2.0+45" and "1.2.0-beta" are accepted too)
  // Which widget types and versions this app can draw, e.g. { text: [1], banner: [1, 2] }.
  supportedWidgets: Record<string, number[]>;
  country?: string; // like "AE"
  audience?: Record<string, string | string[]>;
  now?: Date; // defaults to the current time; pass it in tests
}
