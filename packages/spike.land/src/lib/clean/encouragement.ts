/**
 * Encouragement Messages — Static Arrays
 * Context-aware motivational messages for ADHD brains.
 */

export const STARTING_MESSAGES = [
  "Let's do this! Even one task is a win.",
  "Your future self is already thanking you.",
  "Small steps, big results. Ready when you are!",
  "You showed up — that's already half the battle.",
  "One task at a time. No pressure, no guilt.",
  "Every clean surface is a little victory.",
  "You've got this. Let's make some progress!",
  "Starting is the hardest part, and you just did it!",
];

export const TASK_COMPLETE_MESSAGES = [
  "Nice one! Keep that momentum going!",
  "Done! See? You're unstoppable.",
  "Another one bites the dust!",
  "Look at you go! That's real progress.",
  "Crushed it! What's next?",
  "Boom! One less thing to worry about.",
  "You're on a roll! Keep it up!",
  "That feels good, doesn't it? On to the next!",
];

export const SKIP_MESSAGES = [
  "No worries! We'll come back to this later.",
  "Totally fine — some tasks just aren't right for now.",
  "Skipped! Zero guilt. That's the rule here.",
  "Moving on! The important thing is you're still going.",
  "That's okay! Focus on what feels doable.",
];

export const STREAK_MESSAGES: Record<string, string[]> = {
  first: ["Day 1! Every streak starts here.", "You've planted the seed. Let's grow this streak!"],
  building: [
    "Your streak is growing! Keep showing up.",
    "Consistency beats perfection. You're proving it!",
    "Look at that streak! You're building a habit.",
  ],
  strong: [
    "Wow, what a streak! You're a cleaning machine!",
    "That streak is impressive. You should be proud!",
    "Unstoppable! Your space (and brain) thank you.",
  ],
  legendary: [
    "LEGENDARY streak! You've mastered the art of showing up.",
    "At this point, cleaning is just who you are. Amazing!",
    "Your streak is longer than most people's attention span. Respect!",
  ],
};

export const SESSION_COMPLETE_MESSAGES = [
  "Session complete! You made real progress today.",
  "Done! Your space is better than when you started.",
  "Finished! Every session makes it easier next time.",
  "Great work! Take a moment to appreciate what you've done.",
  "All done! You earned those points. Rest easy.",
];

export const COMEBACK_MESSAGES = [
  "Welcome back! It takes courage to start again.",
  "You're here! That's what matters. Let's go!",
  "The streak may reset, but the habit doesn't. Let's rebuild!",
  "Every champion takes breaks. The comeback is what counts.",
];

export const ACHIEVEMENT_MESSAGES: Record<string, string> = {
  FIRST_SESSION: "You did it! Your cleaning journey begins!",
  THREE_DAY_STREAK: "3 days in a row! You're building a habit!",
  SEVEN_DAY_STREAK: "A whole week! That's serious dedication!",
  THIRTY_DAY_STREAK: "30 DAYS! You're officially a cleaning legend!",
  HUNDRED_TASKS: "100 tasks done! That's a LOT of cleaning!",
  THOUSAND_TASKS: "1000 TASKS! You could write a book about cleaning!",
  SPEED_DEMON: "Speed run! Under 10 minutes — that's fast!",
  ROOM_CLEAR: "Room cleared! Not a single task left behind!",
  SKIP_ZERO: "Zero skips! You faced every task head-on!",
  COMEBACK_KID: "Welcome back! The comeback kid returns!",
  EARLY_BIRD: "Up early and cleaning! What a productive morning!",
  NIGHT_OWL: "Late-night cleaning session! Night owl power!",
  LEVEL_5: "Level 5! You're officially beyond beginner!",
  LEVEL_10: "Level 10! Double digits — impressive!",
  LEVEL_20: "Level 20! You've reached legendary status!",
};

/** Pick a random message from an array */
export function randomMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)] ?? messages[0]!;
}

/** Get streak message based on streak length */
export function getStreakMessage(streak: number): string {
  if (streak <= 1) return randomMessage(STREAK_MESSAGES.first!);
  if (streak <= 7) return randomMessage(STREAK_MESSAGES.building!);
  if (streak <= 30) return randomMessage(STREAK_MESSAGES.strong!);
  return randomMessage(STREAK_MESSAGES.legendary!);
}
