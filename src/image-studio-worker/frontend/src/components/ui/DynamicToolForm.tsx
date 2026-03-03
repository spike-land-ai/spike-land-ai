import { useState, useCallback, KeyboardEvent } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { ToolInputSchema } from "@/api/client";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { ImagePicker } from "@/components/ui/ImagePicker";
import { Button } from "@/components/ui/Button";
import { CreditBadge } from "@/components/ui/CreditBadge";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface DynamicToolFormProps {
  schema: ToolInputSchema;
  toolName: string;
  creditCost?: number;
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  loading?: boolean;
  /** Reduce padding/gaps for terminal inline use. */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type FieldProperty = ToolInputSchema["properties"][string];

// ---------------------------------------------------------------------------
// Zod schema builder
// ---------------------------------------------------------------------------

// Zod 4 uses a readonly shape internally; we build with a plain record and cast.
type MutableShape = Record<string, z.ZodType>;

function buildFieldSchema(prop: FieldProperty, isRequired: boolean): z.ZodType {
  let schema: z.ZodType;

  if (prop.enum && prop.enum.length > 0) {
    // z.enum() accepts string[] in Zod 4 (overload 1)
    schema = z.enum(prop.enum as [string, ...string[]]);
  } else if (prop.type === "number" || prop.type === "integer") {
    schema = z.coerce.number();
  } else if (prop.type === "boolean") {
    schema = z.boolean();
  } else if (prop.type === "array") {
    schema = z.array(z.string());
  } else {
    schema = z.string();
  }

  if (!isRequired) {
    if (prop.type === "number" || prop.type === "integer") {
      return z.union([z.coerce.number(), z.literal("")]).optional();
    }
    if (prop.type === "boolean") {
      return z.boolean().optional();
    }
    if (prop.type === "array") {
      return z.array(z.string()).optional();
    }
    // Optional string / enum: allow empty string too
    return z.union([schema, z.literal("")]).optional();
  }

  return schema;
}

function buildZodSchema(schema: ToolInputSchema): z.ZodObject {
  const shape: MutableShape = {};
  for (const [key, prop] of Object.entries(schema.properties || {})) {
    shape[key] = buildFieldSchema(prop, schema.required?.includes(key) ?? false);
  }
  // Cast to satisfy Zod 4's readonly shape constraint
  return z.object(shape as Parameters<typeof z.object>[0]);
}

// ---------------------------------------------------------------------------
// Default value helpers
// ---------------------------------------------------------------------------

function getDefaultValues(schema: ToolInputSchema): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(schema.properties || {})) {
    if (prop.default !== undefined) {
      defaults[key] = prop.default;
    } else if (prop.type === "boolean") {
      defaults[key] = false;
    } else if (prop.type === "array") {
      defaults[key] = [];
    } else if (prop.enum && prop.enum.length > 0) {
      defaults[key] = prop.enum[0];
    } else {
      defaults[key] = "";
    }
  }
  return defaults;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function humanLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isImageIdField(key: string): boolean {
  return key.includes("image_id");
}

// ---------------------------------------------------------------------------
// FieldLabel — shared label with optional required asterisk
// ---------------------------------------------------------------------------

interface FieldLabelProps {
  htmlFor?: string;
  isRequired: boolean;
  children: string;
}

function FieldLabel({ htmlFor, isRequired, children }: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-300">
      {children}
      {isRequired && (
        <span className="text-red-400 ml-1" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}

// ---------------------------------------------------------------------------
// FieldDescription — optional hint text beneath label
// ---------------------------------------------------------------------------

function FieldDescription({ text }: { text: string }) {
  return <p className="text-xs text-gray-500 mt-0.5">{text}</p>;
}

// ---------------------------------------------------------------------------
// FieldError — accessible error message
// ---------------------------------------------------------------------------

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="text-xs text-red-400" role="alert">
      {message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// TagInput — comma-separated array input with chip UI
// ---------------------------------------------------------------------------

interface TagInputProps {
  fieldKey: string;
  label: string;
  isRequired: boolean;
  description?: string;
  error?: string;
  compact: boolean;
  value: string[];
  onChange: (tags: string[]) => void;
}

function TagInput({
  fieldKey,
  label,
  isRequired,
  description,
  error,
  compact,
  value,
  onChange,
}: TagInputProps) {
  const [draft, setDraft] = useState("");
  const inputId = `field-${fieldKey}`;
  const errorId = `${fieldKey}-error`;

  const addTag = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed !== "" && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setDraft("");
  }, [draft, value, onChange]);

  const removeTag = useCallback(
    (tag: string) => {
      onChange(value.filter((t) => t !== tag));
    },
    [value, onChange],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <FieldLabel htmlFor={inputId} isRequired={isRequired}>
        {label}
      </FieldLabel>
      {description && <FieldDescription text={description} />}

      {value.length > 0 && (
        <div className={`flex flex-wrap gap-1 ${compact ? "mb-1" : "mb-2"}`}>
          {value.map((tag) => (
            <Badge key={tag} variant="info" className="gap-1">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-0.5 hover:text-white transition-colors leading-none"
                aria-label={`Remove ${tag}`}
              >
                &times;
              </button>
            </Badge>
          ))}
        </div>
      )}

      <input
        id={inputId}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder="Type and press Enter to add"
        aria-required={isRequired}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className={`w-full px-3 py-2 rounded-lg bg-gray-800 border text-gray-100
          placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500
          text-sm ${error ? "border-red-500" : "border-gray-700"}`}
      />
      {error && <FieldError id={errorId} message={error} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BooleanCheckbox — styled checkbox with label
// ---------------------------------------------------------------------------

interface BooleanCheckboxProps {
  fieldKey: string;
  label: string;
  isRequired: boolean;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function BooleanCheckbox({
  fieldKey,
  label,
  isRequired,
  description,
  checked,
  onChange,
}: BooleanCheckboxProps) {
  const id = `checkbox-${fieldKey}`;
  return (
    <div className="flex items-start gap-3">
      <div className="flex items-center h-5 mt-0.5 shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-required={isRequired}
          className="w-4 h-4 rounded border-gray-700 bg-gray-800
            focus:ring-2 focus:ring-accent-500/50 focus:ring-offset-0
            checked:accent-accent-600 cursor-pointer"
        />
      </div>
      <div className="space-y-0.5">
        <label
          htmlFor={id}
          className="block text-sm font-medium text-gray-300 cursor-pointer select-none"
        >
          {label}
          {isRequired && (
            <span className="text-red-400 ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {description && <FieldDescription text={description} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TextInputField — text/number with label + description outside Input
// ---------------------------------------------------------------------------

interface TextInputFieldProps {
  fieldKey: string;
  label: string;
  isRequired: boolean;
  description?: string;
  error?: string;
  type?: "text" | "number";
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
}

function TextInputField({
  fieldKey,
  label,
  isRequired,
  description,
  error,
  type = "text",
  inputProps,
}: TextInputFieldProps) {
  const inputId = `field-${fieldKey}`;
  const errorId = `${fieldKey}-error`;

  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={inputId} isRequired={isRequired}>
        {label}
      </FieldLabel>
      {description && <FieldDescription text={description} />}
      <Input
        id={inputId}
        type={type}
        error={error}
        aria-required={isRequired}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {/* Input renders its own error, but we also need the aria error id */}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EnumSelectField — dropdown with label + description outside Select
// ---------------------------------------------------------------------------

interface EnumSelectFieldProps {
  fieldKey: string;
  label: string;
  isRequired: boolean;
  description?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
  selectProps: React.SelectHTMLAttributes<HTMLSelectElement>;
}

function EnumSelectField({
  fieldKey,
  label,
  isRequired,
  description,
  error,
  options,
  selectProps,
}: EnumSelectFieldProps) {
  const selectId = `field-${fieldKey}`;
  const errorId = `${fieldKey}-error`;

  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={selectId} isRequired={isRequired}>
        {label}
      </FieldLabel>
      {description && <FieldDescription text={description} />}
      <Select
        id={selectId}
        options={options}
        aria-required={isRequired}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        {...selectProps}
      />
      {error && <FieldError id={errorId} message={error} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DynamicToolForm({
  schema,
  toolName,
  creditCost,
  onSubmit,
  loading = false,
  compact = false,
}: DynamicToolFormProps) {
  const zodSchema = buildZodSchema(schema);
  const defaultValues = getDefaultValues(schema);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid },
  } = useForm<Record<string, unknown>>({
    resolver: zodResolver(zodSchema),
    defaultValues,
    mode: "onChange",
  });

  const handleFormSubmit = async (raw: Record<string, unknown>) => {
    const cleaned: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(raw)) {
      const prop = schema.properties[key];
      const isRequired = schema.required?.includes(key) ?? false;

      // Drop empty optional values
      if (!isRequired && (val === "" || val === undefined || val === null)) {
        continue;
      }

      // Coerce number strings from uncontrolled inputs
      if (
        (prop?.type === "number" || prop?.type === "integer") &&
        typeof val === "string" &&
        val !== ""
      ) {
        cleaned[key] = Number(val);
        continue;
      }

      cleaned[key] = val;
    }

    await onSubmit(cleaned);
  };

  const gap = compact ? "gap-3" : "gap-4";
  const submitPadding = compact ? "pt-3" : "pt-4";
  const entries = Object.entries(schema.properties || {});

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} noValidate aria-label={`${toolName} form`}>
      <div className={`flex flex-col ${gap}`}>
        {entries.map(([key, prop]) => {
          const isRequired = schema.required?.includes(key) ?? false;
          const label = humanLabel(key);
          const fieldError = errors[key]?.message as string | undefined;

          // ---- Image picker ----
          if (isImageIdField(key)) {
            return (
              <Controller
                key={key}
                name={key}
                control={control}
                render={({ field }) => (
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor={undefined} isRequired={isRequired}>
                      {label}
                    </FieldLabel>
                    {prop.description && <FieldDescription text={prop.description} />}
                    <ImagePicker
                      value={typeof field.value === "string" ? field.value : undefined}
                      onChange={(id) => field.onChange(id)}
                    />
                    {fieldError && <FieldError id={`${key}-error`} message={fieldError} />}
                  </div>
                )}
              />
            );
          }

          // ---- Boolean checkbox ----
          if (prop.type === "boolean") {
            return (
              <Controller
                key={key}
                name={key}
                control={control}
                render={({ field }) => (
                  <BooleanCheckbox
                    fieldKey={key}
                    label={label}
                    isRequired={isRequired}
                    description={prop.description}
                    checked={field.value === true}
                    onChange={field.onChange}
                  />
                )}
              />
            );
          }

          // ---- Tag array ----
          if (prop.type === "array") {
            return (
              <Controller
                key={key}
                name={key}
                control={control}
                render={({ field }) => {
                  const tags = Array.isArray(field.value) ? (field.value as string[]) : [];
                  return (
                    <TagInput
                      fieldKey={key}
                      label={label}
                      isRequired={isRequired}
                      description={prop.description}
                      error={fieldError}
                      compact={compact}
                      value={tags}
                      onChange={field.onChange}
                    />
                  );
                }}
              />
            );
          }

          // ---- Enum select ----
          if (prop.enum && prop.enum.length > 0) {
            return (
              <EnumSelectField
                key={key}
                fieldKey={key}
                label={label}
                isRequired={isRequired}
                description={prop.description}
                error={fieldError}
                options={prop.enum.map((v) => ({
                  value: v,
                  label: v.replace(/_/g, " "),
                }))}
                selectProps={register(key)}
              />
            );
          }

          // ---- Number input ----
          if (prop.type === "number" || prop.type === "integer") {
            return (
              <TextInputField
                key={key}
                fieldKey={key}
                label={label}
                isRequired={isRequired}
                description={prop.description}
                error={fieldError}
                type="number"
                inputProps={register(key)}
              />
            );
          }

          // ---- Default: text input ----
          return (
            <TextInputField
              key={key}
              fieldKey={key}
              label={label}
              isRequired={isRequired}
              description={prop.description}
              error={fieldError}
              type="text"
              inputProps={register(key)}
            />
          );
        })}

        {/* Submit row */}
        <div className={`flex items-center gap-3 ${submitPadding}`}>
          <Button type="submit" loading={loading} disabled={loading || !isValid}>
            Run {toolName}
          </Button>
          {creditCost !== undefined && <CreditBadge cost={creditCost} />}
        </div>
      </div>
    </form>
  );
}
