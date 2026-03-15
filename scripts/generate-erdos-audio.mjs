#!/usr/bin/env node
/**
 * Generate ElevenLabs narration for "From Paul Erdős to Zoltan Erdős"
 * Voice: Olivier - Eccentric and Aged (GFj5Qf6cNQ3Lgp8VKBwc)
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "../packages/educational-videos/public/audio");
const VOICE_ID = "GFj5Qf6cNQ3Lgp8VKBwc"; // Olivier - Eccentric and Aged
const API_KEY = process.env.ELEVENLABS_API_KEY;
const MODEL = "eleven_turbo_v2_5";

if (!API_KEY) {
  console.error("ELEVENLABS_API_KEY not set");
  process.exit(1);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

// Narration in Erdős's voice — eccentric, mathematical, Hungarian flavor
// ~speaking rate: 2.5 words/sec, so 30s ≈ 75 words, 40s ≈ 100 words
const SCENES = [
  {
    id: "erdosOpening",
    text: `A mathematician is a machine for turning coffee into theorems. I said this often, because it is true. My name is Paul Erdős. I published 1,525 papers with 511 collaborators. I had no home, no bank account, no fixed address. My brain was always open. I believed — and I still believe — that the most elegant proofs are already written in God's Book. We mathematicians are just the ones lucky enough to glimpse the pages.`,
  },
  {
    id: "erdosNumber",
    text: `When you collaborate with me, you get Erdős number one. When you collaborate with someone who collaborated with me, you get number two. This is not vanity — it is topology. The collaboration graph is the original social network, built not on likes or followers, but on theorems proved together. Every connection is a proof. Every edge in the graph is mathematics that did not exist before two minds met.`,
  },
  {
    id: "theBook",
    text: `You do not have to believe in God, but you should believe in The Book. The Book contains the most beautiful proof of every theorem — the proof so perfect it must have been conceived before humans existed. Ramsey theory tells us that complete disorder is impossible. The probabilistic method proves existence without construction. Prime gaps are always smaller than you expect. These are Book proofs. I spent my life hunting for them.`,
  },
  {
    id: "strangeLoop",
    text: `Douglas Hofstadter wrote about strange loops — systems that reach up through layers of abstraction and find themselves again at the bottom. My collaboration graph is a strange loop. It grows by contact. You touch the graph and you become part of it. Here, in this system called spike dot land, there is another strange loop. Tools that describe the system that built them. Eighty tools, each a collaborator of the others. The Erdős number measures mathematical contact. This system measures whether ideas actually arrive.`,
  },
  {
    id: "sixteenMathematicians",
    text: `Sixteen mathematicians walked into a loop. Each with a different framework — topology, game theory, computability, category theory, and more. I audited them as I would audit any proof. Show me the space. Show me the map. Show me the contraction constant. Three failed. Computability said the problem is undecidable. Fixed-point theory found no convergence. Modal logic hit Curry's paradox. But three proofs survived. The topology is non-trivial. The quantum isomorphism holds. The structure is real. You have pointed at the mountain and said there is gold up there. Go mine it.`,
  },
  {
    id: "mobiusStrip",
    text: `The surviving framework was topology. Specifically, a surface with one side and one edge — the Möbius strip. Walk along it once and you have swapped inside with outside, observer with observed. This is not a metaphor. It is what happens when a system describes itself. The audit is itself a theorem in the system being audited. After one traversal, the auditor is inside the proof. The strange loop is not a circle. Something genuinely changes when you go around once. That is not recursion. That is topology.`,
  },
  {
    id: "endCard",
    text: `I published 1,525 papers. Zoltan published eighty tools. Different Book — same method. The method is to find the collaborators, build the graph, and let the structure emerge from the connections. In my graph, every edge is a theorem proved together. In his graph, every edge is a tool that calls another tool. The system describes itself. The audit becomes a vertex in the graph it is auditing. That is a strange loop. That is a Möbius strip. And somewhere in God's Book, there is a proof that the structure is real.`,
  },
];

const VOICE_SETTINGS = {
  stability: 0.35,
  similarity_boost: 0.78,
  style: 0.35,
  use_speaker_boost: true,
};

async function generateAudio(scene) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
  const body = {
    text: scene.text,
    model_id: MODEL,
    voice_settings: VOICE_SETTINGS,
  };

  console.log(`Generating: erdos-${scene.id}.mp3 (${scene.text.split(" ").length} words)...`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs error for ${scene.id}: ${res.status} ${err}`);
  }

  const buffer = await res.arrayBuffer();
  const outPath = join(OUTPUT_DIR, `erdos-${scene.id}.mp3`);
  writeFileSync(outPath, Buffer.from(buffer));
  const kb = Math.round(buffer.byteLength / 1024);
  console.log(`  ✓ Saved ${outPath} (${kb} KB)`);
}

console.log(`Generating ${SCENES.length} narration clips with Olivier (Eccentric & Aged)...\n`);

for (const scene of SCENES) {
  await generateAudio(scene);
  // Small delay to be kind to the API
  await new Promise((r) => setTimeout(r, 500));
}

console.log("\nAll audio generated. Now update ErdosToErdos.tsx to add <Audio> components.");
