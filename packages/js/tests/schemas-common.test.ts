import { describe, expect, it } from "vitest";
import { compileSchema } from "./helpers";

describe("style", () => {
  const style = compileSchema("common/style.json");

  it("accepts token names", () => {
    expect(
      style({ spacing: "md", radius: "lg", color: "primary", textColor: "onPrimary", textSize: "title", align: "center" }),
    ).toBe(true);
  });
  it("rejects pixel values", () => expect(style({ spacing: "12px" })).toBe(false));
  it("accepts exact values as well as names", () => {
    expect(style({ color: "#ff0000", textColor: "#FFFFFF80", spacing: 13, radius: 999, textSize: 17, borderColor: "#00000033" })).toBe(true);
    expect(style({ padding: { top: 4, left: "lg" }, margin: { bottom: 30 }, width: 240, height: "fill", borderWidth: 2 })).toBe(true);
    expect(style({ fontWeight: "bold", italic: true, shadow: "large", opacity: 0.5 })).toBe(true);
  });
  it("rejects bad exact values", () => {
    for (const bad of [
      { color: "#ff00" },
      { color: "#gggggg" },
      { color: "red" },
      { spacing: -1 },
      { spacing: 500 },
      { textSize: 2 },
      { opacity: 2 },
      { shadow: "huge" },
      { width: "wide" },
      { padding: {} },
      { padding: { middle: 4 } },
      { borderWidth: 50 },
    ]) expect(style(bad), JSON.stringify(bad)).toBe(false);
  });
  it("still rejects pixel strings and keys it does not know", () => {
    expect(style({ spacing: "12px" })).toBe(false);
    expect(style({ gap: 4 })).toBe(false);
  });
});

describe("action", () => {
  const action = compileSchema("common/action.json");

  it.each([
    [{ type: "open_screen", screenId: "offers" }],
    [{ type: "open_sheet", screenId: "filters" }],
    [{ type: "open_url", url: "https://example.com", external: true }],
    [{ type: "open_native", name: "booking", params: { source: "home" } }],
    [{ type: "call_api", name: "start_booking" }],
    [{ type: "share", text: "Look at this", url: "https://example.com" }],
    [{ type: "dismiss" }],
  ])("accepts %j", (value) => expect(action(value)).toBe(true));

  it("rejects an open_screen with no screenId", () => expect(action({ type: "open_screen" })).toBe(false));
  it("rejects an open_url that is not a URL", () => expect(action({ type: "open_url", url: "nope" })).toBe(false));
  it("rejects an unknown action type", () => expect(action({ type: "explode" })).toBe(false));
  it("rejects extra keys", () => expect(action({ type: "dismiss", force: true })).toBe(false));
});

describe("rules", () => {
  const rules = compileSchema("common/rules.json");

  it("accepts a full set of rules", () => {
    expect(
      rules({
        countries: ["AE", "IN"],
        audience: { careType: ["home", "clinic"] },
        minAppVersion: "1.2.0",
        from: "2026-11-01T00:00:00Z",
        to: "2026-12-01T00:00:00Z",
      }),
    ).toBe(true);
  });
  it("rejects lower-case country codes", () => expect(rules({ countries: ["ae"] })).toBe(false));
  it("rejects an empty country list", () => expect(rules({ countries: [] })).toBe(false));
  it("rejects a version with only two numbers", () => expect(rules({ minAppVersion: "1.2" })).toBe(false));
  it("rejects a date that is not a date", () => expect(rules({ from: "yesterday" })).toBe(false));
  it("rejects an audience value that is not a list", () => expect(rules({ audience: { careType: "home" } })).toBe(false));
});

describe("widget envelope", () => {
  const widget = compileSchema("common/widget.json");
  const minimal = { id: "w1", type: "text", v: 1, data: {} };

  it("accepts the smallest widget", () => expect(widget(minimal)).toBe(true));
  it("accepts a null fallback", () => expect(widget({ ...minimal, fallback: null })).toBe(true));
  it("accepts a widget as fallback", () => {
    expect(widget({ ...minimal, fallback: { id: "w2", type: "text", v: 1, data: {} } })).toBe(true);
  });
  it("rejects a fallback that is not a widget", () => expect(widget({ ...minimal, fallback: { id: "w2" } })).toBe(false));
  it("rejects a missing id", () => expect(widget({ type: "text", v: 1, data: {} })).toBe(false));
  it("rejects a type name that is not lower_snake_case", () => expect(widget({ ...minimal, type: "Banner" })).toBe(false));
  it("rejects version 0", () => expect(widget({ ...minimal, v: 0 })).toBe(false));
  it("rejects a missing data object", () => expect(widget({ id: "w1", type: "text", v: 1 })).toBe(false));
  it("rejects keys it does not know", () => expect(widget({ ...minimal, colour: "red" })).toBe(false));
  it("requires an analytics event name", () => expect(widget({ ...minimal, analytics: {} })).toBe(false));
});
