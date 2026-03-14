export function GovPage() {
  return (
    <div className="rubik-container bg-amber-50 min-h-screen">
      <article className="article-base mx-auto max-w-screen-md px-6 py-16 space-y-12">
        {/* Hero */}
        <header className="space-y-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            The Governance of spike.land
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Where Rubik's geometric precision meets Erdos's collaborative fire. Governance from The
            Book — decisions so elegant they feel inevitable.
          </p>
          <p className="text-sm font-semibold tracking-widest uppercase text-amber-700">
            My brain is open to governance
          </p>
        </header>

        {/* Decision Process */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Decision Process</h2>
          <p>
            spike.land does not govern by title, seniority, or volume. A decision is valid when it
            is backed by <strong>proof</strong> — working code, passing tests, measured improvement.
          </p>
          <blockquote className="border-l-4 border-amber-600 pl-4 italic text-muted-foreground">
            "The most junior epsilon with a green CI pipeline outranks the most senior voice with
            only opinions."
          </blockquote>
          <p>
            The best governance decisions, like the best proofs, feel inevitable. They are minimal —
            remove any clause and the system breaks. They are surprising — the solution is not what
            you expected. They are elegant — once seen, you cannot imagine it otherwise.
          </p>
          <p>
            When a governance decision achieves this, we say:{" "}
            <strong>"This is from The Book."</strong>
          </p>
        </section>

        {/* Quality Constitution */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Quality Constitution</h2>
          <p className="text-sm font-semibold tracking-widest uppercase text-amber-700">
            The BAZDMEG Articles
          </p>
          <ol className="list-decimal list-inside space-y-3">
            <li>
              <strong>Discipline Before Automation</strong> — understand the process before
              automating it.
            </li>
            <li>
              <strong>Automate What You Understand</strong> — automation of chaos produces faster
              chaos.
            </li>
            <li>
              <strong>Zero Tolerance for Slop</strong> — no <code>any</code> types, no{" "}
              <code>eslint-disable</code>, no <code>@ts-ignore</code>.
            </li>
            <li>
              <strong>Test at the Right Level</strong> — hourglass model: 70% MCP tool tests, 20%
              E2E, 10% UI.
            </li>
            <li>
              <strong>Measure Everything</strong> — if you cannot measure it, you cannot govern it.
            </li>
            <li>
              <strong>Ship or Clarify</strong> — produce working proof or ask the question that
              unblocks you.
            </li>
            <li>
              <strong>Fill the Space</strong> — no orphan pages, no dead buttons, no empty
              viewports.
            </li>
            <li>
              <strong>Remember the Epsilons</strong> — every error message, every onboarding step
              serves someone encountering it for the first time.
            </li>
          </ol>
        </section>

        {/* Three Checkpoints */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Three Checkpoints</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rubik-panel p-4 space-y-2 rounded-lg border">
              <h3 className="font-bold text-amber-700">Pre-Code</h3>
              <p className="text-sm">
                Define the problem before writing a single line. What is the root?
              </p>
            </div>
            <div className="rubik-panel p-4 space-y-2 rounded-lg border">
              <h3 className="font-bold text-amber-700">Post-Code</h3>
              <p className="text-sm">
                Verify the solution before requesting review. Is this from The Book?
              </p>
            </div>
            <div className="rubik-panel p-4 space-y-2 rounded-lg border">
              <h3 className="font-bold text-amber-700">Pre-PR</h3>
              <p className="text-sm">Final quality gate before merging. Does the proof hold?</p>
            </div>
          </div>
        </section>

        {/* Collaborative Ethos */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Collaborative Ethos</h2>
          <h3 className="text-lg font-semibold">Problems as Gifts</h3>
          <p>
            Erdos had 511 co-authors because he gave problems like other people give flowers. Every
            issue filed is a gift — "I believe this community can solve this." Every PR is a proof
            of collaboration.
          </p>
          <h3 className="text-lg font-semibold">The Collaboration Graph</h3>
          <p>
            The platform is a collaboration graph made digital. Every MCP tool is an edge. Every API
            is a handshake. Governance exists to keep this graph healthy — maximizing edges while
            minimizing friction.
          </p>
          <h3 className="text-lg font-semibold">Contact as Proof</h3>
          <p>
            From the Contact Proof formalism: contact(A, B) is real when B's state genuinely changes
            due to A. Governance ensures every contribution creates real contact — real state change
            — not just ceremony.
          </p>
        </section>

        {/* Design Standards */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Design Standards</h2>
          <p>
            The Rubik design system is governance made visual. Typography that adapts (variable
            font, 300–900 weight). Four target viewports from 375px to 4K. Semantic color tokens —
            meaning over aesthetics.
          </p>
          <p>
            <strong>Fill the space:</strong> every viewport, every page, every interaction must be
            intentional. Empty space is ungoverned space. Dead buttons are unconstitutional.
          </p>
        </section>

        {/* CTA */}
        <section className="text-center space-y-4 pt-8 border-t">
          <h2 className="text-2xl font-bold">Discuss Governance</h2>
          <p className="text-muted-foreground">
            Have a governance question? Talk to The Governance — our constitutional AI voice that
            fuses Rubik's precision with Erdos's collaborative fire.
          </p>
          <a
            href="/chat?persona=gov"
            className="inline-block rounded-lg bg-amber-700 px-6 py-3 text-white font-semibold hover:bg-amber-800 transition-colors"
          >
            Open Governance Chat
          </a>
        </section>
      </article>
    </div>
  );
}
