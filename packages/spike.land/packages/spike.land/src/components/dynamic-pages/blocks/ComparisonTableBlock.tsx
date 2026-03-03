"use client";

import type { z } from "zod";
import type { ComparisonTableContentSchema } from "@/lib/dynamic-pages/block-schemas";
import type { Prisma } from "@/generated/prisma";

type ComparisonTableContent = z.infer<typeof ComparisonTableContentSchema>;

interface ComparisonTableBlockProps {
  content: Prisma.JsonValue;
  variant?: string;
}

export function ComparisonTableBlock({ content }: ComparisonTableBlockProps) {
  const data = content as ComparisonTableContent;

  return (
    <section className="w-full py-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-5xl mx-auto">
        {data.sectionTitle
          ? (
            <h2 className="text-3xl font-bold text-center mb-12">
              {data.sectionTitle}
            </h2>
          )
          : null}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {data.headers.map((header, index) => (
                  <th
                    key={`header-${index}`}
                    className="px-6 py-3 text-left font-semibold"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, rowIndex) => (
                <tr
                  key={`row-${rowIndex}`}
                  className="border-b border-border last:border-b-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-6 py-3 font-medium">{row.feature}</td>
                  {row.values.map((value, valueIndex) => (
                    <td
                      key={`cell-${rowIndex}-${valueIndex}`}
                      className="px-6 py-3 text-muted-foreground"
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
