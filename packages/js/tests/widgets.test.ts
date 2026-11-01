import { describe, expect, it } from "vitest";
import { schemaFiles } from "../src/generated/schemas";
import { builtInCatalogue, createRegistry, SCHEMA_BASE } from "../src/registry";

const registry = createRegistry();
const sampleText = { id: "t1", type: "text", v: 1, data: { text: "Hello" } };

// [type, data that is valid, data that is not valid]
const cases: Array<[string, unknown, unknown]> = [
  ["text", { text: "Hello", maxLines: 2 }, {}],
  ["image", { url: "https://example.com/a.jpg", alt: "A", aspectRatio: 1.5, fit: "cover" }, { url: "not a url" }],
  ["button", { label: "Go", variant: "outline" }, { label: "Go", variant: "huge" }],
  ["spacer", { size: "md" }, { size: "12px" }],
  ["divider", {}, { color: "red" }],
  ["section_header", { title: "Title", subtitle: "Sub", actionLabel: "See all" }, { subtitle: "Sub" }],
  ["card", { title: "Title", children: [sampleText] }, {}],
  ["banner", { imageUrl: "https://example.com/a.jpg", title: "Hi" }, { title: "Hi" }],
  ["carousel", { items: [sampleText], autoplay: true, viewportFraction: 0.8 }, { items: [] }],
  ["list", { items: [sampleText], dividers: true }, {}],
  ["grid", { columns: 2, items: [sampleText] }, { items: [sampleText] }],
  ["tabs", { tabs: [{ id: "a", label: "A", widgets: [sampleText] }] }, { tabs: [] }],
  [
    "data_list",
    { source: { name: "doctors_nearby", params: { city: "Dubai" } }, template: [sampleText], layout: "grid", columns: 2 },
    { source: { name: "doctors_nearby" }, template: [sampleText, sampleText] }, // only one template allowed
  ],
  ["rich_text", { spans: [{ text: "Hi", bold: true, color: "primary" }] }, { spans: [] }],
  ["quote", { text: "Great", author: "Sam" }, { author: "Sam" }],
  ["icon", { name: "star", size: "large" }, { name: "nope" }],
  ["avatar", { initials: "AB" }, {}],
  ["badge", { label: "New", tone: "success" }, { label: "New", tone: "loud" }],
  ["alert", { message: "Careful", tone: "warning" }, { title: "No message" }],
  ["progress", { value: 0.5, shape: "circular" }, { value: 2 }],
  ["stat", { label: "Orders", value: "128", trend: "up" }, { label: "Orders" }],
  ["key_value", { rows: [{ label: "a", value: "b" }] }, { rows: [] }],
  ["list_item", { title: "Settings", chevron: true }, { subtitle: "no title" }],
  ["empty_state", { title: "Nothing here" }, { message: "no title" }],
  ["steps", { steps: [{ title: "One", state: "done" }] }, { steps: [{ title: "One", state: "later" }] }],
  ["accordion", { items: [{ title: "Q", widgets: [sampleText] }] }, { items: [{ title: "Q" }] }],
  ["table", { columns: ["A"], rows: [["1"]] }, { columns: [], rows: [] }],
  ["countdown", { until: "2026-12-01T00:00:00Z" }, { until: "soon" }],
  ["gallery", { images: [{ url: "https://example.com/a.jpg" }] }, { images: [] }],
  ["video_card", { thumbnailUrl: "https://example.com/a.jpg" }, { title: "no picture" }],
  ["hero", { imageUrl: "https://example.com/a.jpg", title: "Big" }, { title: "no picture" }],
  ["pricing_card", { name: "Team", price: "$9" }, { name: "no price" }],
  ["search_bar", { placeholder: "Search" }, {}],
  ["chips", { chips: [{ label: "A" }] }, { chips: [{ selected: true }] }],
  ["quick_actions", { items: [{ label: "A", icon: "home" }] }, { items: [{ label: "A", icon: "nope" }] }],
  ["rating", { value: 4.5, count: 10 }, { value: 6 }],
  ["container", { children: [sampleText], direction: "horizontal" }, { children: [] }],
  [
    "form",
    { submitLabel: "Send", fields: [{ name: "email", type: "email", label: "Email", required: true }] },
    { submitLabel: "Send", fields: [{ name: "1bad", type: "email", label: "x" }] },
  ],
];

describe("widget schemas", () => {
  it("has a test case for every type in the catalogue", () => {
    expect(cases.map(([type]) => type).sort()).toEqual(Object.keys(builtInCatalogue.types).sort());
  });

  it.each(cases)("%s accepts good data", (type, good) => {
    const info = registry.lookup(type, 1);
    expect(info, `${type} v1 is missing from the catalogue`).toBeDefined();
    expect(info!.validateData(good), JSON.stringify(info!.validateData.errors)).toBe(true);
  });

  it.each(cases)("%s rejects bad data", (type, _good, bad) => {
    expect(registry.lookup(type, 1)!.validateData(bad)).toBe(false);
  });
});

describe("catalogue", () => {
  const versions = Object.entries(builtInCatalogue.types).flatMap(([type, entry]) =>
    Object.entries(entry.versions).map(([v, info]) => ({ type, v, ...info })),
  );

  it("points every version at a schema file that exists and has the matching $id", () => {
    for (const info of versions) {
      const file = schemaFiles[info.schema] as { $id?: string } | undefined;
      expect(file, `${info.schema} is missing`).toBeDefined();
      expect(file!.$id).toBe(SCHEMA_BASE + info.schema);
    }
  });

  it("lists every file in schemas/widgets (no orphan schema files)", () => {
    const listed = new Set(versions.map((info) => info.schema));
    const onDisk = Object.keys(schemaFiles).filter((name) => name.startsWith("widgets/"));
    expect(onDisk.sort()).toEqual([...listed].sort());
  });

  it("names a first package version for each widget", () => {
    for (const info of versions) expect(info.since).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("registry lookups", () => {
  it("finds a known type and version", () => {
    expect(registry.lookup("text", 1)).toBeDefined();
    expect(registry.lookup("tabs", 1)!.children).toEqual(["tabs[].widgets"]);
  });
  it("does not find an unknown version or type", () => {
    expect(registry.lookup("text", 2)).toBeUndefined();
    expect(registry.lookup("hologram", 1)).toBeUndefined();
  });
  it("lists the known versions of a type", () => {
    expect(registry.knownVersions("text")).toEqual([1]);
    expect(registry.knownVersions("hologram")).toEqual([]);
  });
});
