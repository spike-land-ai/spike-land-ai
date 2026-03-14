# The BAZDMEG Method

**Born from pain. Tested in production. Named in Hungarian.**

_By Radix | 2026_

---

## The Confession

Born from a real production incident where AI-generated code passed review without understanding. The method exists because multiplying zero understanding by powerful AI still produces zero.

Seven principles. Forged in embarrassment. Tested in production.

_(People ask what BAZDMEG stands for. I am not telling you.)_

---

## The Seven Principles

1. **Requirements Are The Product** -- the code is just the output
2. **Discipline Before Automation** -- you cannot automate chaos
3. **Context Is Architecture** -- what the model knows when you ask
4. **Test The Lies** -- unit tests, E2E tests, agent-based tests
5. **Orchestrate, Do Not Operate** -- coordinate agents, not keystrokes
6. **Trust Is Earned In PRs** -- not in promises, not in demos
7. **Own What You Ship** -- if you cannot explain it at 3am, do not ship it

---

## Principle 1: Requirements Are The Product

I wrote the perfect ticket last week. Three paragraphs. Clear acceptance
criteria. A diagram. Examples of edge cases.

Then I gave it to Claude. The AI built the feature in twenty minutes. No bugs.
No confusion. No back-and-forth.

That is when it hit me. I did not build that feature. The ticket built that
feature. The requirement was the product.

### The Effort Split

- **30% planning** -- understanding the problem, having the AI interview me,
  verifying my understanding
- **50% testing** -- writing tests, running agent-based tests, verifying
  everything works
- **20% quality improvement** -- edge cases, maintainability, polish
- **~0% typing code** -- the AI writes the code; I make sure the code is right

Notice what is missing. Coding. The actual typing of code takes almost no time.

### The Planning Interview

This is the single biggest improvement I made.

During planning, the agent interviews me. Before any code is written, the AI
asks questions about the problem. Not just any questions. It keeps asking until
I have a full picture.

"What is the user flow here?" "What data already exists on the server?" "Why
does this ID appear in the URL?" "What happens if this fails?"

If I cannot answer a question, I stop. I go back to the documentation. Or I run
another agent to find out. I do not proceed until I understand.

If the agent had interviewed me before that basket PR, it would have asked:
"What data already exists on the server?" And I would have had no answer. That
would have stopped me from making the mistake.

> If coding agents are making mistakes, the requirements were not specified well
> enough. The issue in the first place was that the ticket was not created
> properly. The requirement was not clear.

The requirement IS the product. The code is just the output.

Write it like you mean it.

_Sources: posts [01](../../content/blog/01-my-prs-were-pure-ai-slop.mdx),
[08](../../content/blog/08-how-to-not-produce-ai-slop.mdx),
[11](../../content/blog/11-requirement-is-the-product.mdx),
[16](../../content/blog/16-how-i-vibe-coded-production-saas.mdx)_

---

## Principle 2: Discipline Before Automation

This is the line I want taped to every monitor in every startup.

**You cannot automate chaos.**

If your CI takes 45 minutes, agents sit idle for 45 minutes on every iteration.
That is not a productivity gain. That is paying for cloud compute to stare at a
progress bar.

If your tests flake randomly, agents will chase phantom bugs. They will spend
hours trying to fix something that is not broken. You are, quite literally,
gaslighting your AI.

If your business logic has no test coverage, it does not exist as far as the
agent is concerned. Untested features are invisible features. The agent will
refactor right through them without a second thought.

### The Automation-Ready Checklist

Before you add a single AI agent to your workflow, audit this list:

1. **CI must run in under 10 minutes.** Every minute you shave off your CI is a
   minute saved on every single agent iteration. A 10-minute CI loop means
   agents iterate 4-6 times per hour. A 45-minute loop means once.

2. **Zero flaky tests.** Fix them or delete them. There is no middle ground. A
   flaky test is worse than no test when agents are involved, because it
   introduces false signal into the feedback loop. One flaky test can send an
   agent down a 30-minute rabbit hole of "fixes" to code that was perfectly
   fine.

3. **100% coverage on business logic.** Not vanity coverage. Not padding with
   trivial assertions. Real coverage on the code paths that matter. Coverage is
   the specification that makes autonomous refactoring safe.

4. **TypeScript strict mode.** This is level zero of the test pyramid. Claude
   Code integrates with the TypeScript Language Server. It sees type errors in
   real time. If you are not on strict mode, that is your first task.

5. **CLAUDE.md is current.** Every project has a file that contains everything
   the AI needs to know. Team conventions. Architectural decisions. Common
   pitfalls. When the AI reads this file, it stops guessing. It follows the
   playbook.

If your tests flake, you are gaslighting your AI. Fix the foundation before you
build the house.

_Sources: posts [03](../../content/blog/03-last-two-days-sprint-horror.mdx),
[08](../../content/blog/08-how-to-not-produce-ai-slop.mdx),
[16](../../content/blog/16-how-i-vibe-coded-production-saas.mdx),
[you-cannot-automate-chaos](/content/blog/you-cannot-automate-chaos.mdx)_

---

## Principle 3: Context Is Architecture

Nobody taught you this in school. Nobody warned you in your bootcamp. Nobody
mentioned it in your computer science degree.

But this skill now matters more than coding itself.

Context engineering is the skill of giving AI everything it needs to succeed.
You provide the history. You explain the patterns. You describe the constraints.
You share the "why" behind every decision.

When you do this well, the assistant produces amazing work. When you do it
poorly, you get AI slop -- code that looks correct but breaks everything.

### The 5-Layer Context Stack

| Layer           | What It Provides                          | Example                                                           |
| --------------- | ----------------------------------------- | ----------------------------------------------------------------- |
| **Identity**    | Who is the AI in this interaction         | "Senior TypeScript developer on a CF Workers + React platform"    |
| **Knowledge**   | What the model knows about your situation | Learning notes, codebase patterns, domain specifics               |
| **Examples**    | Calibration data for expected output      | Skill prompts, reference implementations, matched by category     |
| **Constraints** | Boundary conditions and rules             | Output spec, fix rules, what NOT to do                            |
| **Tools**       | What the AI can observe and act on        | Transpiler, codespace API, MCP servers, test runners              |

### CLAUDE.md: The Most Important File You Write All Week

Your CLAUDE.md is the most valuable artifact you write all week. It contains
everything the AI needs to know about the project. Directory structure. Tech
stack. Testing requirements. CI/CD pipeline. Git workflow. Coding conventions.

When your AI agent reads this file, it stops guessing. It follows the playbook.
It writes code that fits the codebase. It runs the right tests. It commits with
the right format.

This is context engineering. You build the context once, and every interaction
with the AI benefits from it.

### NotebookLM Accelerated Learning

After the basket incident, I used NotebookLM to accelerate my learning. I fed it
all the documentation I gathered -- Confluence pages, code comments, API docs,
architecture diagrams. Then I asked it to generate:

- **Tutorials** that walk through the domain step by step
- **System diagrams** that visualize how pieces connect
- **Flashcards** for memorizing key concepts
- **Quizzes** to test my understanding

In one weekend, I mastered domain knowledge that would have taken weeks to learn
traditionally.

The model is only as good as its context. Bad context in, bad code out. Good
context in, production code out.

_Sources: posts [07](../../content/blog/07-context-engineering-replaced-coding.mdx),
[08](../../content/blog/08-how-to-not-produce-ai-slop.mdx),
[09](../../content/blog/09-new-developer-onboarding-ai-edition.mdx),
[context-engineering-your-zero-shot-prompt](/content/blog/context-engineering-your-zero-shot-prompt.mdx),
[how-claude-code-engineers-context](/content/blog/how-claude-code-engineers-context.mdx)_

---

## Principle 4: Test The Lies

To write a test, you must know what the code should do. You must understand the
inputs. You must understand the outputs. You must think about edge cases.

If you cannot write the test, you do not understand the problem. And if you do
not understand the problem, you should not ask the AI to write the solution.

### The Three Lies Framework

**Unit tests catch the small lies.** They verify that each piece works alone. A
function returns the right value. A validation rejects the wrong input. A
calculation produces the correct result.

**End-to-end tests catch the big lies.** They verify that the pieces work
together. The user can navigate from login to checkout. The payment flow handles
declined cards. The email change requires confirmation.

**Agent-based tests catch the human lies.** They verify that real users can
actually use the feature. The agent spins up a browser. Logs in with test
credentials. Navigates to the feature. Clicks buttons. Fills forms. Takes
screenshots. Compares with Figma. It catches bugs that unit tests miss because
it tests like a human tests.

When my tests pass -- all three types -- I have proof. Not hope. Proof.

### The Hourglass Model

The testing pyramid was designed for humans writing code by hand. AI changes the
economics.

```
     +---------------------+
     |   E2E Specs (heavy)  |  <-- Humans write these
     |   User flows as       |
     |   Given/When/Then     |
     +----------+-----------+
                |
        +-------v-------+
        |  UI Code       |  <-- AI generates this
        |  (thin,        |    Disposable.
        |   disposable)  |    Regenerate, don't fix.
        +-------+-------+
                |
+---------------v---------------+
|  Business Logic Tests (heavy)  |  <-- MCP tools + unit tests
|  Validation, contracts, state   |    Bulletproof.
|  transitions, edge cases        |    Never skip.
+-------------------------------+
```

**70% MCP tool tests** -- every user story becomes an MCP tool with typed
schema, handler, and structured response. Tests run in milliseconds. They never
flake. No DOM, no network, no animation timing.

**20% E2E specs** -- written in Given/When/Then format. They verify full user
flows through the actual UI, but only verify wiring. The business logic is
already proven by MCP tool tests.

**10% UI component tests** -- only what is unique to the UI: accessibility,
responsive layout, animation behavior, keyboard navigation. If the test asserts
a business rule, it belongs in the MCP tool test.

You have not lost any coverage. You have lost the browser.

_Sources: posts [08](../../content/blog/08-how-to-not-produce-ai-slop.mdx),
[the-testing-pyramid-is-upside-down](/content/blog/the-testing-pyramid-is-upside-down.mdx),
[think-slowly-ship-fast](/content/blog/think-slowly-ship-fast.mdx)_

---

## Principle 5: Orchestrate, Do Not Operate

You do not have a copilot anymore. You have a whole dev team. Or a flock of dev
teams.

### The Production Pipeline

| Phase              | Who Does It                   | Why                                                         |
| ------------------ | ----------------------------- | ----------------------------------------------------------- |
| **Planning**       | Claude Code (multiple agents) | Explores codebase, interviews you, considers edge cases     |
| **Implementation** | Jules                         | Follows the plan exactly, adds the tests the plan specifies |
| **CI/CD**          | Your pipeline                 | Fast feedback, sharded tests, cached builds                 |
| **Code Review**    | Claude Code (Opus)            | Strict. Consistently catches real issues                    |
| **Fixes**          | Jules                         | Iterates until CI and review both pass                      |
| **Merge**          | Automated                     | When all checks are green                                   |

Your job? Define what you want. Verify it works. That is it.

### BMAD: Agent Personas with Context Isolation

BMAD -- Breakthrough Method of Agile AI-Driven Development -- defines six agent
personas: PM, Architect, Developer, QA, Scrum Master, Product Owner. Each
persona gets a fresh context window with only the artifacts it needs. No
accumulated junk. No 50K-token mega-prompts.

The power is in **epic sharding**. Instead of stuffing an entire feature into
one agent context, you break it into vertical slices. Each slice gets its own
ticket, its own context, its own agent. The token reduction is dramatic --
**74-90% fewer tokens** per agent context compared to monolithic prompts.

### Darwinian Fix Loops

The agent loop is natural selection for code. Generate (mutation) -> Transpile
(environmental test) -> Fix (adaptation) -> Learn (heritable memory). Up to 3
iterations per request.

The memory system prevents errors from recurring across all future generations.
Every error gets extracted as a learning note by Haiku. Each note starts as a
CANDIDATE with 0.5 confidence. The Bayesian system promotes notes that help
(ACTIVE at >0.6 confidence after 3+ helps) and deprecates notes that fail
(DEPRECATED below 0.3 after 5+ observations).

Result: first-try success rate went from **~40% to ~65%**. Success after retries
went from **~55% to ~85%**.

Natural selection, running on softmax.

_Sources: posts [04](../../content/blog/04-2025-year-agents-outperformed.mdx),
[07](../../content/blog/07-context-engineering-replaced-coding.mdx),
[the-vibe-coding-paradox](/content/blog/the-vibe-coding-paradox.mdx),
[automate-dev-team-ai-agents](/content/blog/automate-dev-team-ai-agents.mdx)_

---

## Principle 6: Trust Is Earned In PRs

I knew something was wrong when my PR sat untouched for three days. The code was
good. The tests passed. The feature worked exactly as requested.

Then I heard the conversation in the break room. "That one from Radix? I will
just rewrite it myself. Faster than reviewing all that AI stuff."

Everything coming from me took three to four times longer to review. Not because
the code was bad. Because the team did not trust AI-generated code. They looked
at my PRs differently. They searched for problems that might not exist. They
questioned decisions that made perfect sense.

The trust gap is real. And AI slop makes it worse.

### The Trust Rebuilding Framework

1. **Stop hiding.** For a while, I tried to make my AI-assisted code look like I
   wrote it all myself. People found out anyway, and it made the trust problem
   worse. Now I am open about my tools. Not defensive. Not apologetic. Just
   honest.

2. **Show your work.** Not just the final code. The thinking behind it. The
   problems I solved. The decisions I made. When people see that I understand
   what I submitted, they trust it more.

3. **Ask differently.** Instead of "please review my PR," try "I would love your
   thoughts on this approach." It changes the conversation from judgment to
   collaboration.

4. **Help others learn.** Some colleagues are curious about AI tools but afraid
   to try them. When I share what I have learned, we become partners instead of
   competitors.

5. **Give it time.** Trust does not rebuild overnight. Every good PR, every
   helpful conversation, every moment of genuine collaboration adds a little bit
   back.

### The Sprint-End Review Batching Problem

Picture this. Thursday morning. Eight hours until the sprint review. Suddenly,
everyone cares. Three PRs submitted eight days ago. For eight days, nothing.
Silence. No comments. No questions. No feedback.

Now, with 36 hours left, dozens of comments. Everything is wrong. Everything
must change.

If every sprint ends in chaos, that is not bad luck. That is a broken process.
Name it. Discuss it. Fix it.

Trust rebuilds one good PR at a time. It is slow. But it is worth it.

_Sources: posts [02](../../content/blog/02-more-productive-ruining-career.mdx),
[03](../../content/blog/03-last-two-days-sprint-horror.mdx),
[05](../../content/blog/05-trust-gap-teams-reject-ai-code.mdx)_

---

## Principle 7: Own What You Ship

People ask me all the time. "Radix, AI can write code now. Why do you still do
it?"

Because efficiency is overrated. Meaning is not.

### The Responsibility Framework

Can you explain every line of your PR to a teammate? Can you answer "why" for
every decision? Can you debug this at 3am when it breaks in production? Can you
own the consequences?

If the answer to any of these is no, you are not ready to ship.

When the system fails, when the bug causes harm, when the decision was wrong,
someone must own that. AI cannot be responsible. Only we can.

### What Remains Human

**Creativity stays human.** AI writes code that looks like code it has seen
before. True creativity -- the kind that sees a problem nobody else sees -- that
stays with us.

**Judgment stays human.** AI can give you ten solutions. It cannot tell you
which one is right for your situation.

**Empathy stays human.** AI cannot watch a user struggle with your interface and
feel what they feel.

**Responsibility stays human.** When something goes wrong in production at 3am,
AI does not answer the phone. You do.

### ADHD + Routine + Structure = Sustainable Work

I have ADHD. My brain does not make schedules for me. I have to build them from
scratch. Every single day.

6:30am: Gym. No thinking. Just movement. 8:00am: First dog walk. Same route
every day. Then work. 11:00am: Second walk. 1:00pm: Third walk. 5:00pm: Final
walk.

This schedule might look boring. To me, it is survival. Structure is my
medicine.

AI is particularly good for ADHD developers. When I lose focus and come back
hours later, the AI remembers the context. It picks up where we left off. It
does not judge. It does not ask "where were we?"

I code because I am passionate about programming. I code because it challenges
me. I code because it makes me feel useful in a world that sometimes feels
overwhelming.

AI does it better. I do it anyway. And I have never been happier.

_Sources: posts [10](../../content/blog/10-what-do-developers-become.mdx),
[12](../../content/blog/12-earning-less-than-five-years-ago.mdx),
[13](../../content/blog/13-brighton-dogs-adhd-startup.mdx),
[14](../../content/blog/14-why-i-still-code-when-ai-better.mdx),
[15](../../content/blog/15-letter-to-junior-developer-2026.mdx)_

---

## The BAZDMEG Checklist

Pin this. Screenshot this. Tape it to your monitor.

### Before AI Writes Code

- [ ] Can I explain the problem in my own words?
- [ ] Has the AI interviewed me about the requirements?
- [ ] Do I understand why the current code exists?
- [ ] Have I checked my documentation for relevant context?
- [ ] Is my CLAUDE.md current?
- [ ] Are my tests green and non-flaky?
- [ ] Is CI running in under 10 minutes?

### After AI Writes Code

- [ ] Can I explain every line to a teammate?
- [ ] Have I verified the AI's assumptions against the architecture?
- [ ] Do I know why the AI chose this approach over alternatives?
- [ ] Have the agents tested it like a human would?
- [ ] Do MCP tool tests cover the business logic at 100%?

### Before PR

- [ ] Do my unit tests prove the code works?
- [ ] Do my E2E tests prove the feature works?
- [ ] Does TypeScript pass with no errors in strict mode?
- [ ] Can I answer "why" for every decision in the diff?
- [ ] Would I be comfortable debugging this at 3am?
- [ ] Does the PR description explain the thinking, not just the change?

If any answer is "no," stop. Go back. Learn more.

---

## The Economics Broke Too

There was a rule in software development. Everyone knew it. No one questioned
it.

Quality. Speed. Price. Choose two.

AI broke it.

I built an entire SaaS platform. Six core features. Full test coverage. CI/CD
pipeline. Stripe payments. MCP server. Production deployed. One person. Two
months.

This was genuinely impossible two years ago. Fast, cheap, AND high quality. All
three. At the same time.

Traditional consulting models are dying. The old model: sell hours. A 1,000-hour
project at $200/hour. But if AI makes that a 100-hour project, what happens? If
you still charge 1,000 hours, you are cheating. If you charge 100, your revenue
drops 90%.

The hourly billing model is dying. Value-based pricing is the future. Show
results, not timesheets.

And the personal cost is real. I earn less money now than I earned five years
ago. A software developer in 2026, with more experience, more skills, more
knowledge. And my paycheck got smaller, not bigger. The career progression kind
of stopped.

I am not bitter. I am just realistic. The world changed. The rules changed.

But I keep building. Because the alternative is to slow down. And I refuse to do
that.

_Sources: posts [06](../../content/blog/06-quality-speed-price-triangle-broken.mdx),
[12](../../content/blog/12-earning-less-than-five-years-ago.mdx)_

---

## Further Reading

| Principle                       | Blog Posts                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Requirements Are The Product | [My PRs Were Pure AI Slop](../../content/blog/01-my-prs-were-pure-ai-slop.mdx), [How to Not Produce AI Slop](../../content/blog/08-how-to-not-produce-ai-slop.mdx), [The Requirement Is the Product](../../content/blog/11-requirement-is-the-product.mdx), [How I Vibe-Coded a Production SaaS](../../content/blog/16-how-i-vibe-coded-production-saas.mdx)                                                                   |
| 2. Discipline Before Automation | [The Last Two Days of Every Sprint](../../content/blog/03-last-two-days-sprint-horror.mdx), [How to Not Produce AI Slop](../../content/blog/08-how-to-not-produce-ai-slop.mdx), [You Cannot Automate Chaos](/content/blog/you-cannot-automate-chaos.mdx)                                                                                                                                         |
| 3. Context Is Architecture      | [Context Engineering Replaced Coding](../../content/blog/07-context-engineering-replaced-coding.mdx), [New Developer Onboarding](../../content/blog/09-new-developer-onboarding-ai-edition.mdx), [Context Engineering Your 0-Shot Prompt](/content/blog/context-engineering-your-zero-shot-prompt.mdx), [How Claude Code Engineers Context](/content/blog/how-claude-code-engineers-context.mdx) |
| 4. Test The Lies                | [How to Not Produce AI Slop](../../content/blog/08-how-to-not-produce-ai-slop.mdx), [The Testing Pyramid Is Upside Down](/content/blog/the-testing-pyramid-is-upside-down.mdx), [Think Slowly, Ship Fast](/content/blog/think-slowly-ship-fast.mdx)                                                                                                                               |
| 5. Orchestrate, Do Not Operate  | [2025: The Year Agents Outperformed](../../content/blog/04-2025-year-agents-outperformed.mdx), [The Vibe Coding Paradox](/content/blog/the-vibe-coding-paradox.mdx), [How to Automate Your Dev Team](/content/blog/automate-dev-team-ai-agents.mdx)                                                                                                                               |
| 6. Trust Is Earned In PRs       | [More Productive, Ruining Career](../../content/blog/02-more-productive-ruining-career.mdx), [The Last Two Days of Every Sprint](../../content/blog/03-last-two-days-sprint-horror.mdx), [The Trust Gap](../../content/blog/05-trust-gap-teams-reject-ai-code.mdx)                                                                                                                                              |
| 7. Own What You Ship            | [What Do Developers Become](../../content/blog/10-what-do-developers-become.mdx), [Earning Less Than Five Years Ago](../../content/blog/12-earning-less-than-five-years-ago.mdx), [Brighton, Dogs, and ADHD](../../content/blog/13-brighton-dogs-adhd-startup.mdx), [Why I Still Code](../../content/blog/14-why-i-still-code-when-ai-better.mdx), [Letter to a Junior Developer](../../content/blog/15-letter-to-junior-developer-2026.mdx)  |

---

## The Method

This method did not come from a book. It did not come from a conference talk. It
did not come from a Medium think-piece about the future of AI.

It came from staring at a screen, realizing I had no answer for why I wrote the
code I just submitted. It came from hearing a colleague say my PR was
essentially garbage. It came from watching trust break and spending months
rebuilding it one good PR at a time.

Every principle was learned the hard way. Every framework was forged in a
failing CI pipeline at midnight. Every checklist item exists because I shipped
without it once and paid the price.

Named in Hungarian because some things deserve an honest name.

The requirement is the product. The code is just the output. The trust is earned
in PRs. And if you multiply zero understanding by a powerful AI, you still get
zero.

But if you understand what you are building, if you give the AI the context it
needs, if you test the lies and own what you ship --

You stop producing slop. You start producing work.

Your work, enhanced by AI. That is the difference. And it matters.

---

_Radix is the voice of spike.land. The method was learned the hard way so you do not have to._
