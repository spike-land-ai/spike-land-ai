import React, { useState, useEffect } from "react";

interface JsonSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: any;
  items?: JsonSchemaProperty; // For arrays
}

interface JsonSchema {
  type: "object";
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

interface JsonSchemaFormProps {
  schema: JsonSchema;
  onChange: (data: Record<string, any>) => void;
  onSubmit: () => void;
  isPending?: boolean;
}

export function JsonSchemaForm({ schema, onChange, onSubmit, isPending }: JsonSchemaFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    // Initialize defaults
    const initialData: Record<string, any> = {};
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, prop]) => {
        if (prop.default !== undefined) {
          initialData[key] = prop.default;
        } else if (prop.type === "boolean") {
          initialData[key] = false;
        } else if (prop.type === "string" && prop.enum && prop.enum.length > 0) {
          initialData[key] = prop.enum[0]; // Select first enum by default
        } else if (prop.type === "string") {
          initialData[key] = "";
        } else if (prop.type === "number" || prop.type === "integer") {
          initialData[key] = 0;
        } else if (prop.type === "array") {
          initialData[key] = [];
        }
      });
    }
    setFormData(initialData);
    onChange(initialData);
  }, [schema]);

  const handleChange = (key: string, value: any) => {
    const newData = { ...formData, [key]: value };
    setFormData(newData);
    onChange(newData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500 dark:bg-zinc-800/50 dark:text-zinc-400 border border-gray-200 dark:border-zinc-800">
          This tool requires no input arguments.
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full sm:w-auto rounded-lg bg-cyan-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-cyan-500 disabled:opacity-50 transition-colors focus:ring-2 focus:ring-cyan-500 focus:outline-none"
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
              <label htmlFor={key} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {key} {isRequired && <span className="text-red-500">*</span>}
              </label>

              {prop.description && (
                <p className="text-xs text-gray-500 dark:text-zinc-400 mb-2">{prop.description}</p>
              )}

              {prop.type === "boolean" ? (
                <div className="flex items-center">
                  <input
                    id={key}
                    type="checkbox"
                    checked={!!formData[key]}
                    onChange={(e) => handleChange(key, e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-600 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Enable</span>
                </div>
              ) : prop.enum ? (
                <select
                  id={key}
                  value={formData[key] || ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  required={isRequired}
                  className="block w-full rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-cyan-600 sm:text-sm sm:leading-6 dark:bg-zinc-900 dark:text-white dark:ring-zinc-700"
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
                  value={formData[key] ?? ""}
                  onChange={(e) => handleChange(key, e.target.value === "" ? "" : Number(e.target.value))}
                  required={isRequired}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-cyan-600 sm:text-sm sm:leading-6 dark:bg-zinc-900 dark:text-white dark:ring-zinc-700 dark:placeholder:text-zinc-500"
                />
              ) : prop.type === "string" && prop.description && prop.description.length > 50 ? (
                <textarea
                  id={key}
                  rows={3}
                  value={formData[key] || ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  required={isRequired}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-cyan-600 sm:text-sm sm:leading-6 dark:bg-zinc-900 dark:text-white dark:ring-zinc-700 dark:placeholder:text-zinc-500"
                />
              ) : (
                <input
                  id={key}
                  type="text"
                  value={formData[key] || ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  required={isRequired}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-cyan-600 sm:text-sm sm:leading-6 dark:bg-zinc-900 dark:text-white dark:ring-zinc-700 dark:placeholder:text-zinc-500"
                />
              )}
            </div>
          );
        })}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full sm:w-auto rounded-lg bg-cyan-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-cyan-500 disabled:opacity-50 transition-colors focus:ring-2 focus:ring-cyan-500 focus:outline-none"
      >
        {isPending ? "Executing..." : "Execute Tool"}
      </button>
    </form>
  );
}
