import * as vscode from "vscode";

export interface TurboJsonContext {
  isInsideTasks: boolean;
  isInsideTaskConfig: boolean;
  taskName: string | null;
  currentKey: string | null;
  isInsideArray: boolean;
  arrayKey: string | null;
  isTopLevel: boolean;
  isPackageLevel: boolean;
  path: string[];
}

/**
 * Parse turbo.json to determine the cursor context.
 * We walk through the text manually to figure out nesting level,
 * which JSON key we're inside, etc.
 */
export function getTurboContext(
  document: vscode.TextDocument,
  position: vscode.Position
): TurboJsonContext {
  const text = document.getText(
    new vscode.Range(new vscode.Position(0, 0), position)
  );
  const fullText = document.getText();
  const isPackageLevel = fullText.includes('"extends"');

  const context: TurboJsonContext = {
    isInsideTasks: false,
    isInsideTaskConfig: false,
    taskName: null,
    currentKey: null,
    isInsideArray: false,
    arrayKey: null,
    isTopLevel: false,
    isPackageLevel,
    path: [],
  };

  const braceStack: Array<{ type: "{" | "["; key: string | null }> = [];
  let inString = false;
  let escape = false;
  let currentStr = "";
  let lastKey: string | null = null;
  let afterColon = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      if (inString) {
        currentStr += ch;
      }
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      if (inString) {
        currentStr += ch;
      }
      continue;
    }

    if (ch === '"') {
      if (inString) {
        inString = false;
        if (!afterColon) {
          lastKey = currentStr;
        }
        currentStr = "";
      } else {
        inString = true;
        currentStr = "";
      }
      continue;
    }

    if (inString) {
      currentStr += ch;
      continue;
    }

    if (ch === ":") {
      afterColon = true;
      continue;
    }

    if (ch === ",") {
      afterColon = false;
      continue;
    }

    if (ch === "{") {
      braceStack.push({ type: "{", key: lastKey });
      afterColon = false;
      continue;
    }

    if (ch === "}") {
      braceStack.pop();
      afterColon = false;
      continue;
    }

    if (ch === "[") {
      braceStack.push({ type: "[", key: lastKey });
      afterColon = false;
      continue;
    }

    if (ch === "]") {
      braceStack.pop();
      afterColon = false;
      continue;
    }
  }

  // Build path from the brace stack
  const path: string[] = [];
  for (const frame of braceStack) {
    if (frame.key) {
      path.push(frame.key);
    }
  }
  context.path = path;

  const depth = braceStack.length;

  // Depth 1 = inside root object
  if (depth === 1) {
    context.isTopLevel = true;
    if (afterColon) {
      context.currentKey = lastKey;
    }
  }

  // Depth 2 = inside "tasks" object or value of a top-level key
  if (depth === 2) {
    const parentKey = braceStack[0]?.key;
    if (parentKey === null) {
      // inside root
      const currentParent = braceStack[1]?.key;
      if (currentParent === "tasks" || path.includes("tasks")) {
        context.isInsideTasks = true;
      }
    }
    if (path.includes("tasks")) {
      context.isInsideTasks = true;
    }
  }

  // Depth 3 = inside a task config
  if (depth >= 3 && path.includes("tasks")) {
    context.isInsideTasks = true;
    context.isInsideTaskConfig = true;
    // Find task name: the key right after "tasks"
    const tasksIdx = path.indexOf("tasks");
    if (tasksIdx >= 0 && tasksIdx + 1 < path.length) {
      context.taskName = path[tasksIdx + 1];
    }
    if (afterColon) {
      context.currentKey = lastKey;
    }
  }

  // Check if inside an array
  if (braceStack.length > 0) {
    const top = braceStack[braceStack.length - 1];
    if (top.type === "[") {
      context.isInsideArray = true;
      context.arrayKey = top.key;
    }
  }

  return context;
}

export interface TurboJson {
  tasks?: Record<string, TaskConfig>;
  extends?: string[];
  globalDependencies?: string[];
  globalEnv?: string[];
  globalPassThroughEnv?: string[];
  ui?: string;
  daemon?: boolean;
  cacheDir?: string;
  envMode?: string;
}

export interface TaskConfig {
  dependsOn?: string[];
  inputs?: string[];
  outputs?: string[];
  outputLogs?: string;
  cache?: boolean;
  persistent?: boolean;
  env?: string[];
  passThroughEnv?: string[];
  interactiveApp?: boolean;
}

export function parseTurboJson(text: string): TurboJson | null {
  try {
    return JSON.parse(text) as TurboJson;
  } catch {
    return null;
  }
}

/**
 * Find the position of a task definition key in turbo.json.
 */
export function findTaskPosition(
  document: vscode.TextDocument,
  taskName: string
): vscode.Position | null {
  const text = document.getText();
  const pattern = new RegExp(`"${escapeRegex(taskName)}"\\s*:\\s*\\{`);
  const match = pattern.exec(text);
  if (match) {
    return document.positionAt(match.index);
  }
  return null;
}

/**
 * Find the range of a task definition in turbo.json.
 */
export function findTaskRange(
  document: vscode.TextDocument,
  taskName: string
): vscode.Range | null {
  const text = document.getText();
  const pattern = new RegExp(`"${escapeRegex(taskName)}"\\s*:\\s*\\{`);
  const match = pattern.exec(text);
  if (!match) {
    return null;
  }

  const startOffset = match.index;
  // Find the matching closing brace
  const braceStart = text.indexOf("{", startOffset + taskName.length + 2);
  if (braceStart === -1) {
    return null;
  }

  let depth = 1;
  let i = braceStart + 1;
  let inStr = false;
  let esc = false;
  while (i < text.length && depth > 0) {
    const ch = text[i];
    if (esc) {
      esc = false;
      i++;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      i++;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      i++;
      continue;
    }
    if (!inStr) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
    }
    i++;
  }

  return new vscode.Range(
    document.positionAt(startOffset),
    document.positionAt(i)
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
