"use client";

import { CopyButton } from "@/components/ui/copy-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PropDef {
  name: string;
  type: string;
  default?: string;
  required?: boolean;
  description: string;
}

interface PropsTableProps {
  componentName: string;
  importPath: string;
  props: PropDef[];
}

export function PropsTable({ componentName, importPath, props }: PropsTableProps) {
  return (
    <Card variant="default">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-xl">{componentName}</CardTitle>
          <div className="flex items-center gap-2 min-w-0">
            <code className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded truncate max-w-xs">
              {importPath}
            </code>
            <CopyButton text={importPath} className="shrink-0" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prop</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.map((prop) => (
              <TableRow key={prop.name}>
                <TableCell className="font-medium">
                  {prop.name}
                  {prop.required && (
                    <span className="text-red-500 ml-0.5" aria-label="required">
                      *
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-primary font-mono text-xs">{prop.type}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {prop.default ?? "-"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{prop.description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
