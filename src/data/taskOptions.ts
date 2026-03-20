export interface TaskOptionDef {
  key: string;
  type: string;
  description: string;
  defaultValue?: string;
  docsUrl: string;
  values?: string[];
}

export const taskOptions: TaskOptionDef[] = [
  {
    key: "dependsOn",
    type: "string[]",
    description:
      "Tasks or packages that must complete before this task runs. Use '^taskname' for topological (upstream) dependencies, 'taskname' for same-package dependencies, and 'package#taskname' for specific package tasks.",
    docsUrl:
      "https://turbo.build/repo/docs/reference/configuration#dependson",
  },
  {
    key: "inputs",
    type: "string[]",
    description:
      "File glob patterns that contribute to the task hash. Only changes to matched files will invalidate the cache. Use '$TURBO_DEFAULT$' to include the default set of inputs.",
    docsUrl:
      "https://turbo.build/repo/docs/reference/configuration#inputs",
  },
  {
    key: "outputs",
    type: "string[]",
    description:
      "File glob patterns for files created by this task. These files will be cached and restored on cache hits. Use negation patterns like '!.next/cache/**' to exclude subdirectories.",
    docsUrl:
      "https://turbo.build/repo/docs/reference/configuration#outputs",
  },
  {
    key: "outputLogs",
    type: '"full" | "hash-only" | "new-only" | "errors-only" | "none"',
    description:
      "Controls which logs are printed to the terminal. 'full' prints all output, 'new-only' only prints output for cache misses, 'errors-only' only prints stderr, 'hash-only' only prints the task hash, 'none' hides all output.",
    defaultValue: "full",
    docsUrl:
      "https://turbo.build/repo/docs/reference/configuration#outputlogs",
    values: ["full", "hash-only", "new-only", "errors-only", "none"],
  },
  {
    key: "cache",
    type: "boolean",
    description:
      "Whether to cache the outputs of this task. Set to false for tasks that should always run (e.g., dev servers).",
    defaultValue: "true",
    docsUrl:
      "https://turbo.build/repo/docs/reference/configuration#cache",
  },
  {
    key: "persistent",
    type: "boolean",
    description:
      "Mark a task as a long-running process (e.g., dev servers). Persistent tasks are excluded from the task graph for non-dependent tasks so they don't block other tasks from completing.",
    defaultValue: "false",
    docsUrl:
      "https://turbo.build/repo/docs/reference/configuration#persistent",
  },
  {
    key: "env",
    type: "string[]",
    description:
      "Environment variable names that affect this task. Changes to these env vars will invalidate the cache for this task.",
    docsUrl:
      "https://turbo.build/repo/docs/reference/configuration#env",
  },
  {
    key: "passThroughEnv",
    type: "string[]",
    description:
      "Environment variables made available to this task but NOT included in the hash. Useful for secrets or tokens that should not affect caching.",
    docsUrl:
      "https://turbo.build/repo/docs/reference/configuration#passthroughenv",
  },
  {
    key: "interactiveApp",
    type: "boolean",
    description:
      "Mark a persistent task as an interactive application (e.g., a REPL). Interactive apps receive stdin from the terminal when using the TUI.",
    defaultValue: "false",
    docsUrl:
      "https://turbo.build/repo/docs/reference/configuration#interactiveapp",
  },
];

export function getTaskOption(key: string): TaskOptionDef | undefined {
  return taskOptions.find((o) => o.key === key);
}
