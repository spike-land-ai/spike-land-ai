import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function getPersonalWorkspaceId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  // Personal workspace is linked via WorkspaceMember, with isPersonal=true
  const workspace = await prisma.workspace.findFirst({
    where: {
      isPersonal: true,
      members: {
        some: { userId: session.user.id },
      },
    },
    select: { id: true },
  });
  return workspace?.id ?? null;
}
