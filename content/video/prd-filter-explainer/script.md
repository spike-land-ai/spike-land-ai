# The PRD Filter — Video Script

**Format:** Narrated explainer video (3-5 minutes)
**Style:** Mysterious, cinematic, dark-tech aesthetic
**Aspect:** 16:9 video, 1:1 support photos
**Characters:** Two persistent figures — "The Builder" (solo dev, hoodie, Brighton seafront backdrop) and "The Filter" (abstract geometric entity made of light/data, emerges from chat transcripts)

---

## SCENE 1 — The Problem (0:00–0:25)

**[PHOTO 01]** — A dark screen filled with endless scrolling chat messages, glowing green-on-black terminal style. The text is blurred and overwhelming. Mysterious fog seeps from the edges.

**NARRATION:**
> You have been here before.
> Turn forty of a conversation with an AI.
> You already said everything that matters.
> But the system is still carrying all of it — the false starts, the stale tool results, the detours that no longer matter.

**[PHOTO 02]** — A close-up of The Builder's hands on a keyboard, reflected in a dark monitor. Brighton Pier lights blur in the window behind. Night scene.

**NARRATION:**
> Most people think the problem is context window size.
> It is not.
> The problem is representation.

---

## SCENE 2 — The Insight (0:25–1:00)

**[PHOTO 03]** — A tangled ball of glowing threads (representing chat transcript), suspended in darkness. Each thread is a different color — some bright, some dim and fading.

**NARRATION:**
> Here is the claim: most long chats are already PRDs.
> Product Requirements Documents.
> They are just trapped inside transcript form.

**[PHOTO 04]** — The tangled ball begins to compress. The dim threads dissolve. Only six bright threads remain, forming a clean hexagonal shape. The light intensifies.

**NARRATION:**
> By turn twenty, the user has already said:
> What they want.
> What must not break.
> What success looks like.
> What constraints they care about.
> That is already enough for real work.

**[PHOTO 05]** — The hexagonal shape resolves into a floating crystal PRD artifact — six facets labeled: intent, task, constraints, acceptance, context, priority. It glows amber against deep blue.

**NARRATION:**
> Not a corporate PRD full of roadmap theater.
> A real one. Small. Operational. Executable.
> Six fields. That is all you need.

---

## SCENE 3 — How It Works (1:00–1:45)

**[PHOTO 06]** — A three-layer diagram rendered as floating platforms in space. Bottom: "Passthrough" (simple, transparent). Middle: "Template" (pattern-matching grid). Top: "Model" (a brain-like Gemini Flash icon). Arrows flow upward.

**NARRATION:**
> The PRD Filter uses three tiers.
> Tier one: passthrough. Short messages, structured inputs — they go through unchanged. No compression needed.
> Tier two: template extraction. Pattern matching catches common intents — fix, build, deploy, analyze — and structures them instantly.
> Tier three: model compression. For complex, messy messages, Gemini Flash extracts the structured PRD. One API call. Sub-second.

**[PHOTO 07]** — A split-screen comparison. Left side: a wall of messy chat text, highlighted in red, token count "2,847 tokens". Right side: a clean PRD card with six fields, highlighted in green, token count "127 tokens". A dramatic 95% reduction arrow between them.

**NARRATION:**
> Twenty-eight hundred tokens of conversation.
> One hundred and twenty-seven tokens of truth.
> That is a ninety-five percent compression ratio.
> Not summarization. Not cleanup. A representation upgrade.

---

## SCENE 4 — The OpenAPI Endpoint (1:45–2:30)

**[PHOTO 08]** — A glowing API endpoint rendered as a portal/gateway. The URL `POST /v1/chat/completions` floats above it in monospace font. Data streams flow through the portal, transforming from chaotic to ordered.

**NARRATION:**
> The PRD Filter lives on the OpenAI-compatible endpoint.
> POST /v1/chat/completions.
> Standard OpenAI format. Any client that speaks OpenAI can use it.

**[PHOTO 09]** — A code terminal showing a curl command hitting `edge.spike.land/v1/chat/completions` with a model field set to `spike-agent-v1`. The response shows the PRD-compressed output. Dark terminal, amber text.

**NARRATION:**
> Point your client at edge.spike.land.
> Set the model to spike-agent-v1.
> Your message goes in as raw conversation.
> It comes back as structured execution.

**[PHOTO 10]** — A model selection wheel showing four provider logos arranged in a circle — OpenAI, Anthropic, Google, xAI/Grok — with spike-agent-v1 at the center. The PRD filter sits between the user and the models like a lens.

**NARRATION:**
> Behind the gateway: four providers.
> OpenAI. Anthropic. Google. Grok.
> The PRD filter sits in front of all of them.
> It compresses your intent before the model even sees it.
> Less noise in. Better signal out.

---

## SCENE 5 — Deploy Your Own (2:30–3:15)

**[PHOTO 11]** — The Cloudflare Workers logo rendered as a glowing orange constellation against a dark sky. Below it, a terminal showing `wrangler deploy`. Edge nodes appear as stars spreading across a world map.

**NARRATION:**
> This runs on Cloudflare Workers.
> Deploy your own in minutes.
> Clone the repo. Set your API keys. Run wrangler deploy.
> Your PRD filter runs at the edge, worldwide, sub-millisecond cold starts.

**[PHOTO 12]** — An environment variables panel rendered as floating key-value tiles. PRD_COMPRESSION_MODE: "auto", GEMINI_API_KEY: "***", visible. The tiles orbit around a central Cloudflare Workers icon.

**NARRATION:**
> Two environment variables control everything.
> PRD_COMPRESSION_MODE — set to auto, always, or never.
> GEMINI_API_KEY — powers the model tier.
> That is the entire configuration.

**[PHOTO 13]** — A flow diagram showing: User Message → PRD Filter → Knowledge Augmentation (docs + tools) → Synthesis Agent → Response. Each step is a glowing node connected by light trails. The PRD Filter node pulses brightest.

**NARRATION:**
> The PRD filter is just the first stage.
> After compression, a knowledge pipeline kicks in.
> A router agent reads your intent.
> A docs agent pulls relevant documentation.
> A capability agent selects the right MCP tools.
> A synthesis agent writes the final answer.
> Four agents. One request. All powered by a clean PRD.

---

## SCENE 6 — Why This Matters (3:15–3:50)

**[PHOTO 14]** — The Builder standing on Brighton beach at dawn, silhouetted against the sunrise. A laptop open on the pebbles. The screen shows a clean PRD artifact glowing. The sea reflects golden light.

**NARRATION:**
> I am a solo developer from Brighton.
> I built this because transcript sludge was slowing me down.
> Not because models are too weak.
> Because the artifact they carry forward is too messy.

**[PHOTO 15]** — A before/after split. Left: a cluttered desk with multiple monitors, sticky notes, chaos — representing team overhead. Right: a single clean screen with a PRD artifact and a shipping notification. Minimalist, powerful.

**NARRATION:**
> A PRD filter reduces the nonsense both the model and the human have to carry.
> It turns "what were we doing?" into a compact artifact you can trust.
> That is how one developer ships what used to take a team.

---

## SCENE 7 — Call to Action (3:50–4:10)

**[PHOTO 16]** — The spike.land logo rendered as a constellation, with the PRD crystal artifact orbiting it. Below: the URL edge.spike.land glows. A subtle "Try it now" appears. Mysterious, inviting, dark space aesthetic.

**NARRATION:**
> Try it now through the spike.land API gateway.
> Two models to start. The PRD model for fast, structured wins.
> The full pipeline for deep, augmented answers.
> Your old chats are not dead weight.
> They are latent PRDs.
> And this filter sets them free.

---

## POST-CREDITS DATA CARD

```
endpoint:    POST edge.spike.land/v1/chat/completions
models:      spike-agent-v1, openai/gpt-4.1, anthropic/claude-sonnet-4, google/gemini-2.5-flash
prd modes:   auto | always | never
deploy:      wrangler deploy (Cloudflare Workers)
source:      github.com/spike-land-ai/spike-land-ai
built by:    Radix, Brighton, UK
```

---

## PHOTO MANIFEST

| # | Filename | Description | Style |
|---|----------|-------------|-------|
| 01 | `chat-overflow.png` | Overwhelming scrolling chat messages, terminal green-on-black, fog edges | Dark, mysterious, overwhelming |
| 02 | `builder-keyboard.png` | Hands on keyboard, Brighton Pier lights reflected in dark monitor, night | Cinematic, intimate, moody |
| 03 | `tangled-threads.png` | Glowing tangled thread ball in darkness, multi-color, some fading | Abstract, mysterious, chaotic |
| 04 | `threads-compress.png` | Thread ball compressing to hexagonal shape, dim threads dissolving | Transformative, luminous |
| 05 | `prd-crystal.png` | Floating crystal with six labeled facets, amber glow on deep blue | Elegant, geometric, precious |
| 06 | `three-tier-platforms.png` | Three floating platforms: passthrough/template/model, arrows upward | Architectural, spatial, clean |
| 07 | `compression-comparison.png` | Split screen: messy chat (red) vs clean PRD card (green), 95% arrow | Data visualization, dramatic |
| 08 | `api-portal.png` | Glowing gateway portal with URL floating above, data streams transforming | Sci-fi, portal energy, ordered |
| 09 | `terminal-curl.png` | Dark terminal with curl command and response, amber monospace text | Hacker aesthetic, authentic |
| 10 | `model-wheel.png` | Four provider logos in circle, spike-agent-v1 center, PRD lens between | Technical diagram, balanced |
| 11 | `cloudflare-constellation.png` | CF Workers logo as star constellation, world map with edge nodes | Cosmic, infrastructure, scale |
| 12 | `env-vars-orbit.png` | Floating key-value tiles orbiting CF Workers icon | Clean, configurational, orbital |
| 13 | `pipeline-flow.png` | Four-agent flow diagram with glowing nodes and light trails | Neural, connected, luminous |
| 14 | `builder-dawn.png` | Silhouetted figure on Brighton beach at dawn, laptop on pebbles, PRD glow | Emotional, dawn light, solitary |
| 15 | `before-after.png` | Split: cluttered multi-monitor desk vs single clean PRD screen | Contrast, minimalist power |
| 16 | `spike-constellation.png` | spike.land logo as constellation, PRD crystal orbiting, URL glowing | Brand, cosmic, inviting |
