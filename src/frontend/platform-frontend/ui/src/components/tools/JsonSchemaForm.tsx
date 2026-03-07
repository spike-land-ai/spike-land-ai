import { type FormEvent, useState, useEffect, useCallback, useRef } from "react";
import { apiUrl } from "../../../../core-logic/api";

interface JsonSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: JsonSchemaProperty; // For arrays
}

interface JsonSchema {
  type: "object";
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

interface JsonSchemaFormProps {
  schema: JsonSchema;
  onChange: (data: Record<string, unknown>) => void;
  onSubmit: () => void;
  isPending?: boolean;
  initialData?: Record<string, unknown>;
}

export function JsonSchemaForm({ schema, onChange, onSubmit, isPending, initialData }: JsonSchemaFormProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [urlOptions, setUrlOptions] = useState<{ url: string, label: string }[]>([]);

  useEffect(() => {
    if (schema.properties?.content_url) {
      Promise.all([
        fetch(apiUrl("/blog")).then(res => res.ok ? res.json() : []).catch(() => []),
        fetch(apiUrl("/learnit/recent?limit=20")).then(res => res.ok ? res.json() : []).catch(() => [])
      ]).then(([blogs, learnits]) => {
        const options: { url: string, label: string }[] = [];
        if (Array.isArray(blogs)) {
          blogs.forEach((b: { slug: string; title: string }) => options.push({ url: `https://spike.land/blog/${b.slug}`, label: `Blog: ${b.title}` }));
        }
        if (Array.isArray(learnits)) {
          learnits.forEach((l: { slug: string; title: string }) => options.push({ url: `https://spike.land/learnit/${l.slug}`, label: `LearnIt: ${l.title}` }));
        }
        setUrlOptions(options);
      });
    }
  }, [schema]);

  const stableOnChange = useCallback(onChange, [onChange]);
  const appliedRef = useRef<string>("");

  useEffect(() => {
    const defaults: Record<string, unknown> = {};
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, prop]) => {
        if (prop.default !== undefined) {
          defaults[key] = prop.default;
        } else if (prop.type === "boolean") {
          defaults[key] = false;
        } else if (prop.type === "string" && prop.enum && prop.enum.length > 0) {
          defaults[key] = prop.enum[0];
        } else if (prop.type === "string") {
          defaults[key] = "";
        } else if (prop.type === "number" || prop.type === "integer") {
          defaults[key] = 0;
        } else if (prop.type === "array") {
          defaults[key] = [];
        }
      });
    }
    const merged = { ...defaults, ...(initialData ?? {}) };
    const key = JSON.stringify(merged);
    if (key === appliedRef.current) return;
    appliedRef.current = key;
    setFormData(merged);
    stableOnChange(merged);
  }, [schema, stableOnChange, initialData]);

  const handleChange = (key: string, value: unknown) => {
    const newData = { ...formData, [key]: value };
    setFormData(newData);
    onChange(newData);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground border border-border">
          This tool requires no input arguments.
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full sm:w-auto rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors focus:ring-2 focus:ring-ring focus:outline-none"
        >
          {isPending ? "Executing..." : "Execute Tool"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-5">
        {Object.entries(schema.properties).map(([key, prop]) => {
          const isRequired = schema.required?.includes(key);

          return (
            <div key={key} className="space-y-1.5">
              <label htmlFor={key} className="block text-sm font-medium text-foreground">
                {key} {isRequired && <span className="text-destructive">*</span>}
              </label>

              {prop.description && (
                <p className="text-xs text-muted-foreground mb-2">{prop.description}</p>
              )}

              {prop.type === "boolean" ? (
                <div className="flex items-center">
                  <input
                    id={key}
                    type="checkbox"
                    checked={!!formData[key]}
                    onChange={(e) => handleChange(key, e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                  />
                  <span className="ml-2 text-sm text-muted-foreground">Enable</span>
                </div>
              ) : prop.enum ? (
                <select
                  id={key}
                  value={(formData[key] as string) || ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  required={isRequired}
                  className="block w-full rounded-md border-0 py-2 pl-3 pr-10 text-foreground bg-card ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-ring sm:text-sm sm:leading-6"
                >
                  {prop.enum.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : prop.type === "number" || prop.type === "integer" ? (
                <input
                  id={key}
                  type="number"
                  value={(formData[key] as number) ?? ""}
                  onChange={(e) => handleChange(key, e.target.value === "" ? "" : Number(e.target.value))}
                  required={isRequired}
                  className="block w-full rounded-md border-0 py-1.5 text-foreground bg-card shadow-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-ring sm:text-sm sm:leading-6"
                />
              ) : prop.type === "string" && prop.description && prop.description.length > 50 ? (
                <textarea
                  id={key}
                  rows={3}
                  value={(formData[key] as string) || ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  required={isRequired}
                  className="block w-full rounded-md border-0 py-1.5 text-foreground bg-card shadow-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-ring sm:text-sm sm:leading-6"
                />
              ) : (
                <div className="relative">
                  <input
                    id={key}
                    type="text"
                    list={key === "content_url" ? "content-url-options" : undefined}
                    placeholder={key === "content_url" ? "e.g., https://spike.land/blog/... or type to search" : ""}
                    value={(formData[key] as string) || ""}
                    onChange={(e) => handleChange(key, e.target.value)}
                    required={isRequired}
                    className="block w-full rounded-md border-0 py-1.5 text-foreground bg-card shadow-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-ring sm:text-sm sm:leading-6"
                  />
                  {key === "content_url" && urlOptions.length > 0 && (
                    <datalist id="content-url-options">
                      {urlOptions.map(opt => (
                        <option key={opt.url} value={opt.url}>{opt.label}</option>
                      ))}
                    </datalist>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full sm:w-auto rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors focus:ring-2 focus:ring-ring focus:outline-none"
      >
        {isPending ? "Executing..." : "Execute Tool"}
      </button>
    </form>
  );
}
