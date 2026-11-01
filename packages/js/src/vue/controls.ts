import { defineComponent, h, ref, watch, type PropType, type VNode } from "vue";
import { tokens } from "../tokens.js";
import type { Action, Style } from "../types.js";

// Small building blocks for edit forms. Each one takes `modelValue` and sends `update:modelValue`
// with a new value (or undefined when the box was emptied), and never changes what it was given.

const isEmptyObject = (value: unknown) => typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0;

function withoutEmpty(object: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && value !== "" && !isEmptyObject(value)));
}

const row = (label: string, control: VNode, key?: string) =>
  h("label", { class: "sdui-form-row", "data-row": key }, [h("span", { class: "sdui-form-label" }, label), control]);

// ── A number or a preset name ──
// "12" becomes the number 12, "md" stays the name "md", anything else is shown in red and not sent.
export const SduiValueInput = defineComponent({
  name: "SduiValueInput",
  props: {
    modelValue: { type: [String, Number] as PropType<string | number | undefined>, default: undefined },
    presets: { type: Array as PropType<readonly string[]>, default: () => [] },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 200 },
    placeholder: { type: String, default: "" },
    name: { type: String, default: "" },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    const bad = ref(false);
    const listId = `sdui-presets-${Math.random().toString(36).slice(2, 8)}`;
    return () =>
      h("span", { class: "sdui-value" }, [
        h("input", {
          type: "text",
          inputmode: "decimal",
          "data-field": props.name || undefined,
          class: bad.value ? "sdui-bad" : undefined,
          list: props.presets.length ? listId : undefined,
          placeholder: props.placeholder,
          value: props.modelValue === undefined ? "" : String(props.modelValue),
          onInput: (event: Event) => {
            const text = (event.target as HTMLInputElement).value.trim();
            if (text === "") {
              bad.value = false;
              emit("update:modelValue", undefined);
            } else if (/^-?\d+(\.\d+)?$/.test(text) && Number(text) >= props.min && Number(text) <= props.max) {
              bad.value = false;
              emit("update:modelValue", Number(text));
            } else if (props.presets.includes(text)) {
              bad.value = false;
              emit("update:modelValue", text);
            } else {
              bad.value = true;
            }
          },
          onBlur: () => (bad.value = false),
        }),
        props.presets.length ? h("datalist", { id: listId }, props.presets.map((preset) => h("option", { value: preset }))) : null,
      ]);
  },
});

// ── A colour: pick, type a "#RRGGBB" code, or choose one of the app's named colours ──
const HEX = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
export const SduiColorInput = defineComponent({
  name: "SduiColorInput",
  props: {
    modelValue: { type: String, default: undefined },
    name: { type: String, default: "" },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    const bad = ref(false);
    return () => {
      const value = props.modelValue;
      const swatch = value && HEX.test(value) ? value.slice(0, 7) : "#888888";
      return h("span", { class: "sdui-color" }, [
        h("input", {
          type: "color",
          value: swatch,
          title: "Pick a colour",
          "data-field": props.name ? `${props.name}-picker` : undefined,
          onInput: (event: Event) => emit("update:modelValue", (event.target as HTMLInputElement).value.toUpperCase()),
        }),
        h("input", {
          type: "text",
          class: bad.value ? "sdui-bad" : undefined,
          "data-field": props.name || undefined,
          placeholder: "#RRGGBB or a name",
          list: "sdui-colour-names",
          value: value ?? "",
          onInput: (event: Event) => {
            const text = (event.target as HTMLInputElement).value.trim();
            if (text === "") {
              bad.value = false;
              emit("update:modelValue", undefined);
            } else if (HEX.test(text) || (tokens.color as readonly string[]).includes(text)) {
              bad.value = false;
              emit("update:modelValue", text);
            } else {
              bad.value = true;
            }
          },
          onBlur: () => (bad.value = false),
        }),
        h("datalist", { id: "sdui-colour-names" }, tokens.color.map((name) => h("option", { value: name }))),
      ]);
    };
  },
});

// ── Free-form JSON in a box (for "params" and anything with no fixed shape) ──
export const SduiJsonBox = defineComponent({
  name: "SduiJsonBox",
  props: {
    modelValue: { type: null as unknown as PropType<any>, default: undefined },
    rows: { type: Number, default: 4 },
    placeholder: { type: String, default: "" },
    expect: { type: String as PropType<"object" | "any">, default: "any" },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    const show = (value: unknown) => (value === undefined ? "" : JSON.stringify(value, null, 2));
    const text = ref(show(props.modelValue));
    const error = ref("");
    const typing = ref(false);
    // Keep the box in step when the value changes from outside (undo, another tab), but not while typing.
    watch(
      () => props.modelValue,
      (value) => {
        if (!typing.value) text.value = show(value);
      },
    );
    return () =>
      h("div", { class: "sdui-json" }, [
        h("textarea", {
          rows: props.rows,
          spellcheck: false,
          placeholder: props.placeholder,
          value: text.value,
          onFocus: () => (typing.value = true),
          onBlur: () => {
            typing.value = false;
            if (!error.value) text.value = show(props.modelValue);
          },
          onInput: (event: Event) => {
            text.value = (event.target as HTMLTextAreaElement).value;
            if (text.value.trim() === "") {
              error.value = "";
              emit("update:modelValue", undefined);
              return;
            }
            try {
              const parsed = JSON.parse(text.value);
              if (props.expect === "object" && (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))) {
                throw new Error('This must be an object, like { "key": "value" }.');
              }
              error.value = "";
              emit("update:modelValue", parsed);
            } catch (problem: any) {
              error.value = problem.message;
            }
          },
        }),
        error.value ? h("small", { class: "sdui-error" }, error.value) : null,
      ]);
  },
});

// ── What happens when a widget is tapped ──
const ACTION_TYPES: Array<[string, string]> = [
  ["", "Nothing happens"],
  ["open_screen", "Open a screen"],
  ["open_sheet", "Open a bottom sheet"],
  ["open_url", "Open a web address"],
  ["open_native", "Open a built-in screen of the app"],
  ["call_api", "Call the app's API"],
  ["share", "Share something"],
  ["dismiss", "Close this screen"],
];
const ACTION_START: Record<string, Action> = {
  open_screen: { type: "open_screen", screenId: "" },
  open_sheet: { type: "open_sheet", screenId: "" },
  open_url: { type: "open_url", url: "" },
  open_native: { type: "open_native", name: "" },
  call_api: { type: "call_api", name: "" },
  share: { type: "share", text: "" },
  dismiss: { type: "dismiss" },
};

export const SduiActionEditor = defineComponent({
  name: "SduiActionEditor",
  props: { modelValue: { type: Object as PropType<Action | undefined>, default: undefined } },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    const set = (key: string, value: unknown) => emit("update:modelValue", withoutEmpty({ ...props.modelValue, [key]: value }) as unknown as Action);
    const textBox = (label: string, key: string, placeholder = "") =>
      row(
        label,
        h("input", {
          type: "text",
          "data-action": key,
          placeholder,
          value: String((props.modelValue as any)?.[key] ?? ""),
          // Required fields stay in the action while empty so the type is kept; the checker says what is missing.
          onInput: (event: Event) => {
            const text = (event.target as HTMLInputElement).value;
            emit("update:modelValue", { ...props.modelValue, [key]: text } as Action);
          },
        }),
      );

    return () => {
      const action = props.modelValue as any;
      const kids: Array<VNode | null> = [
        row(
          "When tapped",
          h(
            "select",
            {
              "data-action": "type",
              value: action?.type ?? "",
              onChange: (event: Event) => {
                const type = (event.target as HTMLSelectElement).value;
                emit("update:modelValue", type ? ACTION_START[type] : undefined);
              },
            },
            ACTION_TYPES.map(([value, label]) => h("option", { value }, label)),
          ),
        ),
      ];
      if (action?.type === "open_screen" || action?.type === "open_sheet") kids.push(textBox("Screen id *", "screenId", "offers"));
      if (action?.type === "open_url") {
        kids.push(textBox("Web address *", "url", "https://example.com"));
        kids.push(
          h("label", { class: "sdui-form-row sdui-form-check" }, [
            h("input", {
              type: "checkbox",
              "data-action": "external",
              checked: action.external === true,
              onChange: (event: Event) => set("external", (event.target as HTMLInputElement).checked || undefined),
            }),
            h("span", "Open in the phone's browser"),
          ]),
        );
      }
      if (action?.type === "open_native") kids.push(textBox("Built-in screen name *", "name"));
      if (action?.type === "call_api") kids.push(textBox("API call name *", "name"));
      if (action?.type === "share") {
        kids.push(textBox("Text to share *", "text"));
        kids.push(textBox("Link (optional)", "url", "https://example.com"));
      }
      if (action?.type === "open_native" || action?.type === "call_api") {
        kids.push(
          h("div", { class: "sdui-form-row" }, [
            h("span", { class: "sdui-form-label" }, "Extra values (JSON)"),
            h(SduiJsonBox, { modelValue: action.params, expect: "object", "onUpdate:modelValue": (value: unknown) => set("params", value) }),
          ]),
        );
      }
      return h("div", { class: "sdui-action" }, kids);
    };
  },
});

// ── The look of a widget: every value can be a name from the theme or an exact value ──
export const SduiStyleEditor = defineComponent({
  name: "SduiStyleEditor",
  props: { modelValue: { type: Object as PropType<Style | undefined>, default: undefined } },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    const style = () => (props.modelValue ?? {}) as Record<string, any>;
    const change = (key: string, value: unknown) => emit("update:modelValue", withoutEmpty({ ...style(), [key]: value }) as Style);

    const value = (label: string, key: string, presets: readonly string[], max = 200, min = 0) =>
      row(
        label,
        h(SduiValueInput, { name: key, presets, max, min, placeholder: presets.length ? "name or number" : "number", modelValue: style()[key], "onUpdate:modelValue": (next: any) => change(key, next) }),
        key,
      );
    const colour = (label: string, key: string) =>
      row(label, h(SduiColorInput, { name: key, modelValue: style()[key], "onUpdate:modelValue": (next: any) => change(key, next) }), key);
    const choice = (label: string, key: string, options: readonly string[]) =>
      row(
        label,
        h(
          "select",
          { "data-style": key, value: style()[key] ?? "", onChange: (event: Event) => change(key, (event.target as HTMLSelectElement).value || undefined) },
          [h("option", { value: "" }, "(not set)"), ...options.map((option) => h("option", { value: option }, option))],
        ),
        key,
      );
    // Four boxes for the four sides: top, right, bottom, left.
    const sides = (label: string, key: "padding" | "margin") => {
      const current = style()[key] ?? {};
      const box = (side: "top" | "right" | "bottom" | "left") =>
        h(SduiValueInput, {
          name: `${key}-${side}`,
          presets: tokens.spacing,
          placeholder: side[0].toUpperCase(),
          modelValue: current[side],
          "onUpdate:modelValue": (next: any) => change(key, withoutEmpty({ ...current, [side]: next })),
        });
      return h("div", { class: "sdui-form-row", "data-row": key }, [
        h("span", { class: "sdui-form-label" }, `${label} (top, right, bottom, left)`),
        h("div", { class: "sdui-sides" }, (["top", "right", "bottom", "left"] as const).map(box)),
      ]);
    };

    return () => {
      const current = style();
      return h("div", { class: "sdui-style" }, [
        h("h4", { class: "sdui-form-group" }, "Size"),
        value("Width (pixels or fill)", "width", ["fill"], 3000),
        value("Height (pixels or fill)", "height", ["fill"], 3000),
        h("h4", { class: "sdui-form-group" }, "Space"),
        value("Space inside, all sides", "spacing", tokens.spacing),
        sides("Space inside", "padding"),
        sides("Space outside", "margin"),
        h("h4", { class: "sdui-form-group" }, "Colour"),
        colour("Background", "color"),
        colour("Text", "textColor"),
        h("h4", { class: "sdui-form-group" }, "Text"),
        value("Text size", "textSize", tokens.textSize, 120, 6),
        choice("Weight", "fontWeight", ["normal", "medium", "bold"]),
        h("label", { class: "sdui-form-row sdui-form-check" }, [
          h("input", { type: "checkbox", "data-style": "italic", checked: current.italic === true, onChange: (event: Event) => change("italic", (event.target as HTMLInputElement).checked || undefined) }),
          h("span", "Italic"),
        ]),
        choice("Alignment", "align", tokens.align),
        h("h4", { class: "sdui-form-group" }, "Corners, border and shadow"),
        value("Rounded corners", "radius", tokens.radius, 999),
        value("Border thickness", "borderWidth", [], 20),
        colour("Border colour", "borderColor"),
        choice("Shadow", "shadow", ["none", "small", "medium", "large"]),
        row(
          `Opacity (${Math.round((current.opacity ?? 1) * 100)}%)`,
          h("input", {
            type: "range",
            min: 0,
            max: 1,
            step: 0.05,
            "data-style": "opacity",
            value: current.opacity ?? 1,
            onInput: (event: Event) => {
              const next = Number((event.target as HTMLInputElement).value);
              change("opacity", next >= 1 ? undefined : next);
            },
          }),
          "opacity",
        ),
      ]);
    };
  },
});
