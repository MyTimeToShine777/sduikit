import { defineComponent, h, type PropType, type VNode } from "vue";
import { schemaToFields, type Field } from "./fields.js";

type Data = Record<string, unknown>;

// An edit form built from a widget's data schema. Staff change the fields, the form hands back
// the new `data` object. Empty optional fields are left out so the result stays valid.
export const SduiForm = defineComponent({
  name: "SduiForm",
  props: {
    schema: { type: Object as PropType<Record<string, unknown>>, required: true },
    modelValue: { type: Object as PropType<Data>, default: () => ({}) },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    // Sets one field, or removes it when the new value is "empty".
    function change(key: string, value: unknown) {
      const next: Data = { ...props.modelValue };
      if (value === undefined) delete next[key];
      else next[key] = value;
      emit("update:modelValue", next);
    }

    function control(field: Field): VNode {
      const current = props.modelValue[field.key];
      const attrs = { "data-field": field.key };

      switch (field.kind) {
        case "text":
        case "url":
          return h("input", {
            ...attrs,
            type: field.kind === "url" ? "url" : "text",
            value: typeof current === "string" ? current : "",
            onInput: (event: Event) => {
              const text = (event.target as HTMLInputElement).value;
              change(field.key, text === "" ? undefined : text);
            },
          });
        case "number":
        case "integer":
          return h("input", {
            ...attrs,
            type: "number",
            min: field.min,
            max: field.max,
            step: field.kind === "integer" ? 1 : "any",
            value: typeof current === "number" ? current : "",
            onInput: (event: Event) => {
              const text = (event.target as HTMLInputElement).value;
              change(field.key, text === "" ? undefined : Number(text));
            },
          });
        case "boolean":
          return h("input", {
            ...attrs,
            type: "checkbox",
            checked: current === true,
            onChange: (event: Event) => change(field.key, (event.target as HTMLInputElement).checked),
          });
        case "choice":
          return h(
            "select",
            {
              ...attrs,
              value: typeof current === "string" ? current : "",
              onChange: (event: Event) => {
                const choice = (event.target as HTMLSelectElement).value;
                change(field.key, choice === "" ? undefined : choice);
              },
            },
            [
              h("option", { value: "" }, "(not set)"),
              ...(field.choices ?? []).map((choice) => h("option", { value: choice }, choice)),
            ],
          );
        case "widgets": {
          const count = Array.isArray(current) ? current.length : 0;
          return h("p", { ...attrs, class: "sdui-form-note" }, `${count} widget(s) inside. Edit them in the page tree.`);
        }
        default:
          return h("p", { ...attrs, class: "sdui-form-note" }, "This field can only be edited in the JSON view.");
      }
    }

    return () =>
      h(
        "div",
        { class: "sdui-form" },
        schemaToFields(props.schema).map((field) =>
          h("label", { class: "sdui-form-row", "data-row": field.key }, [
            h("span", { class: "sdui-form-label" }, field.required ? `${field.label} *` : field.label),
            control(field),
          ]),
        ),
      );
  },
});
