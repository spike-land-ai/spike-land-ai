import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the stripe SDK — must be constructable with `new Stripe(...)`
const mockStripeInstance = {
  customers: { list: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  subscriptions: { list: vi.fn() },
  webhooks: { constructEvent: vi.fn() },
};

const MockStripeCtor = vi.fn(
  function StripeMock(this: Record<string, unknown>) {
    Object.assign(this, mockStripeInstance);
  } as unknown as (...args: unknown[]) => typeof mockStripeInstance,
);

vi.mock("stripe", () => ({
  default: MockStripeCtor,
}));

describe("stripe/client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getStripe", () => {
    it("should throw when STRIPE_SECRET_KEY is not set", async () => {
      delete process.env.STRIPE_SECRET_KEY;
      const { getStripe } = await import("./client");

      expect(() => getStripe()).toThrow("STRIPE_SECRET_KEY is not configured");
    });

    it("should create a Stripe instance when key is set", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_123";
      const { getStripe } = await import("./client");

      const client = getStripe();

      expect(MockStripeCtor).toHaveBeenCalledWith("sk_test_123");
      expect(client.customers).toBe(mockStripeInstance.customers);
    });

    it("should return the same instance on subsequent calls (singleton)", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_123";
      const { getStripe } = await import("./client");

      const first = getStripe();
      const second = getStripe();

      expect(first).toBe(second);
    });
  });

  describe("stripe lazy proxy", () => {
    it("should proxy customers to the Stripe instance", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_123";
      const { stripe } = await import("./client");

      expect(stripe.customers).toEqual(mockStripeInstance.customers);
    });

    it("should proxy checkout to the Stripe instance", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_123";
      const { stripe } = await import("./client");

      expect(stripe.checkout).toEqual(mockStripeInstance.checkout);
    });

    it("should proxy subscriptions to the Stripe instance", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_123";
      const { stripe } = await import("./client");

      expect(stripe.subscriptions).toEqual(mockStripeInstance.subscriptions);
    });

    it("should proxy webhooks to the Stripe instance", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_123";
      const { stripe } = await import("./client");

      expect(stripe.webhooks).toEqual(mockStripeInstance.webhooks);
    });
  });

  describe("constants", () => {
    it("should export CURRENCY with GBP", async () => {
      const { CURRENCY } = await import("./client");

      expect(CURRENCY.code).toBe("GBP");
      expect(CURRENCY.symbol).toBe("\u00A3");
    });

    it("should export TOKEN_PACKAGES with correct structure", async () => {
      const { TOKEN_PACKAGES } = await import("./client");

      expect(TOKEN_PACKAGES.starter).toEqual({
        tokens: 10,
        price: 2.99,
        name: "Starter Pack",
      });
      expect(TOKEN_PACKAGES.basic).toEqual({
        tokens: 50,
        price: 9.99,
        name: "Basic Pack",
      });
      expect(TOKEN_PACKAGES.pro).toEqual({
        tokens: 150,
        price: 24.99,
        name: "Pro Pack",
      });
      expect(TOKEN_PACKAGES.power).toEqual({
        tokens: 500,
        price: 69.99,
        name: "Power Pack",
      });
    });

    it("should export SUBSCRIPTION_PLANS with correct structure", async () => {
      const { SUBSCRIPTION_PLANS } = await import("./client");

      expect(SUBSCRIPTION_PLANS.hobby.tokensPerMonth).toBe(30);
      expect(SUBSCRIPTION_PLANS.hobby.priceGBP).toBe(4.99);
      expect(SUBSCRIPTION_PLANS.creator.tokensPerMonth).toBe(100);
      expect(SUBSCRIPTION_PLANS.studio.tokensPerMonth).toBe(300);
      expect(SUBSCRIPTION_PLANS.studio.maxRollover).toBe(0); // unlimited
    });

    it("should export ENHANCEMENT_COSTS with tier values", async () => {
      const { ENHANCEMENT_COSTS } = await import("./client");

      expect(ENHANCEMENT_COSTS.TIER_1K).toBe(2);
      expect(ENHANCEMENT_COSTS.TIER_2K).toBe(5);
      expect(ENHANCEMENT_COSTS.TIER_4K).toBe(10);
    });

    it("should export TIER_SUBSCRIPTIONS with correct well capacities", async () => {
      const { TIER_SUBSCRIPTIONS } = await import("./client");

      expect(TIER_SUBSCRIPTIONS.BASIC.wellCapacity).toBe(20);
      expect(TIER_SUBSCRIPTIONS.BASIC.priceGBP).toBe(5);
      expect(TIER_SUBSCRIPTIONS.STANDARD.wellCapacity).toBe(50);
      expect(TIER_SUBSCRIPTIONS.PREMIUM.wellCapacity).toBe(100);
    });

    it("should export WORKSPACE_TIER_PLANS with PRO and BUSINESS", async () => {
      const { WORKSPACE_TIER_PLANS } = await import("./client");

      expect(WORKSPACE_TIER_PLANS.PRO.priceGBP).toBe(29);
      expect(WORKSPACE_TIER_PLANS.PRO.monthlyAiCredits).toBe(1000);
      expect(WORKSPACE_TIER_PLANS.BUSINESS.priceGBP).toBe(99);
      expect(WORKSPACE_TIER_PLANS.BUSINESS.monthlyAiCredits).toBe(5000);
    });
  });

  describe("type exports", () => {
    it("should export type aliases for package IDs", async () => {
      // These are type-only exports, but we can verify the constants they reference exist
      const mod = await import("./client");

      // Verify the keys match what the types reference
      const tokenKeys: Array<keyof typeof mod.TOKEN_PACKAGES> = [
        "starter",
        "basic",
        "pro",
        "power",
      ];
      expect(Object.keys(mod.TOKEN_PACKAGES)).toEqual(tokenKeys);

      const subKeys: Array<keyof typeof mod.SUBSCRIPTION_PLANS> = [
        "hobby",
        "creator",
        "studio",
      ];
      expect(Object.keys(mod.SUBSCRIPTION_PLANS)).toEqual(subKeys);

      const tierKeys: Array<keyof typeof mod.TIER_SUBSCRIPTIONS> = [
        "BASIC",
        "STANDARD",
        "PREMIUM",
      ];
      expect(Object.keys(mod.TIER_SUBSCRIPTIONS)).toEqual(tierKeys);

      const wsKeys: Array<keyof typeof mod.WORKSPACE_TIER_PLANS> = [
        "PRO",
        "BUSINESS",
      ];
      expect(Object.keys(mod.WORKSPACE_TIER_PLANS)).toEqual(wsKeys);
    });
  });
});
