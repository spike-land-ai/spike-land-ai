"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SalaryData } from "@/lib/career/types";

interface SalaryChartProps {
  salary: SalaryData;
}

export function SalaryChart({ salary }: SalaryChartProps) {
  const data = [
    { name: "25th %ile", value: salary.p25 },
    { name: "Median", value: salary.median },
    { name: "75th %ile", value: salary.p75 },
  ];

  return (
    <Card className="bg-zinc-900 border-white/[0.06]">
      <CardHeader>
        <CardTitle className="text-white text-sm">
          Salary Range ({salary.currency}) - {salary.location}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
            <YAxis
              tick={{ fill: "#a1a1aa", fontSize: 12 }}
              tickFormatter={(v: number) => `${salary.currency}${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1c1c1c",
                border: "1px solid #333",
                borderRadius: 8,
              }}
              labelStyle={{ color: "#fff" }}
              formatter={(value) => `${salary.currency}${Number(value).toLocaleString()}`}
            />
            <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-zinc-500 mt-2">Source: {salary.source}</p>
      </CardContent>
    </Card>
  );
}
