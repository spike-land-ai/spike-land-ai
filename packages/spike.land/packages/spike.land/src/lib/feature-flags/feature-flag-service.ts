import prisma from "@/lib/prisma";

export class FeatureFlagService {
  /**
   * Check if a feature is enabled for a specific workspace or user.
   * Checks specific enables first, then percentage rollout.
   */
  static async isFeatureEnabled(
    featureName: string,
    entityId?: string,
  ): Promise<boolean> {
    const flag = await prisma.featureFlag.findUnique({
      where: { name: featureName },
    });

    if (!flag) return false;
    if (!flag.isEnabled) return false;

    // If specific entity is whitelisted
    if (entityId && flag.enabledFor.includes(entityId)) {
      return true;
    }

    // Percentage rollout
    if (flag.percentage > 0 && entityId) {
      // Simple hash-based percentage check for stability
      const hash = this.hashString(entityId + featureName);
      const normalizedHash = hash % 100;
      return normalizedHash < flag.percentage;
    }

    // If enabled globally (percentage 100 or no entity provided but flag is enabled generally?)
    // Usually if percentage > 0 and no entityId, we can't determine.
    // If percentage is 100, then it's enabled for everyone.
    if (flag.percentage === 100) return true;

    return false;
  }

  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
