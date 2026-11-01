import { describe, expect, it } from "vitest";
import { builtInCatalogue } from "../src/registry";
import { filterForClient } from "../src/sdui";
import { compareVersions } from "../src/version";
import type { ClientInfo } from "../src/types";
import { page, screen, widget } from "./helpers";

// A client that can draw every built-in widget (version 1).
const supportedWidgets = Object.fromEntries(Object.keys(builtInCatalogue.types).map((type) => [type, [1]]));
const client = (changes: Partial<ClientInfo> = {}): ClientInfo => ({
  appVersion: "1.2.0",
  supportedWidgets,
  country: "AE",
  now: new Date("2026-11-15T12:00:00Z"),
  ...changes,
});

const text = (id: string, extra: Record<string, unknown> = {}) => ({ id, type: "text", v: 1, data: { text: id }, ...extra });
const idsOf = (document: any) => document.sections.flatMap((section: any) => section.widgets.map((w: any) => w.id));

describe("compareVersions", () => {
  it("compares numbers, not text", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.2.0", "1.2.0")).toBe(0);
    expect(compareVersions("0.9.9", "1.0.0")).toBeLessThan(0);
  });
  it("ignores a build or beta suffix", () => expect(compareVersions("1.2.0+45", "1.2.0")).toBe(0));
  it("explains a version it cannot read", () => expect(() => compareVersions("one", "1.0.0")).toThrow('"one" is not a version like 1.2.0'));
});

describe("filterForClient: rules", () => {
  it("keeps widgets with no rules", () => {
    expect(idsOf(filterForClient(page(text("a"), text("b")), client()))).toEqual(["a", "b"]);
  });

  it("keeps a widget when the country matches and hides it otherwise", () => {
    const document = page(text("a", { rules: { countries: ["AE", "SA"] } }));
    expect(idsOf(filterForClient(document, client({ country: "AE" })))).toEqual(["a"]);
    expect(idsOf(filterForClient(document, client({ country: "IN" })))).toEqual([]);
    expect(idsOf(filterForClient(document, client({ country: undefined })))).toEqual([]);
  });

  it("hides a widget from apps that are too old", () => {
    const document = page(text("a", { rules: { minAppVersion: "1.2.0" } }));
    expect(idsOf(filterForClient(document, client({ appVersion: "1.2.0" })))).toEqual(["a"]);
    expect(idsOf(filterForClient(document, client({ appVersion: "1.1.9" })))).toEqual([]);
  });

  it("shows a widget only inside its schedule (the end time is exclusive)", () => {
    const document = page(text("a", { rules: { from: "2026-11-01T00:00:00Z", to: "2026-12-01T00:00:00Z" } }));
    const at = (iso: string) => idsOf(filterForClient(document, client({ now: new Date(iso) })));
    expect(at("2026-10-31T23:59:59Z")).toEqual([]);
    expect(at("2026-11-01T00:00:00Z")).toEqual(["a"]);
    expect(at("2026-11-30T23:59:59Z")).toEqual(["a"]);
    expect(at("2026-12-01T00:00:00Z")).toEqual([]);
  });

  it("matches the audience the host app defines", () => {
    const document = page(text("a", { rules: { audience: { careType: ["home", "clinic"], plan: ["gold"] } } }));
    const withAudience = (audience: ClientInfo["audience"]) => idsOf(filterForClient(document, client({ audience })));
    expect(withAudience({ careType: "home", plan: ["gold", "silver"] })).toEqual(["a"]);
    expect(withAudience({ careType: "home" })).toEqual([]); // plan is missing
    expect(withAudience({ careType: "video", plan: "gold" })).toEqual([]);
    expect(withAudience(undefined)).toEqual([]);
  });

  it("does not use the fallback when rules hide a widget (rules mean 'do not show')", () => {
    const document = page(text("a", { rules: { countries: ["US"] }, fallback: text("backup") }));
    expect(idsOf(filterForClient(document, client()))).toEqual([]);
  });
});

describe("filterForClient: what the app can draw", () => {
  it("removes a widget type the app does not support", () => {
    const document = page(text("a"), widget("banner", { imageUrl: "https://example.com/a.jpg" }, { id: "b" }));
    const old = client({ supportedWidgets: { text: [1] } });
    expect(idsOf(filterForClient(document, old))).toEqual(["a"]);
  });

  it("removes a version the app does not support", () => {
    const document = page({ ...text("a"), v: 2 });
    expect(idsOf(filterForClient(document, client()))).toEqual([]);
  });

  it("draws the fallback when the app cannot draw the widget", () => {
    const banner = widget("banner", { imageUrl: "https://example.com/a.jpg" }, { id: "b", fallback: text("backup") });
    const result: any = filterForClient(page(banner), client({ supportedWidgets: { text: [1] } }));
    expect(idsOf(result)).toEqual(["backup"]);
  });

  it("follows a chain of fallbacks and drops the widget if none can be drawn", () => {
    const banner = widget("banner", { imageUrl: "https://example.com/a.jpg" }, {
      id: "b",
      fallback: widget("carousel", { items: [text("x")] }, { id: "c", fallback: text("last") }),
    });
    expect(idsOf(filterForClient(page(banner), client({ supportedWidgets: { text: [1] } })))).toEqual(["last"]);
    expect(idsOf(filterForClient(page(banner), client({ supportedWidgets: {} })))).toEqual([]);
  });

  it("filters widgets inside cards, carousels, lists, grids and tabs", () => {
    const hidden = { rules: { countries: ["US"] } };
    const document = page(
      widget("carousel", { items: [text("c1"), text("c2", hidden)] }, { id: "carousel" }),
      widget("tabs", { tabs: [{ id: "t", label: "T", widgets: [text("t1"), text("t2", hidden)] }] }, { id: "tabs" }),
      widget("card", { title: "Card", children: [text("k1", hidden)] }, { id: "card" }),
    );
    const result: any = filterForClient(document, client());
    const [carousel, tabs, card] = result.sections[0].widgets;
    expect(carousel.data.items.map((w: any) => w.id)).toEqual(["c1"]);
    expect(tabs.data.tabs[0].widgets.map((w: any) => w.id)).toEqual(["t1"]);
    expect(card.data.children).toEqual([]);
  });

  it("drops a section that ends up with no widgets", () => {
    const document: any = page(text("a", { rules: { countries: ["US"] } }));
    document.sections.push({ id: "second", widgets: [text("b")] });
    const result: any = filterForClient(document, client());
    expect(result.sections.map((section: any) => section.id)).toEqual(["second"]);
  });

  it("keeps a widget type the package does not know if the app says it can draw it", () => {
    const custom = { id: "d", type: "doctor_card", v: 1, data: { name: "Dr A" } };
    const result = filterForClient(page(custom), client({ supportedWidgets: { doctor_card: [1] } }));
    expect(idsOf(result)).toEqual(["d"]);
  });
});

describe("filterForClient: screens and manifests", () => {
  it("removes hidden widget blocks from a screen", () => {
    const root = {
      block: "column",
      children: [
        { block: "text", text: "Hello" },
        { block: "widget", widget: text("a", { rules: { countries: ["US"] } }) },
        { block: "row", children: [{ block: "widget", widget: text("b") }] },
      ],
    };
    const result: any = filterForClient(screen(root), client());
    expect(result.root.children).toHaveLength(2);
    expect(result.root.children[1].children[0].widget.id).toBe("b");
  });

  it("leaves an empty column if the whole screen root is a hidden widget", () => {
    const root = { block: "widget", widget: text("a", { rules: { countries: ["US"] } }) };
    const result: any = filterForClient(screen(root), client());
    expect(result.root).toEqual({ block: "column", children: [] });
  });

  it("returns a manifest unchanged", () => {
    const manifest: any = { schema: 1, theme: {}, navigation: {} };
    expect(filterForClient(manifest, client())).toEqual(manifest);
  });
});

describe("filterForClient: safety", () => {
  it("does not change the document it was given", () => {
    const document = page(text("a"), text("b", { rules: { countries: ["US"] } }));
    const before = JSON.stringify(document);
    filterForClient(document, client());
    expect(JSON.stringify(document)).toBe(before);
  });
});
