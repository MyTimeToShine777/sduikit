import { defineComponent, h, type PropType, type VNode } from "vue";
import { SduiActionEditor, SduiColorInput, SduiJsonBox, SduiValueInput } from "./controls.js";
import { blankFor, schemaToFields, type Field } from "./fields.js";
import { moveItem, removeItem } from "./reorder.js";

type Data = Record<string, unknown>;

const isEmptyGroup = (value: unknown) => typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0;

// An edit form built from a widget's data schema. Staff change the fields, the form hands back the new
// `data` object. Lists (links, rows, steps, options...) can be added to, removed from and reordered; groups of
// fields open inside each other; the tap action has its own editor. Empty optional fields are left out so the
// result stays valid. Widgets inside the widget are edited in the layers tree, not here.
export const SduiForm = defineComponent({
  name: "SduiForm",
  props: {
    schema: { type: Object as PropType<Record<string, unknown>>, required: true },
    modelValue: { type: Object as PropType<Data>, default: () => ({}) },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    // Draws one input. `path` names it for tests ("links.0.label"); `onChange` receives the new value, or
    // undefined when the box was emptied. `inList` entries cannot be left out, so empty text stays "".
    function control(field: Field, current: unknown, onChange: (value: unknown) => void, path: string, inList: boolean): VNode {
      const attrs = { "data-field": path };
      const empty = inList ? "" : undefined;

      switch (field.kind) {
        case "text":
        case "url":
          return h("input", {
            ...attrs,
            type: field.kind === "url" ? "url" : "text",
            value: typeof current === "string" ? current : "",
            onInput: (event: Event) => {
              const text = (event.target as HTMLInputElement).value;
              onChange(text === "" ? empty : text);
            },
          });
        case "longtext":
          return h("textarea", {
            ...attrs,
            rows: 3,
            value: typeof current === "string" ? current : "",
            onInput: (event: Event) => {
              const text = (event.target as HTMLTextAreaElement).value;
              onChange(text === "" ? empty : text);
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
              onChange(text === "" ? (inList ? 0 : undefined) : Number(text));
            },
          });
        case "boolean":
          return h("input", {
            ...attrs,
            type: "checkbox",
            checked: current === true,
            onChange: (event: Event) => onChange((event.target as HTMLInputElement).checked),
          });
        case "choice":
          return h(
            "select",
            {
              ...attrs,
              value: typeof current === "string" ? current : "",
              onChange: (event: Event) => {
                const choice = (event.target as HTMLSelectElement).value;
                onChange(choice === "" ? empty : choice);
              },
            },
            [
              field.required || inList ? null : h("option", { value: "" }, "(not set)"),
              ...(field.choices ?? []).map((choice) => h("option", { value: choice }, choice)),
            ],
          );
        case "colour":
          return h(SduiColorInput, { name: path, modelValue: typeof current === "string" ? current : undefined, "onUpdate:modelValue": (value: any) => onChange(value) });
        case "value":
          return h(SduiValueInput, {
            name: path,
            presets: field.presets ?? [],
            min: field.min ?? 0,
            max: field.max ?? 5000,
            placeholder: field.presets?.length ? "name or number" : "number",
            modelValue: typeof current === "string" || typeof current === "number" ? current : undefined,
            "onUpdate:modelValue": (value: any) => onChange(value),
          });
        case "widgets": {
          const count = Array.isArray(current) ? current.length : 0;
          return h("p", { ...attrs, class: "sdui-form-note" }, `${count} widget(s) inside. Edit them in the layers on the left.`);
        }
        case "action":
          return h("div", { ...attrs, class: "sdui-form-box" }, [
            h(SduiActionEditor, { modelValue: current as any, "onUpdate:modelValue": (value: unknown) => onChange(value) }),
          ]);
        case "group":
          return h("div", { ...attrs, class: "sdui-form-box" }, fieldsOf(field.fields ?? [], (current ?? {}) as Data, (value) => onChange(isEmptyGroup(value) && !field.required ? undefined : value), path, false));
        case "list":
          return listControl(field, Array.isArray(current) ? current : [], onChange, path);
        default:
          return h(SduiJsonBox, { ...attrs, modelValue: current, rows: 4, "onUpdate:modelValue": (value: any) => onChange(value) });
      }
    }

    function listControl(field: Field, entries: unknown[], onChange: (value: unknown) => void, path: string): VNode {
      const item = field.item!;
      const canAdd = field.maxItems === undefined || entries.length < field.maxItems;
      const canRemove = field.minItems === undefined || entries.length > field.minItems;
      const set = (next: unknown[]) => onChange(next.length === 0 && !field.required ? undefined : next);
      const nice = (index: number) => `${field.label.replace(/s$/, "")} ${index + 1}`;

      return h("div", { class: "sdui-list", "data-field": path }, [
        ...entries.map((entry, index) =>
          h("div", { class: "sdui-list-item", "data-item": `${path}.${index}` }, [
            h("div", { class: "sdui-list-bar" }, [
              h("strong", nice(index)),
              h("span", { class: "sdui-list-buttons" }, [
                h("button", { type: "button", title: "Move up", "aria-label": `Move ${nice(index)} up`, disabled: index === 0, onClick: () => set(moveItem(entries, index, index - 1)) }, "↑"),
                h("button", { type: "button", title: "Move down", "aria-label": `Move ${nice(index)} down`, disabled: index === entries.length - 1, onClick: () => set(moveItem(entries, index, index + 1)) }, "↓"),
                h("button", { type: "button", title: "Remove", "aria-label": `Remove ${nice(index)}`, disabled: !canRemove, onClick: () => set(removeItem(entries, index)) }, "×"),
              ]),
            ]),
            control(
              item,
              entry,
              (value) => set(entries.map((each, at) => (at === index ? value : each))),
              `${path}.${index}`,
              true,
            ),
          ]),
        ),
        h("button", { type: "button", class: "sdui-list-add", "data-add": path, disabled: !canAdd, onClick: () => set([...entries, blankFor(item)]) }, `+ Add ${field.label.toLowerCase().replace(/s$/, "")}`),
      ]);
    }

    // The rows of one group of fields. `data` is the object they edit; `onChange` receives the changed object.
    function fieldsOf(fields: Field[], data: Data, onChange: (value: Data) => void, parent: string, top: boolean): VNode[] {
      return fields.map((field) => {
        const path = parent ? `${parent}.${field.key}` : field.key;
        const whole = field.kind === "group" || field.kind === "list" || field.kind === "action" || field.kind === "json";
        const set = (value: unknown) => {
          const next: Data = { ...data };
          if (value === undefined) delete next[field.key];
          else next[field.key] = value;
          onChange(next);
        };
        const label = h("span", { class: "sdui-form-label" }, field.required ? `${field.label} *` : field.label);
        const input = control(field, data[field.key], set, top ? field.key : path, false);
        // Boxes that hold several inputs are not a <label>, so a click inside does not jump to the first input.
        return h(whole ? "div" : "label", { class: "sdui-form-row", "data-row": top ? field.key : path }, [label, input]);
      });
    }

    return () =>
      h(
        "div",
        { class: "sdui-form" },
        fieldsOf(schemaToFields(props.schema), props.modelValue, (next) => emit("update:modelValue", next), "", true),
      );
  },
});
