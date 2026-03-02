import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";
import { safeDecryptToken } from "@/lib/crypto/token-encryption";

export interface AIConfig {
  name: string;
  token: string | null;
  isDefault: boolean;
  config: Record<string, unknown> | null;
}

const configCache: Record<string, { config: AIConfig | null; timestamp: number }> = {};
const CACHE_TTL = 30 * 1000; // 30 seconds

export async function resolveAIProviderConfig(name: string): Promise<AIConfig | null> {
  const now = Date.now();
  if (configCache[name] && now - configCache[name].timestamp < CACHE_TTL) {
    return configCache[name].config;
  }

  const { data: provider, error } = await tryCatch(
    prisma.aIProvider.findUnique({
      where: { name },
    }),
  );

  if (error || !provider) {
    configCache[name] = { config: null, timestamp: now };
    return null;
  }

  const config: AIConfig = {
    name: provider.name,
    token: safeDecryptToken(provider.tokenEncrypted || provider.token || ""),
    isDefault: provider.isDefault,
    config: provider.config as Record<string, unknown> | null,
  };

  configCache[name] = { config, timestamp: now };
  return config;
}

export async function getDefaultAIProvider(): Promise<AIConfig | null> {
  const { data: provider, error } = await tryCatch(
    prisma.aIProvider.findFirst({
      where: { isDefault: true },
    }),
  );

  if (error || !provider) return null;

  return {
    name: provider.name,
    token: safeDecryptToken(provider.tokenEncrypted || provider.token || ""),
    isDefault: provider.isDefault,
    config: provider.config as Record<string, unknown> | null,
  };
}
