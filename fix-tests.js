const fs = require('fs');

let creditsTestPath = 'src/image-studio-worker/deps/credits.test.ts';
let creditsContent = fs.readFileSync(creditsTestPath, 'utf8');

creditsContent = creditsContent.replace(
  'it("estimate", () => {',
  `it("estimate with defaults", () => {
    const credits = createD1Credits({ IMAGE_DB: {} as any } as any);
    expect(credits.estimate("TIER_1K")).toBe(2);
  });
  
  it("calculateGenerationCost with defaults", () => {
    const credits = createD1Credits({ IMAGE_DB: {} as any } as any);
    expect(credits.calculateGenerationCost({ tier: "TIER_2K" })).toBe(5);
    expect(credits.calculateGenerationCost({ tier: "UNKNOWN" as any })).toBe(1);
  });
  
  it("estimate", () => {`
);
fs.writeFileSync(creditsTestPath, creditsContent);
