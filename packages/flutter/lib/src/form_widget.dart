import 'package:flutter/material.dart';

import 'model.dart';
import 'render.dart';

final _emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

/// The `form` widget: draws the fields, checks them when the person presses the button, and then
/// runs the widget's action with everything that was typed added to the action's `params`.
Widget buildForm(BuildContext context, SduiNode node, SduiRender render) {
  final fields = [
    for (final raw in node.list('fields'))
      if (raw is Map && raw['name'] is String && raw['type'] is String && raw['label'] is String) Map<String, dynamic>.from(raw),
  ];
  if (fields.isEmpty) throw SduiDataError(node, 'fields');
  final submitLabel = node.requireString('submitLabel');
  return render.wrapNode(context, node, _SduiForm(node: node, render: render, fields: fields, submitLabel: submitLabel), tappable: false);
}

class _SduiForm extends StatefulWidget {
  const _SduiForm({required this.node, required this.render, required this.fields, required this.submitLabel});

  final SduiNode node;
  final SduiRender render;
  final List<Map<String, dynamic>> fields;
  final String submitLabel;

  @override
  State<_SduiForm> createState() => _SduiFormState();
}

class _SduiFormState extends State<_SduiForm> {
  final _formKey = GlobalKey<FormState>();
  final Map<String, dynamic> _values = {};
  final Map<String, TextEditingController> _dateControllers = {};

  @override
  void dispose() {
    for (final controller in _dateControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  String _labelOf(Map<String, dynamic> field) => field['required'] == true ? '${field['label']} *' : '${field['label']}';

  String? _checkText(Map<String, dynamic> field, String? value) {
    final text = (value ?? '').trim();
    if (text.isEmpty) return field['required'] == true ? 'Please fill this in.' : null;
    if (field['type'] == 'email' && !_emailPattern.hasMatch(text)) return 'Enter a valid email address.';
    if (field['type'] == 'number' && double.tryParse(text) == null) return 'Enter a number.';
    return null;
  }

  Widget _fieldFor(Map<String, dynamic> field) {
    final name = field['name'] as String;
    final type = field['type'] as String;
    final placeholder = field['placeholder'] is String ? field['placeholder'] as String : null;
    // The piece "label" styles the caption of a field, and the piece "field" styles the box you type in.
    final tokens = context.sduiTokens;
    final fieldLook = widget.render.partLook(widget.node, 'field');
    final fieldRadius = tokens.radius(fieldLook['radius']);
    final fieldColor = tokens.color(fieldLook['color']);
    final fieldBorderColor = tokens.color(fieldLook['borderColor']);
    final fieldBorderWidth = fieldLook['borderWidth'] is num ? (fieldLook['borderWidth'] as num).toDouble() : null;
    final fieldText = widget.render.partTextStyle(context, widget.node, 'field');
    final decoration = InputDecoration(
      labelText: _labelOf(field),
      labelStyle: widget.render.partTextStyle(context, widget.node, 'label'),
      hintText: placeholder,
      filled: fieldColor != null,
      fillColor: fieldColor,
      border: (fieldRadius != null || fieldBorderColor != null || fieldBorderWidth != null)
          ? OutlineInputBorder(
              borderRadius: BorderRadius.circular(fieldRadius ?? 4),
              borderSide: BorderSide(color: fieldBorderColor ?? const Color(0xFF79747E), width: fieldBorderWidth ?? 1),
            )
          : null,
    );
    // A value left empty is simply not sent, rather than sent as an empty text.
    void saveText(String? value) {
      final text = (value ?? '').trim();
      if (text.isEmpty) return;
      _values[name] = type == 'number' ? num.parse(text) : text;
    }

    switch (type) {
      case 'text':
      case 'email':
      case 'number':
      case 'multiline':
      case 'password':
        return TextFormField(
          style: fieldText,
          decoration: decoration,
          keyboardType: switch (type) {
            'email' => TextInputType.emailAddress,
            'number' => const TextInputType.numberWithOptions(decimal: true),
            'multiline' => TextInputType.multiline,
            _ => TextInputType.text,
          },
          obscureText: type == 'password',
          maxLines: type == 'password' ? 1 : (type == 'multiline' ? 4 : 1),
          validator: (value) => _checkText(field, value),
          onSaved: saveText,
        );
      case 'date':
        final controller = _dateControllers.putIfAbsent(name, TextEditingController.new);
        return TextFormField(
          style: fieldText,
          controller: controller,
          readOnly: true,
          decoration: decoration.copyWith(suffixIcon: const Icon(Icons.calendar_today_outlined)),
          validator: (value) => _checkText(field, value),
          onSaved: saveText,
          onTap: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: DateTime.now(),
              firstDate: DateTime(1900),
              lastDate: DateTime(2100),
            );
            if (picked == null) return;
            String two(int number) => number.toString().padLeft(2, '0');
            controller.text = '${picked.year}-${two(picked.month)}-${two(picked.day)}';
          },
        );
      case 'select':
        final options = [
          for (final raw in (field['options'] is List ? field['options'] as List : const []))
            if (raw is Map && raw['value'] is String && raw['label'] is String) raw,
        ];
        return DropdownButtonFormField<String>(
          style: fieldText,
          decoration: decoration,
          items: [for (final option in options) DropdownMenuItem(value: option['value'] as String, child: Text(option['label'] as String))],
          onChanged: (_) {},
          validator: (value) => field['required'] == true && value == null ? 'Please choose one.' : null,
          onSaved: (value) {
            if (value != null) _values[name] = value;
          },
        );
      case 'checkbox':
      case 'switch':
        return FormField<bool>(
          initialValue: false,
          validator: (value) => field['required'] == true && value != true ? 'Please tick this box.' : null,
          onSaved: (value) => _values[name] = value ?? false,
          builder: (state) {
            final tile = type == 'checkbox'
                ? CheckboxListTile(contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading, title: widget.render.partText(context, widget.node, 'label', _labelOf(field)), value: state.value, onChanged: state.didChange)
                : SwitchListTile(contentPadding: EdgeInsets.zero, title: widget.render.partText(context, widget.node, 'label', _labelOf(field)), value: state.value ?? false, onChanged: state.didChange);
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                tile,
                if (state.hasError) Text(state.errorText!, style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 12)),
              ],
            );
          },
        );
      default:
        // A field type this version does not know is left out; the rest of the form still works.
        widget.render.onError?.call(FormatException('The form field "$name" has an unknown type "$type" and was skipped.'), null);
        return const SizedBox.shrink();
    }
  }

  void _submit() {
    final form = _formKey.currentState!;
    if (!form.validate()) return;
    _values.clear();
    form.save();
    widget.render.tap(
      context,
      action: widget.node.action,
      event: widget.node.analyticsEvent,
      params: widget.node.analyticsParams,
      extraParams: Map<String, dynamic>.from(_values),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final field in widget.fields) Padding(padding: const EdgeInsets.only(bottom: 12), child: _fieldFor(field)),
          widget.render.partButton(
            context,
            widget.node,
            'button',
            (style) => FilledButton(style: style, onPressed: _submit, child: Text(widget.submitLabel)),
          ),
        ],
      ),
    );
  }
}
