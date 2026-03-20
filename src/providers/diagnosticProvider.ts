import * as vscode from "vscode";
import { parseTurboJson, TurboJson, TaskConfig } from "../utils/turboParser";
import { taskOptions } from "../data/taskOptions";
import { topLevelKeys } from "../data/topLevel";

const VALID_TASK_KEYS = new Set(taskOptions.map((o) => o.key));
const VALID_TOP_LEVEL_KEYS = new Set(topLevelKeys.map((k) => k.key));
const VALID_OUTPUT_LOGS = new Set([
  "full",
  "hash-only",
  "new-only",
  "errors-only",
  "none",
]);

export class TurboDiagnosticProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor() {
    this.diagnosticCollection =
      vscode.languages.createDiagnosticCollection("turborepo");
  }

  dispose(): void {
    this.diagnosticCollection.dispose();
  }

  update(document: vscode.TextDocument): void {
    if (!this.isTurboJson(document)) {
      return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const turboJson = parseTurboJson(text);

    if (!turboJson) {
      // JSON parse error, VS Code's built-in JSON handles this
      this.diagnosticCollection.set(document.uri, []);
      return;
    }

    this.checkTopLevelKeys(document, text, turboJson, diagnostics);
    this.checkDeprecatedKeys(document, text, diagnostics);

    if (turboJson.tasks) {
      this.checkTasks(document, text, turboJson, diagnostics);
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  clear(uri: vscode.Uri): void {
    this.diagnosticCollection.delete(uri);
  }

  private isTurboJson(document: vscode.TextDocument): boolean {
    return document.fileName.endsWith("turbo.json");
  }

  private checkTopLevelKeys(
    document: vscode.TextDocument,
    text: string,
    turboJson: TurboJson,
    diagnostics: vscode.Diagnostic[]
  ): void {
    const keys = Object.keys(turboJson);
    for (const key of keys) {
      if (!VALID_TOP_LEVEL_KEYS.has(key)) {
        const pos = this.findKeyPosition(document, text, key);
        if (pos) {
          diagnostics.push(
            new vscode.Diagnostic(
              pos,
              `Unknown top-level key "${key}" in turbo.json.`,
              vscode.DiagnosticSeverity.Warning
            )
          );
        }
      }
    }
  }

  private checkDeprecatedKeys(
    document: vscode.TextDocument,
    text: string,
    diagnostics: vscode.Diagnostic[]
  ): void {
    const experimentalUIMatch = /"experimentalUI"\s*:/.exec(text);
    if (experimentalUIMatch) {
      const pos = document.positionAt(experimentalUIMatch.index);
      const endPos = document.positionAt(
        experimentalUIMatch.index + "experimentalUI".length + 2
      );
      const diag = new vscode.Diagnostic(
        new vscode.Range(pos, endPos),
        '"experimentalUI" is deprecated. Use "ui" instead.',
        vscode.DiagnosticSeverity.Warning
      );
      diag.tags = [vscode.DiagnosticTag.Deprecated];
      diagnostics.push(diag);
    }
  }

  private checkTasks(
    document: vscode.TextDocument,
    text: string,
    turboJson: TurboJson,
    diagnostics: vscode.Diagnostic[]
  ): void {
    const tasks = turboJson.tasks!;
    const taskNames = new Set(Object.keys(tasks));

    for (const [taskName, taskConfig] of Object.entries(tasks)) {
      this.checkTaskConfig(
        document,
        text,
        taskName,
        taskConfig,
        taskNames,
        diagnostics
      );
    }
  }

  private checkTaskConfig(
    document: vscode.TextDocument,
    text: string,
    taskName: string,
    config: TaskConfig,
    _allTasks: Set<string>,
    diagnostics: vscode.Diagnostic[]
  ): void {
    const configKeys = Object.keys(config);

    // Check for unknown task config keys
    for (const key of configKeys) {
      if (!VALID_TASK_KEYS.has(key)) {
        const pos = this.findKeyInTask(document, text, taskName, key);
        if (pos) {
          diagnostics.push(
            new vscode.Diagnostic(
              pos,
              `Unknown task configuration key "${key}".`,
              vscode.DiagnosticSeverity.Warning
            )
          );
        }
      }
    }

    // Check outputLogs value
    if (config.outputLogs && !VALID_OUTPUT_LOGS.has(config.outputLogs)) {
      const pos = this.findValueInTask(
        document,
        text,
        taskName,
        config.outputLogs
      );
      if (pos) {
        diagnostics.push(
          new vscode.Diagnostic(
            pos,
            `Invalid outputLogs value "${config.outputLogs}". Valid values: full, hash-only, new-only, errors-only, none.`,
            vscode.DiagnosticSeverity.Error
          )
        );
      }
    }

    // Check cache:true + persistent:true (invalid combo)
    if (config.cache === true && config.persistent === true) {
      const pos = this.findKeyInTask(document, text, taskName, "persistent");
      if (pos) {
        diagnostics.push(
          new vscode.Diagnostic(
            pos,
            `Task "${taskName}" has cache:true and persistent:true. Persistent tasks cannot be cached.`,
            vscode.DiagnosticSeverity.Error
          )
        );
      }
    }

    // Warn about build tasks without outputs
    if (
      taskName === "build" &&
      (!config.outputs || config.outputs.length === 0) &&
      config.cache !== false
    ) {
      const pos = this.findKeyPosition(document, text, taskName);
      if (pos) {
        diagnostics.push(
          new vscode.Diagnostic(
            pos,
            `Task "${taskName}" has caching enabled but no outputs defined. Consider adding outputs to cache build artifacts.`,
            vscode.DiagnosticSeverity.Information
          )
        );
      }
    }
  }

  private findKeyPosition(
    document: vscode.TextDocument,
    text: string,
    key: string
  ): vscode.Range | null {
    const pattern = new RegExp(`"${this.escapeRegex(key)}"\\s*:`);
    const match = pattern.exec(text);
    if (!match) return null;

    const startPos = document.positionAt(match.index);
    const endPos = document.positionAt(match.index + key.length + 2);
    return new vscode.Range(startPos, endPos);
  }

  private findKeyInTask(
    document: vscode.TextDocument,
    text: string,
    taskName: string,
    key: string
  ): vscode.Range | null {
    const taskPattern = new RegExp(
      `"${this.escapeRegex(taskName)}"\\s*:\\s*\\{`
    );
    const taskMatch = taskPattern.exec(text);
    if (!taskMatch) return null;

    const searchStart = taskMatch.index;
    const keyPattern = new RegExp(`"${this.escapeRegex(key)}"\\s*:`);
    const keyMatch = keyPattern.exec(text.substring(searchStart));
    if (!keyMatch) return null;

    const absIndex = searchStart + keyMatch.index;
    const startPos = document.positionAt(absIndex);
    const endPos = document.positionAt(absIndex + key.length + 2);
    return new vscode.Range(startPos, endPos);
  }

  private findValueInTask(
    document: vscode.TextDocument,
    text: string,
    taskName: string,
    value: string
  ): vscode.Range | null {
    const taskPattern = new RegExp(
      `"${this.escapeRegex(taskName)}"\\s*:\\s*\\{`
    );
    const taskMatch = taskPattern.exec(text);
    if (!taskMatch) return null;

    const searchStart = taskMatch.index;
    const valuePattern = new RegExp(`"${this.escapeRegex(value)}"`);
    const valueMatch = valuePattern.exec(text.substring(searchStart));
    if (!valueMatch) return null;

    const absIndex = searchStart + valueMatch.index;
    const startPos = document.positionAt(absIndex);
    const endPos = document.positionAt(absIndex + value.length + 2);
    return new vscode.Range(startPos, endPos);
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
