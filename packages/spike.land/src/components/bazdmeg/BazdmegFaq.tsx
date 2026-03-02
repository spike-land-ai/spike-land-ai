"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ThumbsUp } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  helpfulCount: number;
}

interface BazdmegFaqProps {
  onFaqExpanded?: () => void;
}

export function BazdmegFaq({ onFaqExpanded }: BazdmegFaqProps) {
  const [entries, setEntries] = useState<FaqEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [helpedIds, setHelpedIds] = useState<Set<string>>(new Set());
  const [openItems, setOpenItems] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/bazdmeg/faq")
      .then((res) => res.json())
      .then((data: { entries: FaqEntry[] }) => {
        setEntries(data.entries || []);
      })
      .catch(() => {
        // Silently fail - FAQ is non-critical
      })
      .finally(() => setLoading(false));
  }, []);

  const handleHelpful = useCallback(
    async (id: string) => {
      if (helpedIds.has(id)) return;
      setHelpedIds((prev) => new Set(prev).add(id));

      const res = await fetch(`/api/bazdmeg/faq/${id}/helpful`, {
        method: "POST",
      });
      if (res.ok) {
        const data = (await res.json()) as { helpfulCount: number };
        setEntries((prev) =>
          prev.map((e) => (e.id === id ? { ...e, helpfulCount: data.helpfulCount } : e)),
        );
      }
    },
    [helpedIds],
  );

  const handleValueChange = useCallback(
    (value: string[]) => {
      if (value.length > openItems.length) {
        onFaqExpanded?.();
      }
      setOpenItems(value);
    },
    [openItems.length, onFaqExpanded],
  );

  // Group entries by category
  const categories = [...new Set(entries.map((e) => e.category))];

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 mx-auto bg-white/10" />
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Skeleton className="h-14 w-full bg-white/10 rounded-xl" />
          </motion.div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) return null;

  const renderEntries = (items: FaqEntry[]) => (
    <Accordion
      type="multiple"
      value={openItems}
      onValueChange={handleValueChange}
      className="w-full space-y-3"
    >
      {items.map((entry, index) => {
        const isOpen = openItems.includes(entry.id);
        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
          >
            <AccordionItem
              value={entry.id}
              className={`border rounded-xl overflow-hidden transition-all duration-300 ${
                isOpen
                  ? "border-amber-500/40 bg-amber-500/5 shadow-[0_0_30px_rgba(245,158,11,0.08)]"
                  : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
              }`}
            >
              <AccordionTrigger
                className={`px-5 py-4 text-left text-base font-medium hover:no-underline transition-colors duration-200 ${
                  isOpen ? "text-amber-400" : "text-white hover:text-amber-300"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-300 ${
                      isOpen ? "bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]" : "bg-zinc-600"
                    }`}
                  />
                  {entry.question}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                <div className="pl-[18px] border-l border-amber-500/20">
                  <p className="mb-4 leading-relaxed text-zinc-300">{entry.answer}</p>
                  <AnimatePresence>
                    <motion.button
                      onClick={() => handleHelpful(entry.id)}
                      disabled={helpedIds.has(entry.id)}
                      whileHover={!helpedIds.has(entry.id) ? { scale: 1.05 } : {}}
                      whileTap={!helpedIds.has(entry.id) ? { scale: 0.95 } : {}}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                        helpedIds.has(entry.id)
                          ? "bg-amber-500/20 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                          : "bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
                      }`}
                    >
                      <ThumbsUp
                        className={`h-3 w-3 transition-transform duration-200 ${
                          helpedIds.has(entry.id) ? "scale-110" : ""
                        }`}
                      />
                      {helpedIds.has(entry.id) ? "Thanks!" : "Helpful"}{" "}
                      {entry.helpfulCount > 0 && `(${entry.helpfulCount})`}
                    </motion.button>
                  </AnimatePresence>
                </div>
              </AccordionContent>
            </AccordionItem>
          </motion.div>
        );
      })}
    </Accordion>
  );

  // If only one category, skip tabs
  if (categories.length <= 1) {
    return (
      <div>
        <motion.h2
          initial={{ opacity: 0, y: -10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10 text-center text-4xl font-bold text-white"
        >
          Frequently Asked Questions
        </motion.h2>
        <div className="mx-auto max-w-3xl">{renderEntries(entries)}</div>
      </div>
    );
  }

  return (
    <div>
      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-10 text-center text-4xl font-bold text-white"
      >
        Frequently Asked Questions
      </motion.h2>
      <div className="mx-auto max-w-3xl">
        <Tabs defaultValue={categories[0] ?? ""} className="w-full">
          <TabsList className="mb-8 w-full justify-start bg-white/5 rounded-xl p-1">
            {categories.map((cat) => (
              <TabsTrigger
                key={cat}
                value={cat}
                className="capitalize rounded-lg data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 data-[state=active]:shadow-[0_0_12px_rgba(245,158,11,0.1)] transition-all duration-200"
              >
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>
          {categories.map((cat) => (
            <TabsContent key={cat} value={cat}>
              {renderEntries(entries.filter((e) => e.category === cat))}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
