import { nanoid } from "nanoid";
import type { Card, Rank, Suit } from "../../types/card";
import { DeterministicRandom } from "../physics/deterministic-random";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function createStandardDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        id: nanoid(),
        suit,
        rank,
        faceUp: false,
        ownerId: null,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: Math.PI }, // Face down
        zIndex: 0,
      });
    }
  }
  return cards;
}

export function shuffleDeck(cards: Card[], seed: number): Card[] {
  const rng = new DeterministicRandom(seed);
  const shuffled = [...cards];

  // Fisher-Yates shuffle
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rng.rangeInt(0, i);
    const cardI = shuffled[i]!;
    const cardJ = shuffled[j]!;
    shuffled[i] = cardJ;
    shuffled[j] = cardI;

    // Update z-index roughly to match stack order
    shuffled[i]!.zIndex = i;
    shuffled[j]!.zIndex = j;
  }

  return shuffled;
}

export function dealCards(
  cards: Card[],
  count: number,
  playerId: string,
): { dealt: Card[]; remaining: Card[] } {
  const remaining = [...cards];
  const dealt = remaining.splice(0, count).map((card) => ({
    ...card,
    ownerId: playerId,
    faceUp: false, // Hidden to others, visible to owner usually handled by client view or keeping faceUp false but allowing peek
  }));

  return { dealt, remaining };
}
