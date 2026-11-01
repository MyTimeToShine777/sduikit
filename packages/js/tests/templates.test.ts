import { describe, expect, it } from "vitest";
import { createSdui } from "../src/sdui";
import { withSamplePlaceholders } from "../src/templates";
import { page, widget } from "./helpers";
import { validate } from "../src/index";

describe("withSamplePlaceholders", () => {
  it("turns a text that is only a placeholder into a web address", () => {
    expect(withSamplePlaceholders("{{photoUrl}}")).toBe("https://example.com/sample");
    expect(withSamplePlaceholders("{{ doctor.photo }}")).toBe("https://example.com/sample");
  });
  it("turns placeholders inside other text into a plain word", () => {
    expect(withSamplePlaceholders("{{specialty}} · {{fee}} AED")).toBe("x · x AED");
    expect(withSamplePlaceholders("https://cdn.example.com/{{id}}.jpg")).toBe("https://cdn.example.com/x.jpg");
  });
  it("works through lists and objects and leaves other values alone", () => {
    expect(withSamplePlaceholders({ a: ["{{x}}", 3, true, null], b: { c: "plain" } })).toEqual({
      a: ["https://example.com/sample", 3, true, null],
      b: { c: "plain" },
    });
  });
});

const row = (data: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  widget("card", data, { id: "row", ...extra });
const dataList = (template: unknown[], data: Record<string, unknown> = {}) =>
  widget("data_list", { source: { name: "doctors_nearby" }, template, ...data });

describe("validate: data_list templates", () => {
  it("accepts placeholders in text, web addresses and action params inside a template", () => {
    const result = validate(
      page(
        dataList([
          row(
            { title: "{{name}}", subtitle: "{{specialty}} · {{fee}} AED", imageUrl: "{{photoUrl}}" },
            { action: { type: "open_native", name: "doctor_profile", params: { doctorId: "{{id}}" } } },
          ),
        ]),
      ),
    );
    expect(result.errors).toEqual([]);
  });

  it("does not accept the same placeholder outside a template", () => {
    const result = validate(page(row({ title: "A", imageUrl: "{{photoUrl}}" })));
    expect(result.errors.map((issue) => issue.path)).toContain("sections[0].widgets[0].data.imageUrl");
  });

  it("still finds real mistakes inside a template", () => {
    const result = validate(page(dataList([row({ title: "{{name}}", colour: "red" })])));
    expect(result.errors.map((issue) => issue.path)).toEqual(["sections[0].widgets[0].data.template[0].data.colour"]);
  });

  it("still finds a wrong value that is not a placeholder", () => {
    const result = validate(page(dataList([widget("text", { text: "" })])));
    expect(result.errors[0].path).toBe("sections[0].widgets[0].data.template[0].data.text");
    expect(result.errors[0].message).toContain("Must not be empty");
  });

  it("allows placeholders in widgets nested inside the template", () => {
    const inner = widget("text", { text: "Dr {{name}}" }, { id: "inner" });
    const result = validate(page(dataList([row({ title: "Card", children: [inner] })])));
    expect(result.errors).toEqual([]);
  });

  it("needs a source and exactly one template", () => {
    const missing = validate(page(widget("data_list", { template: [widget("text", { text: "a" })] })));
    expect(missing.errors.map((issue) => issue.path)).toContain("sections[0].widgets[0].data.source");
    const two = validate(page(dataList([widget("text", { text: "a" }), widget("text", { text: "b" })])));
    expect(two.errors.map((issue) => issue.message)).toContain("Must have at most 1 items.");
  });
});

describe("an app's own widget with a template", () => {
  const sdui = createSdui({
    extraWidgets: {
      repeater: {
        1: {
          schema: {
            type: "object",
            properties: { rows: { type: "array", items: { $ref: "https://sduikit.dev/schemas/common/widget.json" } } },
            required: ["rows"],
          },
          children: ["rows"],
          templates: ["rows"],
        },
      },
    },
  });

  it("allows placeholders only in the lists it names as templates", () => {
    const ok = sdui.validate(page(widget("repeater", { rows: [widget("text", { text: "{{name}}" })] })));
    expect(ok.valid).toBe(true);
    const outside = sdui.validate(page(widget("card", { title: "A", imageUrl: "{{x}}" })));
    expect(outside.valid).toBe(false);
  });
});
