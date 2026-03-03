export interface TestSuite {
  id: string;
  targetPath: string;
  sourceCode?: string;
  spec?: string;
  framework: "vitest" | "jest" | "playwright";
  testCode: string;
  createdAt: string;
}

export interface TestPattern {
  id: string;
  name: string;
  template: string;
  framework: string;
  variables: string[];
}
