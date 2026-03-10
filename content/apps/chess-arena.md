---
name: Chess Arena
slug: chess-arena
emoji: ♟️
description: A flagship 3D chess experience inside spike.land. Complete with multiplayer matchmaking, stockfish analysis, and vibrant leaderboards.
tagline: Multiplayer chess with live ladders, match queues, and instant analysis.
category: Games & Simulation
status: live
is_featured: true
is_new: true
sort_order: 2
tools:
  - chess_create_game
  - chess_make_move
  - chess_get_leaderboard
graph:
  chess_create_game:
    inputs: {}
    outputs:
      gameId: string
    always_available: true
  chess_make_move:
    inputs:
      gameId: from:chess_create_game.gameId
    outputs: {}
  chess_get_leaderboard:
    inputs: {}
    outputs: {}
---

# Chess Arena

Welcome to the ultimate chessboard directly within your development platform.

This app features:
- **Real-time Matchmaking:** Play against developers seamlessly via our global edge network.
- **Stockfish Integration:** Get immediate evaluations of positions while you chat.
- **Tournaments:** Compete in regular blitz and rapid tournaments.
- **Social Viewing:** Watch your friends play with live chat integration alongside the board.
