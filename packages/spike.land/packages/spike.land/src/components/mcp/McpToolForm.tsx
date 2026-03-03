"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Loader2, Play } from "lucide-react";

import type {
  McpToolDef,
  McpToolParam,
} from "@/components/mcp/mcp-tool-registry";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFormPersistence } from "@/components/mcp/useMcpHistory";

const TEXTAREA_FIELD_NAMES = new Set([
  "code",
  "description",
  "task",
  "body",
  "content",
  "message",
  "prompt",
]);

function shouldUseTextarea(paramName: string): boolean {
  return TEXTAREA_FIELD_NAMES.has(paramName);
}

interface McpToolFormProps {
  tool: McpToolDef;
  onSubmit: (params: Record<string, unknown>) => void;
  isExecuting: boolean;
}

function buildInitialValues(params: McpToolParam[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const param of params) {
    if (param.default !== undefined) {
      values[param.name] = param.default;
    } else if (param.type === "boolean") {
      values[param.name] = false;
    } else if (param.type === "number") {
      values[param.name] = "";
    } else {
      values[param.name] = "";
    }
  }
  return values;
}

export function McpToolForm({ tool, onSubmit, isExecuting }: McpToolFormProps) {
  const { loadValues, saveValues, initialized } = useFormPersistence(tool.name);
  const formRef = useRef<HTMLFormElement>(null);

  const [values, setValues] = useState<Record<string, unknown>>(() =>
    buildInitialValues(tool.params)
  );

  // Restore persisted form values (or example payload) on mount
  useEffect(() => {
    const defaults = buildInitialValues(tool.params);
    const persisted = loadValues();
    if (persisted) {
      // Merge persisted values over defaults
      setValues({ ...defaults, ...persisted });
    } else if (tool.example) {
      // Pre-fill with example payload
      setValues({ ...defaults, ...tool.example });
    } else {
      setValues(defaults);
    }
  }, [tool.name, tool.params, tool.example, loadValues]);

  const updateValue = useCallback((name: string, value: unknown) => {
    setValues(prev => {
      const next = { ...prev, [name]: value };
      return next;
    });
  }, []);

  // Persist form values to sessionStorage on change
  useEffect(() => {
    if (initialized) {
      saveValues(values);
    }
  }, [values, saveValues, initialized]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Filter out empty string values for non-required params
    const cleaned: Record<string, unknown> = {};
    for (const param of tool.params) {
      const val = values[param.name];
      if (val === "" && !param.required) continue;
      if (param.type === "number" && typeof val === "string" && val !== "") {
        cleaned[param.name] = Number(val);
      } else {
        cleaned[param.name] = val;
      }
    }
    onSubmit(cleaned);
  };

  // Ctrl+Enter / Cmd+Enter keyboard shortcut to execute
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !isExecuting) {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExecuting]);

  const isMac = typeof navigator !== "undefined"
    && /Mac/.test(navigator.userAgent);
  const shortcutLabel = isMac ? "\u2318\u21A9" : "Ctrl+\u21A9";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Parameters</span>
          <span className="inline-flex items-center gap-1 text-xs text-zinc-500 font-normal">
            <Keyboard className="w-3 h-3" />
            {shortcutLabel} to execute
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {tool.params.length === 0 && (
            <p className="text-sm text-muted-foreground">
              This tool takes no parameters.
            </p>
          )}

          {tool.params.map(param => (
            <FieldRenderer
              key={param.name}
              param={param}
              value={values[param.name]}
              onChange={val => updateValue(param.name, val)}
            />
          ))}

          <Button type="submit" disabled={isExecuting} className="w-full">
            {isExecuting
              ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Executing...
                </>
              )
              : (
                <>
                  <Play className="h-4 w-4" />
                  Execute
                </>
              )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function FieldRenderer({
  param,
  value,
  onChange,
}: {
  param: McpToolParam;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `field-${param.name}`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {param.name}
        {param.required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {param.type === "boolean"
        ? (
          <div className="flex items-center gap-3">
            <Switch
              id={id}
              checked={value === true}
              onCheckedChange={checked => onChange(checked)}
            />
            <span className="text-sm text-muted-foreground">
              {param.description}
            </span>
          </div>
        )
        : param.type === "enum" && param.enumValues
        ? (
          <Select
            value={String(value ?? "")}
            onValueChange={val => onChange(val)}
          >
            <SelectTrigger id={id}>
              <SelectValue placeholder={`Select ${param.name}`} />
            </SelectTrigger>
            <SelectContent>
              {param.enumValues.map(val => (
                <SelectItem key={val} value={val}>
                  {val}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
        : param.type === "number"
        ? (
          <Input
            id={id}
            type="number"
            value={String(value ?? "")}
            onChange={e => onChange(e.target.value)}
            placeholder={param.placeholder}
          />
        )
        : shouldUseTextarea(param.name)
        ? (
          <Textarea
            id={id}
            value={String(value ?? "")}
            onChange={e => onChange(e.target.value)}
            placeholder={param.placeholder}
            rows={4}
          />
        )
        : (
          <Input
            id={id}
            type="text"
            value={String(value ?? "")}
            onChange={e => onChange(e.target.value)}
            placeholder={param.placeholder}
          />
        )}

      {param.type !== "boolean" && (
        <p className="text-xs text-muted-foreground">{param.description}</p>
      )}
    </div>
  );
}
