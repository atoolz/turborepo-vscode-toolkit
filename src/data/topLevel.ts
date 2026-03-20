export interface TopLevelKey {
  key: string;
  type: string;
  description: string;
  defaultValue?: string;
  docsUrl: string;
  deprecated?: boolean;
  deprecatedMessage?: string;
  values?: string[];
}

export const topLevelKeys: TopLevelKey[] = [
  {
    key: "$schema",
    type: "string",
    description: "JSON Schema URL for validation and IntelliSense.",
    defaultValue: "https://turbo.build/schema.json",
    docsUrl: "https://turbo.build/repo/docs/reference/configuration",
  },
  {
    key: "ui",
    type: '"tui" | "stream"',
    description:
      "Select the terminal UI for turbo run. 'tui' shows a full-screen terminal UI. 'stream' streams task logs to stdout.",
    defaultValue: "stream",
    docsUrl: "https://turbo.build/repo/docs/reference/configuration#ui",
    values: ["tui", "stream"],
  },
  {
    key: "tasks",
    type: "object",
    description:
      "An object of task definitions. Each key is a task name and the value configures how that task runs.",
    docsUrl: "https://turbo.build/repo/docs/reference/configuration#tasks",
  },
  {
    key: "globalDependencies",
    type: "string[]",
    description:
      "A list of file globs that are considered inputs for ALL tasks. Changes to these files will invalidate the cache for every task.",
    docsUrl:
      "https://turbo.build/repo/docs/reference/configuration#globaldependencies",
  },
  {
    key: "globalEnv",
    type: "string[]",
    description:
      "A list of environment variable names that affect ALL tasks. Changes to these env vars will invalidate the cache for every task.",
    docsUrl:
      "https://turbo.build/repo/docs/reference/configuration#globalenv",
  },
  {
    key: "globalPassThroughEnv",
    type: "string[]",
    description:
      "A list of environment variables that are made available to all tasks but do NOT contribute to the task hash. Useful for variables like CI tokens.",
    docsUrl:
      "https://turbo.build/repo/docs/reference/configuration#globalpassthroughenv",
  },
  {
    key: "extends",
    type: "string[]",
    description:
      'Used in package-level turbo.json to extend the root configuration. Use ["//"] to extend the root turbo.json.',
    docsUrl:
      "https://turbo.build/repo/docs/reference/configuration#extends",
  },
  {
    key: "experimentalUI",
    type: "boolean",
    description: "Deprecated. Use 'ui' instead.",
    docsUrl: "https://turbo.build/repo/docs/reference/configuration#ui",
    deprecated: true,
    deprecatedMessage: "Use 'ui' instead of 'experimentalUI'.",
  },
  {
    key: "daemon",
    type: "boolean",
    description:
      "Enable or disable the turbo daemon. The daemon watches for file changes and can speed up repeated runs.",
    defaultValue: "true",
    docsUrl:
      "https://turbo.build/repo/docs/reference/configuration#daemon",
  },
  {
    key: "cacheDir",
    type: "string",
    description: "The directory to store task cache artifacts.",
    defaultValue: ".turbo/cache",
    docsUrl:
      "https://turbo.build/repo/docs/reference/configuration#cachedir",
  },
  {
    key: "envMode",
    type: '"strict" | "loose"',
    description:
      "Controls how environment variables are handled for caching. 'strict' only includes env vars listed in env/globalEnv. 'loose' includes all env vars.",
    defaultValue: "strict",
    docsUrl:
      "https://turbo.build/repo/docs/reference/configuration#envmode",
    values: ["strict", "loose"],
  },
];

export function getTopLevelKey(key: string): TopLevelKey | undefined {
  return topLevelKeys.find((k) => k.key === key);
}
