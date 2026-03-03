import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import {
  EscalationEventType,
  EscalationStatus,
  EscalationTrigger,
  type InboxItem,
} from "@prisma/client";
import { getSmartRoutingSettings } from "./settings";

export class EscalationService {
  constructor(private workspaceId: string) {}

  async escalateItem(
    itemId: string,
    trigger: EscalationTrigger,
    reason: string,
    targetLevel?: number,
    targetUserId?: string,
  ) {
    const item = await prisma.inboxItem.findUnique({
      where: { id: itemId },
      include: { workspace: true },
    });

    if (!item) throw new Error("Inbox item not found");

    const settings = await getSmartRoutingSettings(this.workspaceId);
    const currentLevel = item.escalationLevel || 0;
    const nextLevel = targetLevel ?? (currentLevel + 1);

    // Validate level exists
    const levelDef = settings.escalation.levels.find(l => l.level === nextLevel);
    if (!levelDef) {
      // Max level reached or invalid
      logger.warn(`Cannot escalate item ${itemId} to level ${nextLevel}`);
      return;
    }

    // Update item
    const updatedItem = await prisma.inboxItem.update({
      where: { id: itemId },
      data: {
        escalationStatus: EscalationStatus.ESCALATED,
        escalationLevel: nextLevel,
        escalatedAt: new Date(),
        escalatedToId: targetUserId, // Optionally assign
        // Reset or update SLA deadline for new level
        slaDeadline: this.calculateSLADeadline(
          settings.escalation.slaTimeoutMinutes,
        ),
      },
    });

    // Log event
    await prisma.escalationEvent.create({
      data: {
        inboxItemId: itemId,
        eventType: EscalationEventType.ESCALATED,
        fromLevel: currentLevel,
        toLevel: nextLevel,
        reason,
        triggeredBy: trigger,
        toUserId: targetUserId,
      },
    });

    // Send notifications
    await this.notifyEscalation(updatedItem, levelDef.notifyChannels);

    return updatedItem;
  }

  async checkSLABreaches() {
    // Find items past deadline that aren't resolved
    const breaches = await prisma.inboxItem.findMany({
      where: {
        workspaceId: this.workspaceId,
        slaDeadline: { lt: new Date() },
        slaBreach: false,
        status: { notIn: ["REPLIED", "ARCHIVED", "IGNORED"] },
      },
    });

    for (const item of breaches) {
      await prisma.inboxItem.update({
        where: { id: item.id },
        data: { slaBreach: true },
      });

      // Auto-escalate on breach
      await this.escalateItem(
        item.id,
        EscalationTrigger.SLA_TIMEOUT,
        "SLA Deadline exceeded",
      );
    }
  }

  private calculateSLADeadline(minutes: number): Date {
    return new Date(Date.now() + minutes * 60000);
  }

  private async notifyEscalation(item: InboxItem, channels: string[]) {
    // Placeholder: Integration with NotificationSystem
    logger.info(`[Escalation] Notify channels ${channels} for item ${item.id}`);
    // await notificationSystem.send(...)
  }
}
