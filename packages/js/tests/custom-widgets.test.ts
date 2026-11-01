import { describe, expect, it } from "vitest";
import { createSdui } from "../src/sdui";
import { builtInCatalogue } from "../src/registry";
import { page, widget } from "./helpers";

const doctorCard = {
  doctor_card: {
    1: {
      schema: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1 },
          specialty: { type: "string" },
          related: { type: "array", items: { $ref: "https://sduikit.dev/schemas/common/widget.json" } },
        },
        required: ["name"],
        additionalProperties: false,
      },
      children: ["related"],
    },
  },
};

describe("apps' own widgets", () => {
  const sdui = createSdui({ extraWidgets: doctorCard });

  it("validates good data for an app's own widget", () => {
    expect(sdui.validate(page(widget("doctor_card", { name: "Dr A", specialty: "Dentist" }))).valid).toBe(true);
  });

  it("reports bad data for an app's own widget with the path", () => {
    const result = sdui.validate(page(widget("doctor_card", { specialty: "Dentist" })));
    expect(result.errors.map((issue) => issue.path)).toEqual(["sections[0].widgets[0].data.name"]);
  });

  it("checks widgets nested inside an app's own widget", () => {
    const inner = widget("text", { text: "" });
    const result = sdui.validate(page(widget("doctor_card", { name: "Dr A", related: [inner] })));
    expect(result.errors.map((issue) => issue.path)).toEqual(["sections[0].widgets[0].data.related[0].data.text"]);
  });

  it("filters widgets nested inside an app's own widget", () => {
    const hidden = { id: "h", type: "text", v: 1, data: { text: "x" }, rules: { countries: ["US"] } };
    const document = page(widget("doctor_card", { name: "Dr A", related: [hidden] }));
    const result: any = sdui.filterForClient(document, {
      appVersion: "1.0.0",
      supportedWidgets: { doctor_card: [1], text: [1] },
      country: "AE",
    });
    expect(result.sections[0].widgets[0].data.related).toEqual([]);
  });

  it("does not leak into the ready-made instance", () => {
    const plain = createSdui();
    expect(plain.validate(page(widget("doctor_card", { name: "Dr A" }))).valid).toBe(false);
  });

  it("refuses to redefine a built-in widget", () => {
    expect(() => createSdui({ extraWidgets: { text: { 1: { schema: { type: "object" } } } } })).toThrow(
      'The widget type "text" is built in and cannot be redefined',
    );
  });

  it("refuses a type name that breaks the naming rule", () => {
    expect(() => createSdui({ extraWidgets: { DoctorCard: { 1: { schema: { type: "object" } } } } })).toThrow(
      'The widget type name "DoctorCard" must be lower_snake_case',
    );
  });

  it("still knows the built-in widgets", () => {
    expect(Object.keys(builtInCatalogue.types)).toContain("text");
    expect(sdui.validate(page(widget("text", { text: "Hi" }))).valid).toBe(true);
  });
});
