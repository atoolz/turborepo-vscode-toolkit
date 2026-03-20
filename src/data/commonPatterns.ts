export const commonOutputPatterns = [
  { pattern: "dist/**", description: "Compiled output directory" },
  { pattern: ".next/**", description: "Next.js build output" },
  {
    pattern: "!.next/cache/**",
    description: "Exclude Next.js cache from outputs",
  },
  { pattern: "build/**", description: "Build output directory" },
  { pattern: "out/**", description: "Static export output" },
  { pattern: ".svelte-kit/**", description: "SvelteKit build output" },
  { pattern: ".nuxt/**", description: "Nuxt build output" },
  { pattern: "coverage/**", description: "Test coverage reports" },
  { pattern: "storybook-static/**", description: "Storybook build output" },
  { pattern: "lib/**", description: "Library compiled output" },
  { pattern: "es/**", description: "ES module output" },
  { pattern: "cjs/**", description: "CommonJS output" },
  { pattern: "types/**", description: "TypeScript declaration output" },
];

export const commonInputPatterns = [
  {
    pattern: "$TURBO_DEFAULT$",
    description:
      "Default inputs: all files tracked by git in the package, excluding outputs from other tasks",
  },
  { pattern: "src/**/*.ts", description: "TypeScript source files" },
  { pattern: "src/**/*.tsx", description: "TypeScript React source files" },
  { pattern: "src/**/*.js", description: "JavaScript source files" },
  { pattern: "src/**/*.jsx", description: "JavaScript React source files" },
  { pattern: "src/**/*.css", description: "CSS files" },
  { pattern: "test/**/*.ts", description: "TypeScript test files" },
  { pattern: "test/**/*.tsx", description: "TypeScript React test files" },
  {
    pattern: "tests/**/*.ts",
    description: "TypeScript test files (tests dir)",
  },
  { pattern: ".env*", description: "Environment variable files" },
  { pattern: "tsconfig.json", description: "TypeScript configuration" },
  { pattern: "package.json", description: "Package manifest" },
];

export const commonDependsOn = [
  {
    pattern: "^build",
    description:
      "Topological dependency: run 'build' in all upstream (dependency) packages first",
  },
  {
    pattern: "^lint",
    description:
      "Topological dependency: run 'lint' in all upstream packages first",
  },
  {
    pattern: "^typecheck",
    description:
      "Topological dependency: run 'typecheck' in all upstream packages first",
  },
  {
    pattern: "build",
    description: "Same-package dependency: run 'build' in this package first",
  },
  {
    pattern: "lint",
    description: "Same-package dependency: run 'lint' in this package first",
  },
  {
    pattern: "test",
    description: "Same-package dependency: run 'test' in this package first",
  },
  {
    pattern: "typecheck",
    description:
      "Same-package dependency: run 'typecheck' in this package first",
  },
];

export const commonEnvVars = [
  "NODE_ENV",
  "CI",
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_URL",
  "NEXT_PUBLIC_API_URL",
  "API_URL",
  "DATABASE_URL",
  "GITHUB_TOKEN",
  "NPM_TOKEN",
  "PORT",
  "HOST",
  "LOG_LEVEL",
];

export const commonTasks = [
  "build",
  "dev",
  "lint",
  "test",
  "typecheck",
  "clean",
  "deploy",
  "start",
  "format",
  "generate",
  "storybook",
  "e2e",
];
