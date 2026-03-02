import prisma from "@/lib/prisma";
import type { IdentifierType } from "@prisma/client";

/**
 * Creates a new identity with an initial identifier, or returns existing one if identifier already exists.
 * @param type - The type of the initial identifier.
 * @param value - The value of the initial identifier.
 * @returns The newly created or existing identity.
 */
export async function createIdentity(type: IdentifierType, value: string) {
  // First check if an identity with this identifier already exists
  const existing = await findIdentityByIdentifier(type, value);
  if (existing) {
    return existing;
  }

  // Create new identity if it doesn't exist
  return prisma.identity.create({
    data: {
      identifiers: {
        create: {
          type,
          value,
        },
      },
    },
    include: {
      identifiers: true,
    },
  });
}

/**
 * Adds a new identifier to an existing identity.
 * @param identityId - The ID of the identity to add the identifier to.
 * @param type - The type of the new identifier.
 * @param value - The value of the new identifier.
 * @returns The updated identity.
 */
export async function addIdentifier(identityId: string, type: IdentifierType, value: string) {
  return prisma.identity.update({
    where: {
      id: identityId,
    },
    data: {
      identifiers: {
        create: {
          type,
          value,
        },
      },
    },
    include: {
      identifiers: true,
    },
  });
}

/**
 * Finds an identity by one of its identifiers.
 * @param type - The type of the identifier to search for.
 * @param value - The value of the identifier to search for.
 * @returns The found identity or null.
 */
export async function findIdentityByIdentifier(type: IdentifierType, value: string) {
  const identifier = await prisma.identifier.findUnique({
    where: {
      type_value: {
        type,
        value,
      },
    },
    include: {
      identity: {
        include: {
          identifiers: true,
        },
      },
    },
  });

  return identifier?.identity || null;
}

/**
 * Merges two identities into one.
 * @param fromIdentityId - The ID of the identity to merge from.
 * @param toIdentityId - The ID of the identity to merge into.
 * @returns The merged identity.
 */
export async function mergeIdentities(fromIdentityId: string, toIdentityId: string) {
  return prisma.$transaction(async (tx) => {
    // Re-assign identifiers to the target identity
    await tx.identifier.updateMany({
      where: {
        identityId: fromIdentityId,
      },
      data: {
        identityId: toIdentityId,
      },
    });

    // Delete the old identity
    await tx.identity.delete({
      where: {
        id: fromIdentityId,
      },
    });

    return tx.identity.findUnique({
      where: {
        id: toIdentityId,
      },
      include: {
        identifiers: true,
      },
    });
  });
}
