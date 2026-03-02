"use client";
import { useCallback, useEffect, useState } from "react";
import type * as Y from "yjs";
import {
  getDeckArray,
  getDiceArray,
  getMessagesArray,
  getPlayersMap,
} from "../lib/crdt/game-document";
import type { Card } from "../types/card";
import type { DiceState } from "../types/dice";
import type { Player } from "../types/game";
import type { GameMessage } from "../types/message";

export interface GameStateSnapshot {
  cards: Card[];
  dice: DiceState[];
  players: Player[];
  messages: GameMessage[];
}

export function useYjsState(doc: Y.Doc | null, isSynced: boolean = false): GameStateSnapshot {
  const [state, setState] = useState<GameStateSnapshot>({
    cards: [],
    dice: [],
    players: [],
    messages: [],
  });

  const refreshState = useCallback(() => {
    if (!doc) return;
    const deckArray = getDeckArray(doc);
    const diceArray = getDiceArray(doc);
    const playersMap = getPlayersMap(doc);
    const messagesArray = getMessagesArray(doc);
    setState({
      cards: deckArray.toArray(),
      dice: diceArray.toArray(),
      players: Array.from(playersMap.values()),
      messages: messagesArray.toArray(),
    });
  }, [doc]);

  useEffect(() => {
    if (!doc) return;

    const deckArray = getDeckArray(doc);
    const diceArray = getDiceArray(doc);
    const playersMap = getPlayersMap(doc);
    const messagesArray = getMessagesArray(doc);

    // Initial state
    refreshState();

    // Subscribe to changes
    deckArray.observe(refreshState);
    diceArray.observe(refreshState);
    playersMap.observe(refreshState);
    messagesArray.observe(refreshState);

    return () => {
      deckArray.unobserve(refreshState);
      diceArray.unobserve(refreshState);
      playersMap.unobserve(refreshState);
      messagesArray.unobserve(refreshState);
    };
  }, [doc, refreshState]);

  // Re-read state when persistence sync completes
  useEffect(() => {
    if (isSynced) {
      refreshState();
    }
  }, [isSynced, refreshState]);

  return state;
}
