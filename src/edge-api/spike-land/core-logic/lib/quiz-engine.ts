/**
 * Quiz Engine — Pure business logic for the learning quiz system.
 *
 * Verification-through-questions: content → article → quiz → badge.
 * Multiple-choice with reframing, conflict detection, consistency verification.
 *
 * Algorithm:
 * - 4 options per question, correct answer randomized
 * - 3 questions per round, each testing a different concept
 * - Each concept has 3+ variant questions (reframings of same idea)
 * - Concept mastery = 2+ correct answers across different variants
 * - Contradiction detection: if answer conflicts with previous correct answer
 *   on same concept, mastery resets to 0
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QuizQuestion {
  conceptIndex: number;
  variantIndex: number;
  question: string;
  options: [string, string, string, string];
  correctIndex: number; // 0-3
}

export interface QuizRound {
  roundNumber: number;
  questions: [QuizQuestion, QuizQuestion, QuizQuestion];
}

export interface ConceptState {
  name: string;
  correctCount: number;
  attempts: number;
  mastered: boolean;
  /** Track which option index was chosen for each variant to detect conflicts */
  answerHistory: Map<number, number>;
}

export interface QuizSession {
  id: string;
  userId: string;
  article: string;
  concepts: ConceptDefinition[];
  conceptStates: ConceptState[];
  currentRound: QuizRound;
  roundNumber: number;
  conflicts: ConflictRecord[];
  completed: boolean;
  score: number;
  createdAt: number;
  completedAt: number | null;
}

export interface ConceptDefinition {
  name: string;
  variants: QuizVariant[];
}

export interface QuizVariant {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
}

export interface ConflictRecord {
  concept: string;
  round: number;
  detail: string;
}

export interface AnswerResult {
  questionIndex: number;
  concept: string;
  correct: boolean;
  conflict: boolean;
}

export interface BadgePayload {
  sid: string;
  topic: string;
  score: number;
  ts: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const MASTERY_THRESHOLD = 2;
export const OPTIONS_PER_QUESTION = 4;
export const QUESTIONS_PER_ROUND = 3;

// ─── In-memory session storage ──────────────────────────────────────────────

const sessions = new Map<string, QuizSession>();

export function clearQuizSessions(): void {
  sessions.clear();
}

export function getSession(id: string): QuizSession | undefined {
  return sessions.get(id);
}

export function setSession(id: string, session: QuizSession): void {
  sessions.set(id, session);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Deterministic pseudo-random based on content hash */
function deterministicRandom(content: string, conceptIdx: number, variantIdx: number): number {
  let hash = 0;
  const seed = `${content.slice(0, 100)}:${conceptIdx}:${variantIdx}`;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash % 1000) / 1000;
}

export function truncate(s: string, maxLen: number): string {
  return s.length <= maxLen ? s : s.slice(0, maxLen - 3) + "...";
}

function generateVariantQuestion(keySentence: string, variant: number): string {
  const prefix = truncate(keySentence, 40);
  switch (variant) {
    case 0:
      return `Which statement about "${prefix}" is correct?`;
    case 1:
      return `Regarding "${prefix}", which is true?`;
    case 2:
      return `What best describes "${prefix}"?`;
    default:
      return `About "${prefix}":`;
  }
}

function generateOptions(
  keySentence: string,
  _variant: number,
  correctIndex: number,
): [string, string, string, string] {
  const prefix = truncate(keySentence, 30);
  const correct = `This accurately reflects: ${prefix}`;
  const distractors = [
    `This contradicts: ${prefix}`,
    `This is unrelated to: ${prefix}`,
    `This oversimplifies: ${prefix}`,
  ];

  const options: string[] = [];
  let distractorIdx = 0;
  for (let i = 0; i < OPTIONS_PER_QUESTION; i++) {
    if (i === correctIndex) {
      options.push(correct);
    } else {
      options.push(distractors[distractorIdx++] ?? `Distractor ${i}`);
    }
  }
  return options as [string, string, string, string];
}

function getDefaultConcepts(): ConceptDefinition[] {
  return [
    {
      name: "Core understanding",
      variants: [
        {
          question: "What is the main topic of this content?",
          options: [
            "The primary subject discussed",
            "An unrelated topic",
            "A minor detail",
            "Background information",
          ],
          correctIndex: 0,
        },
        {
          question: "Which best describes the central theme?",
          options: [
            "A secondary theme",
            "The main theme of the content",
            "An opposing viewpoint",
            "A tangential idea",
          ],
          correctIndex: 1,
        },
        {
          question: "The content primarily focuses on:",
          options: [
            "Unrelated matters",
            "Historical context only",
            "The core subject matter",
            "Future predictions",
          ],
          correctIndex: 2,
        },
      ],
    },
    {
      name: "Key details",
      variants: [
        {
          question: "Which detail is most important to the content?",
          options: [
            "A minor footnote",
            "A key supporting detail",
            "An unmentioned fact",
            "A contradicting claim",
          ],
          correctIndex: 1,
        },
        {
          question: "What supporting evidence is presented?",
          options: [
            "The main evidence from the content",
            "No evidence at all",
            "Only anecdotal claims",
            "Only statistical data",
          ],
          correctIndex: 0,
        },
        {
          question: "The most significant detail mentioned is:",
          options: [
            "Something not in the content",
            "A trivial aside",
            "An important supporting fact",
            "A disputed claim",
          ],
          correctIndex: 2,
        },
      ],
    },
    {
      name: "Implications",
      variants: [
        {
          question: "What can be inferred from this content?",
          options: [
            "Nothing meaningful",
            "A key implication",
            "The opposite of what's stated",
            "An unrelated conclusion",
          ],
          correctIndex: 1,
        },
        {
          question: "The content implies that:",
          options: [
            "A logical conclusion from the content",
            "Something contradictory",
            "Something completely unrelated",
            "The content has no implications",
          ],
          correctIndex: 0,
        },
        {
          question: "Based on the content, which is most likely true?",
          options: [
            "Something unrelated",
            "Something contradicted by the content",
            "Something not discussed",
            "A reasonable inference from the content",
          ],
          correctIndex: 3,
        },
      ],
    },
  ];
}

// ─── Concept Generation ─────────────────────────────────────────────────────

/** Heuristic fallback for concept extraction. */
export function generateConceptsHeuristic(content: string): ConceptDefinition[] {
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);

  if (paragraphs.length === 0) {
    return getDefaultConcepts();
  }

  const concepts: ConceptDefinition[] = [];
  const numConcepts = Math.min(6, Math.max(3, paragraphs.length));

  for (let i = 0; i < numConcepts; i++) {
    const paragraph = paragraphs[i % paragraphs.length] ?? "";
    const sentences = paragraph.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    const keySentence = sentences[0]?.trim() ?? `Concept ${i + 1}`;

    const variants: QuizVariant[] = [];
    for (let v = 0; v < 3; v++) {
      const correctIndex = Math.floor(deterministicRandom(content, i, v) * OPTIONS_PER_QUESTION);
      variants.push({
        question: generateVariantQuestion(keySentence, v),
        options: generateOptions(keySentence, v, correctIndex),
        correctIndex,
      });
    }

    concepts.push({
      name: truncate(keySentence, 60),
      variants,
    });
  }

  return concepts;
}

/**
 * Generate concepts from content using Gemini API with heuristic fallback.
 */
export async function generateConceptsFromContent(
  content: string,
  geminiApiKey: string | undefined,
): Promise<ConceptDefinition[]> {
  if (geminiApiKey) {
    try {
      const systemPrompt = `You are an expert educator. Extract exactly 6 key concepts from the following content and generate 3 multiple-choice questions for each.
Each concept should be a distinct, important idea from the text.
Each question must have 4 options and exactly one correct answer.
Generate the output in strict JSON format:
{
  "concepts": [
    {
      "name": "Concept Name",
      "variants": [
        {
          "question": "Question text?",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctIndex": 0
        }
      ]
    }
  ]
}`;
      const userPrompt = `Content to process:\n\n${content.slice(0, 15000)}`;

      const body = {
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.2,
          response_mime_type: "application/json",
        },
        systemInstruction: { parts: [{ text: systemPrompt }] },
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          if (parsed.concepts && Array.isArray(parsed.concepts)) {
            return parsed.concepts;
          }
        }
      }
    } catch (err) {
      console.error("[Quiz] Gemini generation failed, falling back to heuristic:", err);
    }
  }

  return generateConceptsHeuristic(content);
}

// ─── Planning Interview Concepts ────────────────────────────────────────────

const PLANNING_CONCEPT_NAMES = [
  "file_awareness",
  "test_strategy",
  "edge_cases",
  "dependency_chain",
  "failure_modes",
  "verification",
] as const;

/** Default planning concepts when Gemini is unavailable. Task-agnostic but still useful. */
function getDefaultPlanningConcepts(): ConceptDefinition[] {
  return [
    {
      name: "file_awareness",
      variants: [
        {
          question: "Before making changes, which files should you identify first?",
          options: [
            "Source files, test files, and config files that will be affected",
            "Only the main source file",
            "All files in the repository",
            "Only the test files",
          ],
          correctIndex: 0,
        },
        {
          question: "When modifying a function used across multiple modules, what must you check?",
          options: [
            "Only the file containing the function",
            "Every file that imports or depends on that function",
            "Only the test file for that function",
            "Only the README",
          ],
          correctIndex: 1,
        },
        {
          question: "Which approach best identifies the blast radius of a change?",
          options: [
            "Reading the git log",
            "Checking code coverage reports",
            "Tracing imports and call sites across the codebase",
            "Running the linter",
          ],
          correctIndex: 2,
        },
      ],
    },
    {
      name: "test_strategy",
      variants: [
        {
          question: "What type of test best validates business logic in isolation?",
          options: [
            "End-to-end browser tests",
            "Unit tests with mocked dependencies",
            "Manual testing",
            "Load testing",
          ],
          correctIndex: 1,
        },
        {
          question: "When should you write an integration test instead of a unit test?",
          options: [
            "Always prefer integration tests",
            "When testing pure functions",
            "When verifying the interaction between multiple components",
            "Only for UI components",
          ],
          correctIndex: 2,
        },
        {
          question: "What is the most important thing to test about error handling?",
          options: [
            "That errors are logged to the console",
            "That the system recovers gracefully and communicates the failure clearly",
            "That errors never occur",
            "That all errors are caught silently",
          ],
          correctIndex: 1,
        },
      ],
    },
    {
      name: "edge_cases",
      variants: [
        {
          question: "Which input should you always test for in a function that accepts strings?",
          options: [
            "Only valid strings",
            "Empty string, null/undefined, and extremely long strings",
            "Only strings with special characters",
            "Only numeric strings",
          ],
          correctIndex: 1,
        },
        {
          question: "What edge case is most commonly missed in async operations?",
          options: [
            "Successful completion",
            "Slow network responses",
            "Race conditions and concurrent execution",
            "JSON parsing",
          ],
          correctIndex: 2,
        },
        {
          question: "When a function has a timeout parameter, which value should you test?",
          options: [
            "Only the default timeout",
            "Zero, negative values, and values exceeding the maximum",
            "Only very large timeouts",
            "Only the value from the spec",
          ],
          correctIndex: 1,
        },
      ],
    },
    {
      name: "dependency_chain",
      variants: [
        {
          question: "Before adding a new dependency, what should you verify?",
          options: [
            "That it has the most GitHub stars",
            "That it is compatible with your runtime, actively maintained, and not duplicating existing functionality",
            "That it was written in TypeScript",
            "That it has no dependencies of its own",
          ],
          correctIndex: 1,
        },
        {
          question: "When updating an internal package, what must happen first?",
          options: [
            "Update all consumers simultaneously",
            "Build and test the package, then update consumers one at a time",
            "Skip testing and deploy directly",
            "Wait for someone else to test it",
          ],
          correctIndex: 1,
        },
        {
          question:
            "What is the correct build order when package A depends on B, and B depends on C?",
          options: ["A → B → C", "Build all three in parallel", "C → B → A", "B → A → C"],
          correctIndex: 2,
        },
      ],
    },
    {
      name: "failure_modes",
      variants: [
        {
          question: "What should happen when an external API call fails?",
          options: [
            "Crash the entire application",
            "Silently ignore the error",
            "Return a meaningful error, retry if appropriate, and degrade gracefully",
            "Log the error and continue with stale data without telling the user",
          ],
          correctIndex: 2,
        },
        {
          question:
            "When a database migration fails halfway through, what is the correct approach?",
          options: [
            "Delete the database and start over",
            "Retry the migration immediately",
            "Roll back the partial changes and investigate before retrying",
            "Ignore the failure and proceed",
          ],
          correctIndex: 2,
        },
        {
          question: "What is the biggest risk of deploying without a rollback plan?",
          options: [
            "The deploy takes longer",
            "Extended downtime if the new version has a critical bug",
            "Using too much disk space",
            "Having too many git branches",
          ],
          correctIndex: 1,
        },
      ],
    },
    {
      name: "verification",
      variants: [
        {
          question: "How do you prove that a bug fix actually works?",
          options: [
            "Deploy it and wait for user reports",
            "Write a regression test that fails before the fix and passes after",
            "Read the code and decide it looks correct",
            "Ask a colleague to review the PR title",
          ],
          correctIndex: 1,
        },
        {
          question: "After deploying a change, what is the minimum verification?",
          options: [
            "Check that CI passed",
            "Verify the feature works in production and monitor error rates",
            "Send a message saying it is done",
            "Close the ticket immediately",
          ],
          correctIndex: 1,
        },
        {
          question: "What metric best indicates a successful deployment?",
          options: [
            "Number of lines changed",
            "Speed of the deployment pipeline",
            "Error rate staying at or below pre-deploy levels",
            "Number of approvals on the PR",
          ],
          correctIndex: 2,
        },
      ],
    },
  ];
}

/**
 * Generate planning interview concepts using Gemini API with hardcoded fallback.
 * Unlike content-based quiz concepts, these are always structured around the
 * 6 BAZDMEG planning concepts, contextualized to the specific task.
 */
export async function generatePlanningConcepts(
  taskDescription: string,
  packageName: string | undefined,
  geminiApiKey: string | undefined,
): Promise<ConceptDefinition[]> {
  if (geminiApiKey) {
    try {
      const conceptList = PLANNING_CONCEPT_NAMES.join(", ");
      const pkgContext = packageName ? ` in package "${packageName}"` : "";
      const systemPrompt = `You are an expert software engineering interviewer. Given a task description, generate multiple-choice questions that test the developer's understanding across exactly 6 planning concepts: ${conceptList}.

For each concept, create 3 variant questions (different framings of the same concept). Each question must have exactly 4 options and exactly 1 correct answer. Questions should be specific to the task described, not generic.

Return strict JSON:
{
  "concepts": [
    {
      "name": "file_awareness",
      "variants": [
        { "question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0 }
      ]
    }
  ]
}`;
      const userPrompt = `Task${pkgContext}: ${taskDescription}`;

      const body = {
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.3,
          response_mime_type: "application/json",
        },
        systemInstruction: { parts: [{ text: systemPrompt }] },
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text) as { concepts?: ConceptDefinition[] };
          if (parsed.concepts && Array.isArray(parsed.concepts) && parsed.concepts.length === 6) {
            return parsed.concepts;
          }
        }
      }
    } catch (err) {
      console.error("[Planning] Gemini generation failed, falling back to defaults:", err);
    }
  }

  return getDefaultPlanningConcepts();
}

// ─── Round Generation ───────────────────────────────────────────────────────

/** Pick the next round of questions, choosing unmastered concepts and unused variants */
export function generateNextRound(session: QuizSession): QuizRound {
  const unmasteredConcepts = session.conceptStates
    .map((state, idx) => ({ state, idx }))
    .filter(({ state }) => !state.mastered);

  // Pick up to 3 unmastered concepts
  const selected: { state: ConceptState; idx: number }[] = [];
  const shuffled = [...unmasteredConcepts];
  // Fisher-Yates with deterministic seed
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.abs((session.roundNumber * 31 + i * 17) % (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  for (const item of shuffled) {
    if (selected.length >= QUESTIONS_PER_ROUND) break;
    selected.push(item);
  }

  // If not enough unmastered, re-test mastered ones
  if (selected.length < QUESTIONS_PER_ROUND) {
    const mastered = session.conceptStates
      .map((state, idx) => ({ state, idx }))
      .filter(({ state }) => state.mastered);
    for (const item of mastered) {
      if (selected.length >= QUESTIONS_PER_ROUND) break;
      selected.push(item);
    }
  }

  // Pad with first concepts if still not enough
  while (selected.length < QUESTIONS_PER_ROUND) {
    const idx = selected.length % session.conceptStates.length;
    selected.push({
      state: session.conceptStates[idx]!,
      idx,
    });
  }

  const questions = selected.map(({ state, idx }) => {
    const concept = session.concepts[idx]!;
    // Pick a variant not yet answered
    const usedVariants = new Set(state.answerHistory.keys());
    let variantIdx = 0;
    for (let v = 0; v < concept.variants.length; v++) {
      if (!usedVariants.has(v)) {
        variantIdx = v;
        break;
      }
    }
    // If all used, cycle back
    if (usedVariants.size >= concept.variants.length) {
      variantIdx = state.attempts % concept.variants.length;
    }

    const variant = concept.variants[variantIdx]!;
    return {
      conceptIndex: idx,
      variantIndex: variantIdx,
      question: variant.question,
      options: variant.options,
      correctIndex: variant.correctIndex,
    } satisfies QuizQuestion;
  });

  return {
    roundNumber: session.roundNumber,
    questions: questions as [QuizQuestion, QuizQuestion, QuizQuestion],
  };
}

// ─── Answer Evaluation ──────────────────────────────────────────────────────

/** Evaluate answers for a round. Returns results, detects conflicts, updates mastery. */
export function evaluateAnswers(
  session: QuizSession,
  answers: [number, number, number],
): {
  results: AnswerResult[];
  conflicts: ConflictRecord[];
  allMastered: boolean;
} {
  const results: AnswerResult[] = [];
  const newConflicts: ConflictRecord[] = [];

  for (let i = 0; i < QUESTIONS_PER_ROUND; i++) {
    const question = session.currentRound.questions[i]!;
    const answer = answers[i]!;
    const conceptState = session.conceptStates[question.conceptIndex]!;
    const concept = session.concepts[question.conceptIndex]!;
    const isCorrect = answer === question.correctIndex;

    // Check for conflict: did user previously answer a different variant of this concept
    // correctly, but now answered incorrectly (or chose a conflicting answer)?
    let hasConflict = false;
    if (conceptState.answerHistory.size > 0) {
      for (const [prevVariant, prevAnswer] of conceptState.answerHistory) {
        const prevVariantDef = concept.variants[prevVariant];
        if (prevVariantDef && prevAnswer === prevVariantDef.correctIndex && !isCorrect) {
          hasConflict = true;
          const conflict: ConflictRecord = {
            concept: concept.name,
            round: session.roundNumber,
            detail: `Previously correct on variant ${prevVariant}, now incorrect on variant ${question.variantIndex}`,
          };
          newConflicts.push(conflict);
          session.conflicts.push(conflict);

          // Reset mastery for this concept
          conceptState.correctCount = 0;
          conceptState.mastered = false;
          break;
        }
      }
    }

    // Record this answer
    conceptState.answerHistory.set(question.variantIndex, answer);
    conceptState.attempts++;

    if (isCorrect && !hasConflict) {
      conceptState.correctCount++;
      if (conceptState.correctCount >= MASTERY_THRESHOLD) {
        conceptState.mastered = true;
      }
    }

    results.push({
      questionIndex: i,
      concept: concept.name,
      correct: isCorrect,
      conflict: hasConflict,
    });
  }

  const allMastered = session.conceptStates.every((s) => s.mastered);
  return { results, conflicts: newConflicts, allMastered };
}

// ─── Scoring ────────────────────────────────────────────────────────────────

/** Compute overall score as percentage */
export function computeScore(session: QuizSession): number {
  const totalCorrect = session.conceptStates.reduce((sum, s) => sum + s.correctCount, 0);
  const totalAttempts = session.conceptStates.reduce((sum, s) => sum + s.attempts, 0);
  if (totalAttempts === 0) return 0;
  return Math.round((totalCorrect / totalAttempts) * 100);
}

// ─── Badge Tokens ───────────────────────────────────────────────────────────

/** Generate a self-contained signed badge token */
export function generateBadgeToken(payload: BadgePayload, secret: string): string {
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = btoa(payloadStr);

  let hash = 0;
  const signInput = payloadStr + secret;
  for (let i = 0; i < signInput.length; i++) {
    const char = signInput.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const sigB64 = btoa(String(Math.abs(hash)));

  return `${payloadB64}.${sigB64}`;
}

/** Verify a badge token */
export function verifyBadgeToken(token: string, secret: string): BadgePayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  try {
    const payloadStr = atob(payloadB64);
    const payload = JSON.parse(payloadStr) as BadgePayload;

    const expectedToken = generateBadgeToken(payload, secret);
    const expectedSig = expectedToken.split(".")[1];
    if (sigB64 !== expectedSig) return null;

    return payload;
  } catch {
    return null;
  }
}

// ─── Sanitization ───────────────────────────────────────────────────────────

/** Sanitize round data for client (strip correct answers) */
export function sanitizeRound(round: QuizRound): {
  roundNumber: number;
  questions: Array<{
    conceptIndex: number;
    question: string;
    options: [string, string, string, string];
  }>;
} {
  return {
    roundNumber: round.roundNumber,
    questions: round.questions.map((q) => ({
      conceptIndex: q.conceptIndex,
      question: q.question,
      options: q.options,
    })),
  };
}

// ─── Session Factory ────────────────────────────────────────────────────────

/** Create initial concept states from concept definitions */
export function createConceptStates(concepts: ConceptDefinition[]): ConceptState[] {
  return concepts.map((c) => ({
    name: c.name,
    correctCount: 0,
    attempts: 0,
    mastered: false,
    answerHistory: new Map(),
  }));
}

/** Create a new quiz session (without storing it) */
export function createQuizSession(
  id: string,
  userId: string,
  articleContent: string,
  concepts: ConceptDefinition[],
): QuizSession {
  const conceptStates = createConceptStates(concepts);

  const session: QuizSession = {
    id,
    userId,
    article: articleContent,
    concepts,
    conceptStates,
    currentRound: {
      roundNumber: 0,
      questions: [] as unknown as [QuizQuestion, QuizQuestion, QuizQuestion],
    },
    roundNumber: 1,
    conflicts: [],
    completed: false,
    score: 0,
    createdAt: Date.now(),
    completedAt: null,
  };

  session.currentRound = generateNextRound(session);
  return session;
}
