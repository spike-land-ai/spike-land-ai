import type { MachineDefinition, MachineExport, TransitionLogEntry } from "./types.js";

/** Share a machine by creating/updating a database entry and returning a token. */
export async function shareMachine(
  userId: string,
  instance: {
    definition: MachineDefinition;
    currentStates: string[];
    context: Record<string, unknown>;
    history: Record<string, string[]>;
    transitionLog: TransitionLogEntry[];
    initialContext: Record<string, unknown>;
  },
): Promise<string> {
  // @ts-expect-error - Prisma is part of the monorepo
  const prisma = (await import("@/lib/prisma")).default;
  const { randomBytes } = await import("node:crypto");

  const existing = await prisma.stateMachine.findFirst({
    where: {
      userId,
      forkedFrom: null, // Only original machines get tokens for now
      name: instance.definition.name,
    },
  });

  const shareToken = existing?.shareToken ?? randomBytes(16).toString("hex");

  await prisma.stateMachine.upsert({
    where: { id: existing?.id ?? "" },
    create: {
      userId,
      name: instance.definition.name,
      definition: JSON.parse(JSON.stringify(instance.definition)),
      currentStates: instance.currentStates,
      context: JSON.parse(JSON.stringify(instance.context)),
      history: JSON.parse(JSON.stringify(instance.history)),
      transitionLog: JSON.parse(JSON.stringify(instance.transitionLog)),
      initialContext: JSON.parse(JSON.stringify(instance.initialContext)),
      shareToken,
      isPublic: true,
    },
    update: {
      definition: JSON.parse(JSON.stringify(instance.definition)),
      currentStates: instance.currentStates,
      context: JSON.parse(JSON.stringify(instance.context)),
      history: JSON.parse(JSON.stringify(instance.history)),
      transitionLog: JSON.parse(JSON.stringify(instance.transitionLog)),
      isPublic: true,
    },
  });

  return shareToken;
}

/** Get a shared machine by token. */
export async function getSharedMachine(token: string): Promise<MachineExport> {
  // @ts-expect-error - Prisma is part of the monorepo
  const prisma = (await import("@/lib/prisma")).default;
  const shared = await prisma.stateMachine.findUnique({
    where: { shareToken: token },
  });

  if (!shared) {
    throw new Error("Shared state machine not found");
  }

  return {
    definition: JSON.parse(JSON.stringify(shared.definition)),
    currentStates: shared.currentStates,
    context: (shared.context ?? {}) as Record<string, unknown>,
    history: (shared.history ?? {}) as Record<string, string[]>,
    transitionLog: JSON.parse(JSON.stringify(shared.transitionLog ?? [])),
  };
}
