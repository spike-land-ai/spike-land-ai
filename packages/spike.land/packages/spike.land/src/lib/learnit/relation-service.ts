import type { LearnItRelationType } from "@/generated/prisma";
import prisma from "@/lib/prisma";

/**
 * Service for managing LearnIt topic relationships (graph database operations)
 */

export interface CreateRelationInput {
  fromTopicId: string;
  toTopicId: string;
  type: LearnItRelationType;
  strength?: number;
}

/**
 * Create a relationship between two topics
 */
export async function createRelation(input: CreateRelationInput) {
  return prisma.learnItRelation.upsert({
    where: {
      fromTopicId_toTopicId_type: {
        fromTopicId: input.fromTopicId,
        toTopicId: input.toTopicId,
        type: input.type,
      },
    },
    create: {
      fromTopicId: input.fromTopicId,
      toTopicId: input.toTopicId,
      type: input.type,
      strength: input.strength ?? 1.0,
    },
    update: {
      strength: input.strength ?? 1.0,
    },
  });
}

/**
 * Create bidirectional RELATED relationships between two topics
 */
export async function createBidirectionalRelation(
  topicAId: string,
  topicBId: string,
  strength = 1.0,
) {
  await Promise.all([
    createRelation({
      fromTopicId: topicAId,
      toTopicId: topicBId,
      type: "RELATED",
      strength,
    }),
    createRelation({
      fromTopicId: topicBId,
      toTopicId: topicAId,
      type: "RELATED",
      strength,
    }),
  ]);
}

/**
 * Create relationships from wiki links found in content
 * This is called after content generation to link topics
 */
export async function createRelationsFromWikiLinks(
  fromTopicId: string,
  wikiLinkSlugs: string[],
) {
  const existingTopics = await prisma.learnItContent.findMany({
    where: {
      slug: { in: wikiLinkSlugs },
      status: "PUBLISHED",
    },
    select: { id: true, slug: true },
  });

  const relations = existingTopics.map(topic =>
    createRelation({
      fromTopicId,
      toTopicId: topic.id,
      type: "RELATED",
      strength: 0.8, // Wiki links are strong indicators of relevance
    })
  );

  await Promise.all(relations);

  return existingTopics.length;
}

/**
 * Set up parent-child relationship based on path hierarchy
 */
export async function createParentChildRelation(
  childId: string,
  parentSlug: string | null,
) {
  if (!parentSlug) return null;

  const parent = await prisma.learnItContent.findUnique({
    where: { slug: parentSlug },
    select: { id: true },
  });

  if (!parent) return null;

  return createRelation({
    fromTopicId: parent.id,
    toTopicId: childId,
    type: "PARENT_CHILD",
    strength: 1.0,
  });
}

/**
 * Get all related topics for a given topic
 */
export async function getRelatedTopics(topicId: string, limit = 5) {
  const relations = await prisma.learnItRelation.findMany({
    where: {
      fromTopicId: topicId,
      type: "RELATED",
      toTopic: {
        status: "PUBLISHED",
      },
    },
    include: {
      toTopic: {
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
        },
      },
    },
    orderBy: { strength: "desc" },
    take: limit,
  });

  return relations.map(r => r.toTopic);
}

/**
 * Get prerequisites for a given topic
 */
export async function getPrerequisites(topicId: string) {
  const relations = await prisma.learnItRelation.findMany({
    where: {
      toTopicId: topicId,
      type: "PREREQUISITE",
      fromTopic: {
        status: "PUBLISHED",
      },
    },
    include: {
      fromTopic: {
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
        },
      },
    },
    orderBy: { strength: "desc" },
  });

  return relations.map(r => r.fromTopic);
}

/**
 * Get child topics (topics that have this as a parent)
 */
export async function getChildTopics(topicId: string) {
  const relations = await prisma.learnItRelation.findMany({
    where: {
      fromTopicId: topicId,
      type: "PARENT_CHILD",
      toTopic: {
        status: "PUBLISHED",
      },
    },
    include: {
      toTopic: {
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
        },
      },
    },
    orderBy: {
      toTopic: { title: "asc" },
    },
  });

  return relations.map(r => r.toTopic);
}

/**
 * Get the parent topic
 */
export async function getParentTopic(topicId: string) {
  const relation = await prisma.learnItRelation.findFirst({
    where: {
      toTopicId: topicId,
      type: "PARENT_CHILD",
      fromTopic: {
        status: "PUBLISHED",
      },
    },
    include: {
      fromTopic: {
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
        },
      },
    },
  });

  return relation?.fromTopic ?? null;
}

/**
 * Get all relationships for a topic (both incoming and outgoing)
 */
export async function getAllRelationsForTopic(topicId: string) {
  const [outgoing, incoming] = await Promise.all([
    prisma.learnItRelation.findMany({
      where: { fromTopicId: topicId },
      include: {
        toTopic: {
          select: {
            id: true,
            slug: true,
            title: true,
            status: true,
          },
        },
      },
    }),
    prisma.learnItRelation.findMany({
      where: { toTopicId: topicId },
      include: {
        fromTopic: {
          select: {
            id: true,
            slug: true,
            title: true,
            status: true,
          },
        },
      },
    }),
  ]);

  return { outgoing, incoming };
}

/**
 * Delete all relationships for a topic
 */
export async function deleteAllRelationsForTopic(topicId: string) {
  await prisma.learnItRelation.deleteMany({
    where: {
      OR: [{ fromTopicId: topicId }, { toTopicId: topicId }],
    },
  });
}

/**
 * Check if a relationship exists between two topics
 */
export async function relationExists(
  fromTopicId: string,
  toTopicId: string,
  type?: LearnItRelationType,
) {
  const where = type
    ? { fromTopicId, toTopicId, type }
    : { fromTopicId, toTopicId };

  const count = await prisma.learnItRelation.count({ where });
  return count > 0;
}
