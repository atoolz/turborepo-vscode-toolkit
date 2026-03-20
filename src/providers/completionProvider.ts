import * as vscode from "vscode";
import { getTurboContext } from "../utils/turboParser";
import { topLevelKeys } from "../data/topLevel";
import { taskOptions } from "../data/taskOptions";
import {
  commonOutputPatterns,
  commonInputPatterns,
  commonDependsOn,
  commonEnvVars,
  commonTasks,
} from "../data/commonPatterns";

export class TurboCompletionProvider
  implements vscode.CompletionItemProvider
{
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _completionContext: vscode.CompletionContext
  ): vscode.CompletionItem[] | undefined {
    const ctx = getTurboContext(document, position);

    // Top-level keys
    if (ctx.isTopLevel && !ctx.isInsideTasks) {
      return this.getTopLevelCompletions(ctx.isPackageLevel);
    }

    // Inside "tasks" object but not inside a specific task config
    // This is where task names go
    if (ctx.isInsideTasks && !ctx.isInsideTaskConfig && !ctx.isInsideArray) {
      return this.getTaskNameCompletions();
    }

    // Inside a task config object (not in an array)
    if (ctx.isInsideTaskConfig && !ctx.isInsideArray) {
      return this.getTaskOptionCompletions();
    }

    // Inside an array value
    if (ctx.isInsideArray && ctx.arrayKey) {
      return this.getArrayValueCompletions(ctx.arrayKey);
    }

    return undefined;
  }

  private getTopLevelCompletions(
    isPackageLevel: boolean
  ): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    for (const key of topLevelKeys) {
      if (key.deprecated) continue;
      // Show "extends" only for package-level
      if (key.key === "extends" && !isPackageLevel) continue;

      const item = new vscode.CompletionItem(
        key.key,
        vscode.CompletionItemKind.Property
      );
      item.detail = key.type;
      item.documentation = new vscode.MarkdownString(
        `${key.description}\n\n[Documentation](${key.docsUrl})`
      );

      if (key.key === "$schema") {
        item.insertText = new vscode.SnippetString(
          '"\\$schema": "https://turbo.build/schema.json"'
        );
      } else if (key.key === "tasks") {
        item.insertText = new vscode.SnippetString(
          '"tasks": {\n\t"$1": {\n\t\t$0\n\t}\n}'
        );
      } else if (key.key === "extends") {
        item.insertText = new vscode.SnippetString('"extends": ["//"]');
      } else if (key.values) {
        const choices = key.values.join(",");
        item.insertText = new vscode.SnippetString(
          `"${key.key}": "\${1|${choices}|}"`
        );
      } else if (key.type === "string[]") {
        item.insertText = new vscode.SnippetString(
          `"${key.key}": ["$1"]`
        );
      } else if (key.type === "object") {
        item.insertText = new vscode.SnippetString(
          `"${key.key}": {\n\t$0\n}`
        );
      } else if (key.type === "boolean") {
        item.insertText = new vscode.SnippetString(
          `"${key.key}": \${1|true,false|}`
        );
      } else {
        item.insertText = new vscode.SnippetString(
          `"${key.key}": "$1"`
        );
      }

      items.push(item);
    }

    return items;
  }

  private getTaskNameCompletions(): vscode.CompletionItem[] {
    return commonTasks.map((task) => {
      const item = new vscode.CompletionItem(
        task,
        vscode.CompletionItemKind.Field
      );
      item.detail = "Task name";
      item.insertText = new vscode.SnippetString(
        `"${task}": {\n\t$0\n}`
      );
      return item;
    });
  }

  private getTaskOptionCompletions(): vscode.CompletionItem[] {
    return taskOptions.map((opt) => {
      const item = new vscode.CompletionItem(
        opt.key,
        vscode.CompletionItemKind.Property
      );
      item.detail = opt.type;
      item.documentation = new vscode.MarkdownString(
        `${opt.description}\n\n[Documentation](${opt.docsUrl})`
      );

      if (opt.values) {
        const choices = opt.values.join(",");
        item.insertText = new vscode.SnippetString(
          `"${opt.key}": "\${1|${choices}|}"`
        );
      } else if (opt.type === "string[]") {
        item.insertText = new vscode.SnippetString(
          `"${opt.key}": ["$1"]`
        );
      } else if (opt.type === "boolean") {
        item.insertText = new vscode.SnippetString(
          `"${opt.key}": \${1|true,false|}`
        );
      }

      return item;
    });
  }

  private getArrayValueCompletions(
    arrayKey: string
  ): vscode.CompletionItem[] {
    switch (arrayKey) {
      case "dependsOn":
        return this.getDependsOnCompletions();
      case "inputs":
        return this.getInputCompletions();
      case "outputs":
        return this.getOutputCompletions();
      case "env":
      case "passThroughEnv":
      case "globalEnv":
      case "globalPassThroughEnv":
        return this.getEnvCompletions();
      case "globalDependencies":
        return this.getInputCompletions();
      default:
        return [];
    }
  }

  private getDependsOnCompletions(): vscode.CompletionItem[] {
    return commonDependsOn.map((dep) => {
      const item = new vscode.CompletionItem(
        dep.pattern,
        vscode.CompletionItemKind.Reference
      );
      item.detail = dep.description;
      item.insertText = `"${dep.pattern}"`;
      return item;
    });
  }

  private getInputCompletions(): vscode.CompletionItem[] {
    return commonInputPatterns.map((p) => {
      const item = new vscode.CompletionItem(
        p.pattern,
        vscode.CompletionItemKind.File
      );
      item.detail = p.description;
      item.insertText = `"${p.pattern}"`;
      return item;
    });
  }

  private getOutputCompletions(): vscode.CompletionItem[] {
    return commonOutputPatterns.map((p) => {
      const item = new vscode.CompletionItem(
        p.pattern,
        vscode.CompletionItemKind.File
      );
      item.detail = p.description;
      item.insertText = `"${p.pattern}"`;
      return item;
    });
  }

  private getEnvCompletions(): vscode.CompletionItem[] {
    return commonEnvVars.map((env) => {
      const item = new vscode.CompletionItem(
        env,
        vscode.CompletionItemKind.Variable
      );
      item.insertText = `"${env}"`;
      return item;
    });
  }
}
