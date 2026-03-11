import { createHash } from "node:crypto";

export const ASSERTION_METADATA_FIELD = "__assertion_ids";

export type AssertionStatus = "satisfied" | "violated" | "unresolved";
export type EvidenceSupportType = "supports" | "weakens" | "conflicts";
export type EvidenceDirectness = "direct" | "indirect";

export interface CanonicalCore {
  text: string;
  version: string;
  updatedAt: string;
}

export interface AssertionRecord {
  id: string;
  text: string;
  sourceAnchor: string;
  line: number;
  section?: string | undefined;
  isCompound: boolean;
  status: AssertionStatus;
  evidenceIds: string[];
}

export interface EvidenceRecord {
  evidenceId: string;
  assertionId: string;
  source: string;
  method: string;
  timestamp: string;
  excerpt: string;
  rawResult: string;
  confidence: number;
  supportType: EvidenceSupportType;
  directness: EvidenceDirectness;
}

export interface AssertionRuntimeSnapshot {
  core: CanonicalCore | null;
  assertions: AssertionRecord[];
  evidence: EvidenceRecord[];
}

export interface ToolEvidenceInput {
  toolName: string;
  result: string;
  isError: boolean;
  assertionIds?: string[];
}

export interface AssertionReportEntry {
  assertion: AssertionRecord;
  evidence: EvidenceRecord[];
}

export interface AssertionReport {
  satisfied: AssertionReportEntry[];
  violated: AssertionReportEntry[];
  unresolved: AssertionReportEntry[];
}

const ASSERTION_PATTERNS = [
  /\bmust not\b/i,
  /\bmust\b/i,
  /\bshould not\b/i,
  /\bshould\b/i,
  /\bdo not\b/i,
  /\bnever\b/i,
  /\bonly if\b/i,
  /\bcannot\b/i,
  /!=/,
  /=>/,
];

const POSITIVE_EVIDENCE =
  /\b(pass|passed|success|succeeded|verified|valid|ok|complete|completed|created|updated|ready)\b/i;
const NEGATIVE_EVIDENCE =
  /\b(fail|failed|error|invalid|denied|missing|unable|conflict|violat|not found)\b/i;
const EVIDENCE_EXCERPT_LIMIT = 220;
const SATISFIED_THRESHOLD = 0.85;
const VIOLATED_THRESHOLD = 0.85;

function normalizeCoreText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function stripAssertionPrefix(line: string): string {
  return line
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function buildCoreVersion(text: string): string {
  return createHash("sha1").update(text).digest("hex").slice(0, 12);
}

function truncateExcerpt(value: string): string {
  return value.length <= EVIDENCE_EXCERPT_LIMIT
    ? value
    : `${value.slice(0, EVIDENCE_EXCERPT_LIMIT - 3)}...`;
}

function isAssertionCandidate(line: string): boolean {
  if (!line) return false;
  if (line.startsWith("#")) return false;
  if (/^[A-Z][A-Za-z /-]+:$/.test(line)) return false;

  const stripped = stripAssertionPrefix(line);
  if (!stripped) return false;

  return ASSERTION_PATTERNS.some((pattern) => pattern.test(stripped)) || /^[*-]\s+/.test(line);
}

function createAssertionId(line: number, text: string): string {
  const slug = slugify(text) || "assertion";
  return `a${line}-${slug}`;
}

function isCompoundAssertion(text: string): boolean {
  return /\b(and|or)\b/i.test(text) && /[,;:]/.test(text);
}

function classifyEvidence(
  result: string,
  isError: boolean,
): Pick<EvidenceRecord, "supportType" | "directness" | "confidence"> {
  if (isError) {
    return { supportType: "conflicts", directness: "direct", confidence: 0.95 };
  }

  if (NEGATIVE_EVIDENCE.test(result)) {
    return { supportType: "conflicts", directness: "direct", confidence: 0.88 };
  }

  if (POSITIVE_EVIDENCE.test(result)) {
    return { supportType: "supports", directness: "direct", confidence: 0.88 };
  }

  return { supportType: "supports", directness: "indirect", confidence: 0.55 };
}

function scoreEvidence(evidence: EvidenceRecord): number {
  return evidence.confidence * (evidence.directness === "direct" ? 1 : 0.6);
}

export function extractAssertionsFromCore(text: string): AssertionRecord[] {
  const normalized = normalizeCoreText(text);
  if (!normalized) return [];

  const assertions: AssertionRecord[] = [];
  const seen = new Set<string>();
  let currentSection: string | undefined;

  const lines = normalized.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const rawLine = lines[index] ?? "";
    const trimmed = rawLine.trim();
    const lineNumber = index + 1;

    if (!trimmed) continue;

    if (trimmed.startsWith("##")) {
      currentSection = trimmed.replace(/^#+\s*/, "").trim();
      continue;
    }

    if (!isAssertionCandidate(trimmed)) continue;

    const textValue = stripAssertionPrefix(trimmed);
    const normalizedKey = textValue.toLowerCase();
    if (seen.has(normalizedKey)) continue;
    seen.add(normalizedKey);

    assertions.push({
      id: createAssertionId(lineNumber, textValue),
      text: textValue,
      sourceAnchor: currentSection ? `${currentSection}:line ${lineNumber}` : `line ${lineNumber}`,
      line: lineNumber,
      section: currentSection,
      isCompound: isCompoundAssertion(textValue),
      status: "unresolved",
      evidenceIds: [],
    });
  }

  if (assertions.length > 0) {
    return assertions;
  }

  return [
    {
      id: createAssertionId(1, normalized),
      text: normalized,
      sourceAnchor: "line 1",
      line: 1,
      isCompound: isCompoundAssertion(normalized),
      status: "unresolved",
      evidenceIds: [],
    },
  ];
}

export function stripAssertionMetadata(input: Record<string, unknown>): {
  cleanInput: Record<string, unknown>;
  assertionIds: string[];
} {
  const cleanInput = { ...input };
  const rawIds = cleanInput[ASSERTION_METADATA_FIELD];
  delete cleanInput[ASSERTION_METADATA_FIELD];

  const assertionIds = Array.isArray(rawIds)
    ? rawIds.filter((value): value is string => typeof value === "string")
    : [];

  return { cleanInput, assertionIds };
}

function formatAssertionList(assertions: AssertionRecord[]): string {
  if (assertions.length === 0) {
    return "No assertions extracted.";
  }

  return assertions
    .map((assertion) => {
      const compound = assertion.isCompound ? " [compound]" : "";
      return `- ${assertion.id} [${assertion.status}] ${assertion.text}${compound} (${assertion.sourceAnchor})`;
    })
    .join("\n");
}

function formatEvidenceList(evidence: EvidenceRecord[]): string {
  if (evidence.length === 0) {
    return "No evidence recorded.";
  }

  return evidence
    .map(
      (item) =>
        `- ${item.evidenceId} ${item.assertionId} ${item.supportType} ${item.confidence.toFixed(
          2,
        )} ${item.source}: ${item.excerpt}`,
    )
    .join("\n");
}

export class AssertionRuntime {
  private core: CanonicalCore | null = null;
  private assertions = new Map<string, AssertionRecord>();
  private evidence: EvidenceRecord[] = [];

  hasCanonicalCore(): boolean {
    return this.core !== null;
  }

  getCanonicalCore(): CanonicalCore | null {
    return this.core;
  }

  setCanonicalCore(text: string, updatedAt = new Date().toISOString()): CanonicalCore {
    const normalized = normalizeCoreText(text);
    if (!normalized) {
      throw new Error("Canonical core cannot be empty");
    }

    const core: CanonicalCore = {
      text: normalized,
      version: buildCoreVersion(normalized),
      updatedAt,
    };

    this.core = core;
    this.evidence = [];
    this.assertions = new Map(
      extractAssertionsFromCore(normalized).map((assertion) => [assertion.id, assertion]),
    );

    return core;
  }

  clear(): void {
    this.core = null;
    this.assertions.clear();
    this.evidence = [];
  }

  getAssertions(): AssertionRecord[] {
    return [...this.assertions.values()];
  }

  getEvidence(assertionId?: string): EvidenceRecord[] {
    if (!assertionId) {
      return [...this.evidence];
    }

    return this.evidence.filter((item) => item.assertionId === assertionId);
  }

  getSnapshot(): AssertionRuntimeSnapshot {
    return {
      core: this.core ? { ...this.core } : null,
      assertions: this.getAssertions().map((assertion) => ({ ...assertion })),
      evidence: this.evidence.map((item) => ({ ...item })),
    };
  }

  loadSnapshot(snapshot: AssertionRuntimeSnapshot | null | undefined): void {
    if (!snapshot?.core) {
      this.clear();
      return;
    }

    this.core = { ...snapshot.core };
    this.assertions = new Map(
      (snapshot.assertions ?? []).map((assertion) => [assertion.id, { ...assertion }]),
    );
    this.evidence = (snapshot.evidence ?? []).map((item) => ({ ...item }));
    this.recomputeAssertionStatuses();
  }

  buildSystemPrompt(): string {
    if (!this.core) return "";

    return [
      "## Assertion-Grounded Runtime",
      "Treat the canonical core below as the source of truth. Do not introduce new business logic that is not present in the core.",
      `When you call tools to gather or verify evidence, include an optional ${ASSERTION_METADATA_FIELD} array with the assertion IDs that the call is meant to test. The runtime strips that field before executing the tool.`,
      "Do not treat task completion as proof. Assertions stay unresolved until evidence is direct enough.",
      "",
      "### Canonical Core",
      this.core.text,
      "",
      "### Active Assertions",
      formatAssertionList(this.getAssertions()),
    ].join("\n");
  }

  recordToolEvidence(input: ToolEvidenceInput): EvidenceRecord[] {
    const assertionIds = [...new Set(input.assertionIds ?? [])].filter((id) =>
      this.assertions.has(id),
    );
    if (assertionIds.length === 0) {
      return [];
    }

    const evidenceTemplate = classifyEvidence(input.result, input.isError);
    const timestamp = new Date().toISOString();
    const excerpt = truncateExcerpt(input.result);

    const recorded = assertionIds.map((assertionId, index) => {
      const evidenceId = `e${this.evidence.length + index + 1}`;
      return {
        evidenceId,
        assertionId,
        source: input.toolName,
        method: input.isError ? "tool-error" : "tool-result",
        timestamp,
        excerpt,
        rawResult: input.result,
        ...evidenceTemplate,
      } satisfies EvidenceRecord;
    });

    this.evidence.push(...recorded);

    for (const evidence of recorded) {
      const assertion = this.assertions.get(evidence.assertionId);
      if (!assertion) continue;
      assertion.evidenceIds = [...assertion.evidenceIds, evidence.evidenceId];
      this.assertions.set(assertion.id, assertion);
    }

    this.recomputeAssertionStatuses();
    return recorded;
  }

  buildReport(): AssertionReport {
    const entries = this.getAssertions().map((assertion) => ({
      assertion,
      evidence: this.getEvidence(assertion.id),
    }));

    return {
      satisfied: entries.filter((entry) => entry.assertion.status === "satisfied"),
      violated: entries.filter((entry) => entry.assertion.status === "violated"),
      unresolved: entries.filter((entry) => entry.assertion.status === "unresolved"),
    };
  }

  formatAssertions(): string {
    if (!this.core) {
      return "No canonical core configured.";
    }

    return formatAssertionList(this.getAssertions());
  }

  formatEvidence(assertionId?: string): string {
    if (!this.core) {
      return "No canonical core configured.";
    }

    if (assertionId && !this.assertions.has(assertionId)) {
      return `Unknown assertion: ${assertionId}`;
    }

    return formatEvidenceList(this.getEvidence(assertionId));
  }

  formatReport(): string {
    if (!this.core) {
      return "No canonical core configured.";
    }

    const report = this.buildReport();
    const formatSection = (label: string, entries: AssertionReportEntry[]) => {
      if (entries.length === 0) {
        return `${label}: none`;
      }

      return `${label}:\n${entries
        .map((entry) => {
          const evidenceSummary =
            entry.evidence.length === 0
              ? "no evidence"
              : entry.evidence
                  .map(
                    (item) =>
                      `${item.evidenceId} ${item.supportType} ${item.confidence.toFixed(2)}`,
                  )
                  .join(", ");
          return `- ${entry.assertion.id} ${entry.assertion.text} (${evidenceSummary})`;
        })
        .join("\n")}`;
    };

    return [
      `Canonical core ${this.core.version}`,
      formatSection("Satisfied", report.satisfied),
      formatSection("Violated", report.violated),
      formatSection("Unresolved", report.unresolved),
    ].join("\n");
  }

  private recomputeAssertionStatuses(): void {
    for (const assertion of this.assertions.values()) {
      const evidence = this.getEvidence(assertion.id);
      if (evidence.length === 0) {
        assertion.status = "unresolved";
        continue;
      }

      const supportScore = evidence
        .filter((item) => item.supportType === "supports")
        .reduce((sum, item) => sum + scoreEvidence(item), 0);
      const conflictScore = evidence
        .filter((item) => item.supportType === "conflicts")
        .reduce((sum, item) => sum + scoreEvidence(item), 0);
      const weakeningScore = evidence
        .filter((item) => item.supportType === "weakens")
        .reduce((sum, item) => sum + scoreEvidence(item), 0);

      if (supportScore > 0 && (conflictScore > 0 || weakeningScore > 0)) {
        assertion.status = "unresolved";
        continue;
      }

      if (supportScore >= SATISFIED_THRESHOLD && conflictScore === 0 && weakeningScore === 0) {
        assertion.status = "satisfied";
        continue;
      }

      if (conflictScore >= VIOLATED_THRESHOLD && supportScore === 0) {
        assertion.status = "violated";
        continue;
      }

      assertion.status = "unresolved";
    }
  }
}
