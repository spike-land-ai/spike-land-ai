# "The AI Found Another Spike Land. In My City."
## YouTube Video Script — ~10 Minutes
### Format: Veritasium x Tech Demo x Mystery Investigation

---

**PRODUCTION NOTES**
- Runtime target: 9–11 minutes
- Visual cue format: [VISUAL: description]
- Sound cue format: [SFX: description]
- B-roll cue format: [B-ROLL: description]
- Talking head sections are direct-to-camera unless noted
- Pacing: fast cuts in investigation sections, slower in paradox section

---

## COLD OPEN (0:00 – 0:45)

[VISUAL: Black screen. White text appears one word at a time.]

**ZOLTAN (V.O.)**
Sixty seconds ago, my AI asked me a question I did not know how to answer.

[VISUAL: Screen recording — terminal or chat interface. The AI output reads: "Which Spike Land did you mean?"]

[SFX: Sharp keyboard click. Silence. Then low ambient tension music begins.]

**ZOLTAN (direct to camera, close crop)**
I have been building a platform called spike.land for three years. I know every corner of it. I wrote every line of the business plan we were testing.

And my own AI just told me there was another one.

[VISUAL: Split screen — spike.land platform on one side, gov.spikeland.net loading on the other.]

**ZOLTAN**
In my city.

Set up two years before I moved here.

[VISUAL: Google Maps pin dropping on Brighton, UK. Then a second pin. Then a third.]

[SFX: Low drone note. Cut to black.]

[TITLE CARD: "THE PRINCIPALITY PROBLEM"]

---

## SETUP: WHO IS ZOLTAN, WHAT IS SPIKE.LAND (0:45 – 2:15)

[VISUAL: Fast-cut B-roll — code editor, Cloudflare dashboard, terminal with deploys, MCP tool list scrolling]

**ZOLTAN (V.O.)**
Quick context, because it matters for what happens next.

I am a software developer living in Brighton, UK. I have been building a platform called spike.land — an open app store for AI tools. It runs on Cloudflare. It has over 533 MCP tools — that is Model Context Protocol, the standard that lets AI systems call external software.

[VISUAL: spike.land dashboard showing tool count — 533+. Hover animation on a few tool cards.]

**ZOLTAN**
Think of MCP tools like apps on your phone, except instead of a human tapping a button, an AI agent calls the tool. Spike.land is where those tools live, get discovered, and get called.

[VISUAL: Simple diagram — AI agent in center, arrows pointing out to labeled tool cards: "image-studio", "chess-engine", "code-review", "business-plan-analyzer"]

**ZOLTAN**
One of the newer tools is a business plan analyzer. You give it a company name, a market context, some assumptions — and it returns a structured analysis. Revenue projections. Risk flags. Competitive gaps.

[VISUAL: The tool schema loading in a browser. Clean, professional JSON structure.]

**ZOLTAN**
I was testing it. Live. On camera.

I typed in: "spike.land business plan, AI app store, Cloudflare."

And the AI came back with a question.

[VISUAL: The AI response appears on screen: "I found references to multiple entities named 'Spike Land'. Could you clarify which one you mean? I see spike.land (the AI platform) and gov.spikeland.net. Which should I analyze?"]

[SFX: A single, clean notification chime.]

**ZOLTAN (quiet, almost to himself)**
...gov.spikeland.net.

---

## THE DISCOVERY (2:15 – 3:15)

[VISUAL: Browser loading gov.spikeland.net. Slow, deliberate scroll as the page renders.]

**ZOLTAN (V.O.)**
I want you to see exactly what I saw.

[VISUAL: The page fully loads. Header reads: "The Calm and Distinguished Principality of Spikeland". Decorative border. A coat of arms. Formal serif typography.]

**ZOLTAN**
This is a micronation.

An actual micronation.

[VISUAL: Zoom in on specific details — one at a time, with pause between each]

**ZOLTAN (reading)**
"Location: Brighton, East Sussex."

Same city.

"Population: 1."

"Territory: 10.2 square metres."

"Behind Spike's door."

[SFX: Light comedic beat — just a brief pause and a breath.]

**ZOLTAN**
Ten point two square metres. That is smaller than most UK bathrooms. This is a sovereign nation the size of a parking space.

[VISUAL: An outline of 10.2 sqm drawn on screen for scale — next to a car, next to a person.]

**ZOLTAN**
And it has a government website.

[VISUAL: Scroll through the site — Constitution page, Citizenship page, some kind of proclamation document. All formal. All real.]

**ZOLTAN**
With a .gov subdomain.

[VISUAL: Address bar close-up: "gov.spikeland.net"]

**ZOLTAN**
On spikeland.net.

My platform is spike.land.

[VISUAL: Two URLs side by side. The resemblance is obvious.]

---

## THE COINCIDENCES (3:15 – 4:15)

[VISUAL: Whiteboard or animated text building a list]

**ZOLTAN**
Okay. Let me put the coincidences on the table, because separately they are each nothing. Together they become something harder to dismiss.

[VISUAL: List builds item by item]

**ZOLTAN**
One. Same name. "Spike Land" versus "Spikeland." Near-identical.

Two. Same city. Brighton. Population 280,000. Not London. Brighton.

Three. Same tech aesthetic. The Spikeland site runs on Cloudflare Pages. So does mine.

Four. The site was created in 2021. I moved to Brighton in 2023. I started spike.land in 2022.

[Beat.]

Five. There is a "Prince of Spikeland" and his name is not Zoltan.

[VISUAL: A question mark appears over a silhouette of a person.]

**ZOLTAN**
Or at least... I do not think it is.

---

## THE HUNT — 18 PARALLEL AI AGENTS (4:15 – 6:30)

[VISUAL: Terminal screen. A cascade of processes spinning up simultaneously.]

[SFX: Fast, rhythmic electronic music — like a heist sequence]

**ZOLTAN**
This is the part where the tool demo becomes something else entirely.

I deployed 18 parallel AI agents to find the Prince of Spikeland.

[VISUAL: Split-screen grid — 6 terminal windows, each running different tasks. Labels appear:]

**ZOLTAN (V.O., rapid fire)**
WHOIS lookup on spikeland.net.
DNS record enumeration.
Certificate transparency search.
Wayback Machine archive scan.
Social media cross-reference.
Companies House search.
HTTP header analysis.
Cloudflare Pages subdomain check.
Google Search Console token scan.
GitHub organization search.
LinkedIn search.
Email pattern inference.
Domain registrar pattern matching.
Web archive diff comparison.
Related domain enumeration.
Backlink analysis.
PDF metadata extraction from the constitution document.
And one agent just reading the micronation's constitution line by line, looking for clues.

[VISUAL: Agents start returning results. Some fast, some slow. Progress indicators.]

**ZOLTAN**
The WHOIS came back first.

[VISUAL: WHOIS output. All registrant fields show "REDACTED FOR PRIVACY". A wall of redaction.]

**ZOLTAN**
Privacy wall. Standard for anyone who does not want to be found.

[VISUAL: Next result flags.]

**ZOLTAN**
DNS records had something interesting. A TXT record — Google Search Console verification token. That means someone verified ownership of spikeland.net with a Google account. The token itself tells you nothing. But it confirms a real human with a real Google account owns this domain.

[VISUAL: The TXT record displayed cleanly. Token highlighted.]

**ZOLTAN**
The Cloudflare Pages agent came back next.

[VISUAL: Terminal output: "spikeland.pages.dev — STATUS: LIVE"]

**ZOLTAN**
spikeland.pages.dev is live. Active. Deployed within the last few months. Someone is still working on this.

[VISUAL: The pages.dev site loading — same micronation content, slightly different layout. A staging environment.]

**ZOLTAN**
Then social media.

[VISUAL: X/Twitter profile loading for @spikeland]

**ZOLTAN**
@spikeland on X. But the bio says... "Babouland."

[Beat.]

Another micronation. A different one. The same account owner runs two micronations.

[VISUAL: The @spikeland profile. Bio clearly reads "Babouland". Profile image is abstract/playful.]

**ZOLTAN (dry)**
This person is a serial micronation operator.

[VISUAL: Certificate transparency results loading — a scrolling list of SSL certificates]

**ZOLTAN**
The certificate transparency logs — these are public records of every SSL certificate ever issued for a domain — came back with 78 certificates for spikeland.net and its subdomains.

78.

[VISUAL: The number "78" in large text. Then a scrolling list of cert entries with dates.]

**ZOLTAN**
That is not a hobby project. That is infrastructure. That is someone who has been actively maintaining this for years.

[VISUAL: HTTP header dump from a curl request to gov.spikeland.net]

**ZOLTAN**
Then one of my agents pulled the raw HTTP headers.

Most sites have boring headers. Server type, cache settings, standard stuff.

[VISUAL: Specific header lines highlight in yellow, one at a time]

**ZOLTAN (reading slowly)**
"X-Clacks-Overhead: GNU Terry Pratchett."

"X-Dedication: Aaron Swartz."

"X-Kafka: They are going to kill me."

[Pause.]

**ZOLTAN**
GNU Terry Pratchett is a memorial tribute to the author Terry Pratchett — a way of keeping his name alive in the infrastructure of the internet. Aaron Swartz was an internet freedom activist who died in 2013. Kafka's final letter to his publisher.

[VISUAL: Brief portrait — Pratchett, then Swartz. Respectful, not gratuitous.]

**ZOLTAN**
Whoever built this site is a reader. And they care about people who built things and got crushed for it.

[Pause. The music softens slightly.]

**ZOLTAN**
Then Companies House.

[VISUAL: The UK Companies House search interface. A search is typed: "Blackspike". Results appear.]

**ZOLTAN**
Blackspike Limited. Registered in Brighton. Director: Felix Corke.

[VISUAL: The company record. Director name in clear text. Incorporation date: 2011.]

**ZOLTAN**
Registered since 2011. Over a decade.

[VISUAL: The director's name stays on screen. The music fades.]

---

## THE REVEAL (6:30 – 7:30)

[VISUAL: Google search for "Felix Corke Brighton". Results load. readspike.com, spike.news, Twitter/X profile.]

**ZOLTAN**
Felix Corke. Brighton. Blackspike Limited.

His brand is "Spike."

[VISUAL: readspike.com homepage. spike.news homepage. The brand language. The aesthetic. The name used consistently across properties.]

**ZOLTAN**
He has been building under the Spike brand since at least 2011. He was here before me. He was Spike before spike.land existed.

[Beat.]

**ZOLTAN**
And his micronation — his ten-point-two square metre sovereign state — is named after himself.

Behind his door.

[VISUAL: The gov.spikeland.net page again. "Behind Spike's door." — the phrase renders differently now.]

**ZOLTAN**
I named my platform after my last name. Erdos. Which in Hungarian means... forest. Which has nothing to do with spikes.

I did not name it after a spike. I named it because it felt sharp. Because it felt like a land where sharp things happen.

[VISUAL: spike.land logo. Then spikeland.net logo side by side. Similar energy. Different origins.]

**ZOLTAN**
Two people. Same city. Same word. No connection.

Or is there?

---

## THE PARADOX (7:30 – 9:15)

[VISUAL: Slow zoom out from both sites. Music shifts — more contemplative, slightly unsettling.]

**ZOLTAN**
There is a thought experiment called Newcomb's Paradox.

[VISUAL: Simple animation — two boxes appear. Box 1 labeled "$1,000". Box 2 labeled "$1,000,000 or $0".]

**ZOLTAN**
A perfect predictor — an entity with a flawless track record — presents you with two boxes. Box A always contains one thousand dollars. Box B contains one million dollars, but only if the predictor decided in advance you would take only Box B. If it predicted you would take both, Box B is empty.

The predictor has already made its decision. The boxes are sealed. You cannot change what is inside.

[VISUAL: The question appears on screen: "Do you take both boxes, or just Box B?"]

**ZOLTAN**
Causal decision theory says take both. The decision is already made. Your choice now cannot change what is in the box.

Evidential decision theory says take only Box B. Because the kind of person who takes only Box B is the kind of person the predictor puts a million dollars in front of.

[Beat.]

**ZOLTAN**
Here is why this matters.

[VISUAL: The domain expiry screen. "gov.spikeland.net — expires in 16 days."]

**ZOLTAN**
Spikeland's domain expires in sixteen days.

Felix does not know I made this video. Felix does not know I exist — or if he does, he did not know two days ago when I started investigating.

[VISUAL: A calendar. 16 days. The date circled.]

**ZOLTAN**
If this video reaches Felix before his domain expires, and he renews it, then the investigation caused the continuation of the thing I was investigating.

[VISUAL: An arrow from "THIS VIDEO" to "SPIKELAND CONTINUES"]

**ZOLTAN**
If it does not reach him, and the domain lapses, then one Spike Land will have outlasted the other — the one built in a server farm in San Jose rather than a ten-square-metre principality in East Sussex.

[Pause.]

**ZOLTAN**
But here is the deeper version of the paradox.

Newcomb's problem is really about precommitment. About whether the kind of entity you are determines your outcomes before you make a choice. The predictor does not guess — it identifies.

[VISUAL: The HTTP headers again. "GNU Terry Pratchett. Aaron Swartz. Kafka."]

**ZOLTAN**
Someone who puts those headers in their HTTP response is the kind of person who builds things that last longer than they should. Who maintains a micronation government website for years past the point of any rational ROI. Who registers a company called Blackspike in 2011 and is still running it.

[VISUAL: Blackspike Ltd incorporation date: 2011. Current year: 2026. A span of fifteen years.]

**ZOLTAN**
The predictor would put a million dollars in front of Felix Corke.

[Pause.]

**ZOLTAN**
And the coincidence — same name, same city, same stack — that is not simulation theory. That is not fate. That is what it looks like when two people with similar aesthetic commitments live in the same city and build things for the same reasons.

The Principality of Spikeland is ten point two square metres because that is the precise size of territory Felix can actually defend. Spike.land is an AI app store because that is the precise size of territory I can actually defend.

[Beat. Quiet.]

**ZOLTAN**
We are both Spike. We both picked Brighton. We both kept building past the point where a sensible person would have stopped.

---

## CTA (9:15 – 10:00)

[VISUAL: Split screen — terminal with the 18 agent results on one side, spike.land tool list on the other]

**ZOLTAN**
Here is the actual product demo buried inside this mystery.

Eighteen parallel AI agents. WHOIS, DNS, certificate transparency, social media, Companies House, HTTP headers, PDF metadata, constitution analysis.

All of it ran in under four minutes.

[VISUAL: A timer graphic — 3 minutes 47 seconds.]

**ZOLTAN**
That is what 533 MCP tools looks like when you point them at a single question.

Not "find this person." Not "hack this domain." Just: tell me everything publicly knowable about this entity, and do it in parallel.

[VISUAL: spike.land homepage. The URL clear in the address bar.]

**ZOLTAN**
Spike.land is where those tools live. It is an open platform — if you build a tool that does something useful, you can publish it. If you need a tool that does not exist yet, you can commission it or build it with the SDK.

Every tool in this investigation — WHOIS lookup, cert transparency search, Companies House query, HTTP header analysis — every single one of those is available as a callable MCP tool on the platform.

[VISUAL: Tool cards scrolling: "whois-lookup", "cert-transparency", "companies-house-search", "http-headers-analyzer"]

**ZOLTAN**
If you want to find your own coincidence — your own parallel self who built the same thing before you arrived — the tools are there.

[Beat. Small smile.]

**ZOLTAN**
Felix, if you are watching this: your domain expires in sixteen days. I have no idea if our convergence on the same name in the same city means anything. But your headers suggest you would appreciate the question more than the answer.

GNU Terry Pratchett.

[VISUAL: The final shot — spike.land and gov.spikeland.net side by side. Both real. Both alive. For now.]

[OUTRO MUSIC]

---

## END CARDS (10:00 – 10:30)

[VISUAL: Standard YouTube end screen layout]

- Subscribe prompt
- "How I Built 533 MCP Tools" (previous video link)
- "The BAZDMEG Method" (previous video link)
- spike.land URL in lower third

---

## METADATA

**Suggested Title (primary):**
My AI Found Another "Spike Land" — In My City. So I Investigated.

**Title variants:**
- The AI Found My Mirror. And It Was There First.
- I Deployed 18 AI Agents to Find a Prince. This Is What Happened.
- Someone Built "Spike Land" Before Me. In My City. We Need to Talk.

**Description (SEO):**
While testing a business plan analyzer on spike.land, my AI returned an unexpected question: "Which Spike Land did you mean?" What followed was an 18-agent parallel investigation into a micronation, a Brighton entrepreneur, and a coincidence that might not be a coincidence at all. This video is equal parts tech demo and mystery. Visit spike.land to try the tools used in this investigation.

**Tags:**
spike.land, MCP tools, AI agents, micronation, Newcomb's paradox, Brighton, Cloudflare, AI investigation, parallel agents, tech demo, WHOIS, certificate transparency, open source AI, AI app store

**Meta description (under 160 chars):**
My AI found another Spike Land — in my city, built before I arrived. Watch 18 parallel AI agents investigate a micronation mystery in real time.

---

## SOCIAL CLIPS

**Twitter/X thread (post-publish):**
Thread: My AI found a micronation named Spike Land in Brighton. I deployed 18 agents to find the Prince. Here is what they found. [1/8]

1/ Testing a business plan analyzer. AI asks: "which Spike Land?" — I only know one.
2/ gov.spikeland.net. Population 1. 10.2 sqm. "Behind Spike's door." Same city.
3/ Deployed 18 parallel MCP agents: WHOIS, DNS, cert transparency, Companies House, HTTP headers...
4/ WHOIS: privacy wall. DNS: Google Search Console token (real human, real account).
5/ HTTP headers: "GNU Terry Pratchett. Aaron Swartz. Kafka's last letter." This is a reader.
6/ Companies House: Blackspike Ltd. Felix Corke. Brighton. Registered 2011.
7/ His brand is Spike. He was here before me. The domain expires in 16 days.
8/ Full investigation on YouTube. The tools that ran it are live on spike.land.

**LinkedIn post:**
I was doing a product demo. Live. My AI found a parallel version of my company — same name, same city, same tech stack — set up before I moved here. I deployed 18 AI agents in parallel to find the person who built it. The investigation took under four minutes. The philosophical implications took longer. New video: [link]

---

## EMAIL SUBJECT LINES (for newsletter)

1. My AI found another Spike Land (in my city)
2. 18 agents, 4 minutes, one micronation
3. The coincidence that might not be a coincidence
4. GNU Terry Pratchett (you need context for this one)
5. I think I found my mirror

---

## KEYWORDS

| Keyword | Intent | Priority |
|---|---|---|
| MCP tools | navigational + informational | HIGH |
| AI investigation tool | informational | HIGH |
| spike.land | branded | HIGH |
| parallel AI agents | informational | MEDIUM |
| Newcomb's paradox | informational | MEDIUM |
| micronation Brighton | informational | MEDIUM |
| AI app store | commercial | HIGH |
| certificate transparency search | informational | LOW |
| AI business plan analyzer | commercial | MEDIUM |
| Cloudflare AI tools | informational | MEDIUM |

---

## DISTRIBUTION PLAN

**Day 0 (publish):**
- YouTube upload with full timestamp chapters
- Twitter/X thread (8 tweets)
- LinkedIn article version
- Newsletter send (5 subject line A/B test: top 2 variants)

**Day 1:**
- Reddit: r/artificial, r/MachineLearning, r/programming (link + genuine comment)
- Hacker News: "Show HN: I deployed 18 AI agents to investigate a mystery — here is how spike.land's MCP tools actually work"

**Day 3:**
- Follow-up tweet if Felix responds or domain renews
- Screenshot of domain status (renewed or lapsed — both are content)

**Day 7:**
- Blog post version published to spike.land/blog
- Companion post: "The 18 MCP Tools That Ran This Investigation" (technical deep-dive, links to each tool on the platform)

**Evergreen:**
- This video works as a permanent product demo — link it from the spike.land onboarding flow under "See it in action"
- The investigation serves as a case study for the parallel agents feature
