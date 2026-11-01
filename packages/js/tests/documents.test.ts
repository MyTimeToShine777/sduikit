import { describe, expect, it } from "vitest";
import { schemaFiles } from "../src/generated/schemas";
import { builtInCatalogue } from "../src/registry";
import { compileSchema, loadFixture } from "./helpers";

const checkPage = compileSchema("page.json");
const checkScreen = compileSchema("screen.json");
const checkManifest = compileSchema("manifest.json");

describe("fixtures", () => {
  it("page-home is a valid page", () => {
    expect(checkPage(loadFixture("valid/page-home.json")), JSON.stringify(checkPage.errors)).toBe(true);
  });
  it("screen-offers is a valid screen", () => {
    expect(checkScreen(loadFixture("valid/screen-offers.json")), JSON.stringify(checkScreen.errors)).toBe(true);
  });
  it("manifest is a valid manifest", () => {
    expect(checkManifest(loadFixture("valid/manifest.json")), JSON.stringify(checkManifest.errors)).toBe(true);
  });

  // The fixtures are also used by the Flutter tests, so they should show everything.
  const documents = [
    loadFixture("valid/page-home.json"),
    loadFixture("valid/page-showcase.json"),
    loadFixture("valid/screen-offers.json"),
  ];

  it("page-showcase is a valid page", () => {
    expect(checkPage(loadFixture("valid/page-showcase.json")), JSON.stringify(checkPage.errors)).toBe(true);
  });

  function collect(value: unknown, found: { widgets: Set<string>; blocks: Set<string>; actions: Set<string> }) {
    if (Array.isArray(value)) value.forEach((item) => collect(item, found));
    else if (value && typeof value === "object") {
      const object = value as Record<string, unknown>;
      if (typeof object.type === "string" && typeof object.v === "number") found.widgets.add(object.type);
      if (typeof object.block === "string") found.blocks.add(object.block);
      if (typeof object.action === "object" && object.action) found.actions.add((object.action as { type: string }).type);
      Object.values(object).forEach((item) => collect(item, found));
    }
  }
  const found = { widgets: new Set<string>(), blocks: new Set<string>(), actions: new Set<string>() };
  documents.forEach((document) => collect(document, found));

  it("use every widget type in the catalogue", () => {
    expect([...found.widgets].sort()).toEqual(Object.keys(builtInCatalogue.types).sort());
  });
  it("use every block", () => {
    const blockSchema = schemaFiles["blocks/block.json"] as { $defs: Record<string, unknown> };
    expect([...found.blocks].sort()).toEqual(Object.keys(blockSchema.$defs).sort());
  });
  it("use every action", () => {
    const actionSchema = schemaFiles["common/action.json"] as { $defs: Record<string, unknown> };
    expect([...found.actions].sort()).toEqual(Object.keys(actionSchema.$defs).sort());
  });
});

describe("page", () => {
  const page = () => loadFixture("valid/page-home.json");

  it("needs a revision", () => {
    const broken = page();
    delete broken.revision;
    expect(checkPage(broken)).toBe(false);
  });
  it("only accepts schema 1", () => expect(checkPage({ ...page(), schema: 2 })).toBe(false));
  it("rejects a section with no id", () => {
    expect(checkPage({ ...page(), sections: [{ widgets: [] }] })).toBe(false);
  });
});

describe("screen and blocks", () => {
  const screen = () => loadFixture("valid/screen-offers.json");

  it("rejects a block name it does not know", () => {
    expect(checkScreen({ ...screen(), root: { block: "carousel", children: [] } })).toBe(false);
  });
  it("rejects a text block with no text", () => {
    expect(checkScreen({ ...screen(), root: { block: "text" } })).toBe(false);
  });
  it("rejects a grid with zero columns", () => {
    expect(checkScreen({ ...screen(), root: { block: "grid", columns: 0, children: [] } })).toBe(false);
  });
  it("rejects a pixel gap", () => {
    expect(checkScreen({ ...screen(), root: { block: "column", gap: "8px", children: [] } })).toBe(false);
  });
  it("checks blocks nested deep inside", () => {
    const deep = { block: "column", children: [{ block: "row", children: [{ block: "text" }] }] };
    expect(checkScreen({ ...screen(), root: deep })).toBe(false);
  });
});

describe("manifest", () => {
  const manifest = () => loadFixture("valid/manifest.json");

  it("needs every colour token in both modes", () => {
    const broken = manifest();
    delete broken.theme.dark.error;
    expect(checkManifest(broken)).toBe(false);
  });
  it("rejects a colour that is not #RRGGBB", () => {
    const broken = manifest();
    broken.theme.light.primary = "green";
    expect(checkManifest(broken)).toBe(false);
  });
  it("needs at least one bottom bar item", () => {
    const broken = manifest();
    broken.navigation.bottomBar = [];
    expect(checkManifest(broken)).toBe(false);
  });
  it("allows at most five bottom bar items", () => {
    const broken = manifest();
    broken.navigation.bottomBar = Array.from({ length: 6 }, (_, index) => ({
      id: `t${index}`, label: "T", icon: "home", pageId: "home",
    }));
    expect(checkManifest(broken)).toBe(false);
  });
  it("lists exactly the colour tokens the style schema allows", () => {
    const tokens = schemaFiles["common/tokens.json"] as { $defs: { color: { enum: string[] } } };
    const paletteSchema = (schemaFiles["manifest.json"] as { $defs: { palette: { required: string[] } } }).$defs.palette;
    expect([...paletteSchema.required].sort()).toEqual([...tokens.$defs.color.enum].sort());
  });
});
