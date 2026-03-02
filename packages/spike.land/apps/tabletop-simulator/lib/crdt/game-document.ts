import * as Y from "yjs";
import type { Card, GrabbedByState } from "../../types/card";
import type { DiceState } from "../../types/dice";
import type { Player } from "../../types/game";
import type { GameMessage } from "../../types/message";

export const GAME_DOC_KEYS = {
  PLAYERS: "players",
  DECK: "deck",
  DICE: "dice",
  MESSAGES: "messages",
};

export function createGameDocument(): Y.Doc {
  return new Y.Doc();
}

export function getPlayersMap(doc: Y.Doc): Y.Map<Player> {
  return doc.getMap(GAME_DOC_KEYS.PLAYERS);
}

export function getDeckArray(doc: Y.Doc): Y.Array<Card> {
  return doc.getArray(GAME_DOC_KEYS.DECK);
}

export function getDiceArray(doc: Y.Doc): Y.Array<DiceState> {
  return doc.getArray(GAME_DOC_KEYS.DICE);
}

export function getMessagesArray(doc: Y.Doc): Y.Array<GameMessage> {
  return doc.getArray(GAME_DOC_KEYS.MESSAGES);
}

export function addPlayer(doc: Y.Doc, player: Player) {
  const players = getPlayersMap(doc);
  players.set(player.id, player);
}

export function updatePlayer(doc: Y.Doc, playerId: string, updates: Partial<Player>) {
  const players = getPlayersMap(doc);
  const current = players.get(playerId);
  if (current) {
    players.set(playerId, { ...current, ...updates });
  }
}

export function moveCard(
  doc: Y.Doc,
  cardId: string,
  position: { x: number; y: number; z: number },
  rotation?: { x: number; y: number; z: number },
) {
  doc.transact(() => {
    const deck = getDeckArray(doc);
    let index = -1;
    let found: Card | null = null;

    // Y.Array iteration to find item
    for (let i = 0; i < deck.length; i++) {
      const c = deck.get(i);
      if (c.id === cardId) {
        index = i;
        found = c;
        break;
      }
    }

    if (found && index !== -1) {
      const updated = {
        ...found,
        position,
        rotation: rotation || found.rotation,
      };
      deck.delete(index, 1);
      deck.insert(index, [updated]);
    }
  });
}

export function flipCard(doc: Y.Doc, cardId: string) {
  doc.transact(() => {
    const deck = getDeckArray(doc);
    let index = -1;
    // ... search logic duplicated, but acceptable for MVP
    for (let i = 0; i < deck.length; i++) {
      if (deck.get(i).id === cardId) {
        index = i;
        break;
      }
    }

    if (index !== -1) {
      const card = deck.get(index);
      const updated = { ...card, faceUp: !card.faceUp };
      deck.delete(index, 1);
      deck.insert(index, [updated]);
    }
  });
}

export function rollDice(doc: Y.Doc, diceId: string, seed: number) {
  doc.transact(() => {
    const diceList = getDiceArray(doc);
    for (let i = 0; i < diceList.length; i++) {
      if (diceList.get(i).id === diceId) {
        const die = diceList.get(i);
        const updated = {
          ...die,
          isRolling: true,
          seed,
        };
        diceList.delete(i, 1);
        diceList.insert(i, [updated]);
        break;
      }
    }
  });
}

export function addDice(doc: Y.Doc, dice: DiceState) {
  doc.transact(() => {
    const diceList = getDiceArray(doc);
    diceList.push([dice]);
  });
}

export function settleDice(doc: Y.Doc, diceId: string, value: number) {
  doc.transact(() => {
    const diceList = getDiceArray(doc);
    for (let i = 0; i < diceList.length; i++) {
      if (diceList.get(i).id === diceId) {
        const die = diceList.get(i);
        const updated = {
          ...die,
          isRolling: false,
          value,
        };
        diceList.delete(i, 1);
        diceList.insert(i, [updated]);
        break;
      }
    }
  });
}

export function clearDice(doc: Y.Doc, diceId: string) {
  doc.transact(() => {
    const diceList = getDiceArray(doc);
    for (let i = 0; i < diceList.length; i++) {
      if (diceList.get(i).id === diceId) {
        diceList.delete(i, 1);
        break;
      }
    }
  });
}

export function initializeDeck(doc: Y.Doc, cards: Card[]) {
  doc.transact(() => {
    const deckArray = getDeckArray(doc);
    // Clear existing cards
    if (deckArray.length > 0) {
      deckArray.delete(0, deckArray.length);
    }
    // Add new cards
    deckArray.push(cards);
  });
}

export function updateDeck(doc: Y.Doc, cards: Card[]) {
  doc.transact(() => {
    const deckArray = getDeckArray(doc);
    deckArray.delete(0, deckArray.length);
    deckArray.push(cards);
  });
}

export function drawCard(doc: Y.Doc, playerId: string): Card | null {
  let drawnCard: Card | null = null;

  doc.transact(() => {
    const deckArray = getDeckArray(doc);
    // Find first card not owned by anyone (in deck)
    for (let i = 0; i < deckArray.length; i++) {
      const card = deckArray.get(i);
      if (card.ownerId === null) {
        drawnCard = { ...card, ownerId: playerId };
        deckArray.delete(i, 1);
        deckArray.insert(i, [drawnCard]);
        break;
      }
    }
  });

  return drawnCard;
}

export function playCard(
  doc: Y.Doc,
  cardId: string,
  position: { x: number; y: number; z: number },
) {
  doc.transact(() => {
    const deckArray = getDeckArray(doc);
    for (let i = 0; i < deckArray.length; i++) {
      const card = deckArray.get(i);
      if (card.id === cardId) {
        const updated = {
          ...card,
          ownerId: null,
          position,
          faceUp: true,
        };
        deckArray.delete(i, 1);
        deckArray.insert(i, [updated]);
        break;
      }
    }
  });
}

// ============================================
// Grabbing/Releasing functions for visual multiplayer feedback
// ============================================

export function grabCard(doc: Y.Doc, cardId: string, player: GrabbedByState) {
  doc.transact(() => {
    const deck = getDeckArray(doc);
    for (let i = 0; i < deck.length; i++) {
      const card = deck.get(i);
      if (card.id === cardId) {
        const updated = { ...card, grabbedBy: player };
        deck.delete(i, 1);
        deck.insert(i, [updated]);
        break;
      }
    }
  });
}

export function releaseCard(doc: Y.Doc, cardId: string) {
  doc.transact(() => {
    const deck = getDeckArray(doc);
    for (let i = 0; i < deck.length; i++) {
      const card = deck.get(i);
      if (card.id === cardId) {
        const updated = { ...card, grabbedBy: null };
        deck.delete(i, 1);
        deck.insert(i, [updated]);
        break;
      }
    }
  });
}

export function grabDice(doc: Y.Doc, diceId: string, player: GrabbedByState) {
  doc.transact(() => {
    const diceList = getDiceArray(doc);
    for (let i = 0; i < diceList.length; i++) {
      const die = diceList.get(i);
      if (die.id === diceId) {
        const updated = { ...die, grabbedBy: player };
        diceList.delete(i, 1);
        diceList.insert(i, [updated]);
        break;
      }
    }
  });
}

export function releaseDice(doc: Y.Doc, diceId: string) {
  doc.transact(() => {
    const diceList = getDiceArray(doc);
    for (let i = 0; i < diceList.length; i++) {
      const die = diceList.get(i);
      if (die.id === diceId) {
        const updated = { ...die, grabbedBy: null };
        diceList.delete(i, 1);
        diceList.insert(i, [updated]);
        break;
      }
    }
  });
}

// ============================================
// Chat and event log functions
// ============================================

export function addMessage(doc: Y.Doc, message: GameMessage) {
  doc.transact(() => {
    const messages = getMessagesArray(doc);
    messages.push([message]);
    // Keep only last 100 messages to prevent unbounded growth
    if (messages.length > 100) {
      messages.delete(0, messages.length - 100);
    }
  });
}

export function clearMessages(doc: Y.Doc) {
  doc.transact(() => {
    const messages = getMessagesArray(doc);
    if (messages.length > 0) {
      messages.delete(0, messages.length);
    }
  });
}
