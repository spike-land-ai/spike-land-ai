"use client";

import { SkillsBar } from "@/components/create/skills-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import type { MatchedSkill } from "@/lib/create/content-generator";
import { AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface GenerateResult {
  topic: string;
  keywords: string[];
  matchedSkills: MatchedSkill[];
  systemPrompt: string;
  userPrompt: string;
}

export function GenerateExplorer() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSystem, setShowSystem] = useState(false);
  const [showUser, setShowUser] = useState(false);

  const debouncedQuery = useDebounce(query, 500);

  const fetchPrompt = useCallback(async (topic: string) => {
    if (topic.length < 2) {
      setResult(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/create/generate?topic=${encodeURIComponent(topic)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch (e) {
      console.error("Failed to fetch prompt:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrompt(debouncedQuery);
  }, [debouncedQuery, fetchPrompt]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
        <Input
          className="pl-10 py-6 text-lg"
          placeholder="Type a topic (e.g. 'games/tetris', 'music player')"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <AnimatePresence>
        <SkillsBar query={debouncedQuery} />
      </AnimatePresence>

      {loading && (
        <p className="text-sm text-muted-foreground animate-pulse">
          Analyzing topic...
        </p>
      )}

      {result && !loading && (
        <div className="space-y-4">
          {/* Keywords */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Extracted Keywords
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {result.keywords.map(kw => <Badge key={kw} variant="secondary">{kw}</Badge>)}
              </div>
            </CardContent>
          </Card>

          {/* Matched Skills */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Matched Skills ({result.matchedSkills.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.matchedSkills.length === 0
                ? (
                  <p className="text-sm text-muted-foreground">
                    No skills matched — fallback libraries will be included.
                  </p>
                )
                : (
                  <div className="space-y-2">
                    {result.matchedSkills.map(skill => (
                      <div
                        key={skill.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span>{skill.icon}</span>
                        <span className="font-medium">{skill.name}</span>
                        <span className="text-muted-foreground">
                          — {skill.description}
                        </span>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {skill.categoryLabel}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
            </CardContent>
          </Card>

          {/* System Prompt */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  System Prompt
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSystem(!showSystem)}
                >
                  {showSystem
                    ? <ChevronUp className="h-4 w-4" />
                    : <ChevronDown className="h-4 w-4" />}
                  <span className="ml-1">
                    {showSystem ? "Collapse" : "Expand"}
                  </span>
                </Button>
              </div>
            </CardHeader>
            {showSystem && (
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {result.systemPrompt}
                </pre>
              </CardContent>
            )}
          </Card>

          {/* User Prompt */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  User Prompt
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUser(!showUser)}
                >
                  {showUser
                    ? <ChevronUp className="h-4 w-4" />
                    : <ChevronDown className="h-4 w-4" />}
                  <span className="ml-1">
                    {showUser ? "Collapse" : "Expand"}
                  </span>
                </Button>
              </div>
            </CardHeader>
            {showUser && (
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto whitespace-pre-wrap">
                  {result.userPrompt}
                </pre>
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
