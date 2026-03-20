import * as vscode from "vscode";
import { getTopLevelKey } from "../data/topLevel";
import { getTaskOption } from "../data/taskOptions";

export class TurboHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.Hover | undefined {
    const range = document.getWordRangeAtPosition(position, /"[^"]*"/);
    if (!range) {
      return undefined;
    }

    const word = document.getText(range).replace(/"/g, "");

    // Check for special values first
    const specialHover = this.getSpecialValueHover(word);
    if (specialHover) {
      return new vscode.Hover(specialHover, range);
    }

    // Check if this is a key (followed by ":")
    const lineText = document.lineAt(position.line).text;
    const afterWord = lineText.substring(range.end.character);
    const isKey = /^\s*:/.test(afterWord);

    if (!isKey) {
      // It might be a value, check for glob pattern
      const globHover = this.getGlobHover(word);
      if (globHover) {
        return new vscode.Hover(globHover, range);
      }
      return undefined;
    }

    // Check top-level keys
    const topLevel = getTopLevelKey(word);
    if (topLevel) {
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`**${topLevel.key}**\n\n`);
      md.appendMarkdown(`Type: \`${topLevel.type}\`\n\n`);
      md.appendMarkdown(`${topLevel.description}\n\n`);
      if (topLevel.defaultValue) {
        md.appendMarkdown(`Default: \`${topLevel.defaultValue}\`\n\n`);
      }
      if (topLevel.deprecated) {
        md.appendMarkdown(
          `**Deprecated:** ${topLevel.deprecatedMessage}\n\n`
        );
      }
      md.appendMarkdown(`[Documentation](${topLevel.docsUrl})`);
      return new vscode.Hover(md, range);
    }

    // Check task option keys
    const taskOpt = getTaskOption(word);
    if (taskOpt) {
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`**${taskOpt.key}**\n\n`);
      md.appendMarkdown(`Type: \`${taskOpt.type}\`\n\n`);
      md.appendMarkdown(`${taskOpt.description}\n\n`);
      if (taskOpt.defaultValue) {
        md.appendMarkdown(`Default: \`${taskOpt.defaultValue}\`\n\n`);
      }
      md.appendMarkdown(`[Documentation](${taskOpt.docsUrl})`);
      return new vscode.Hover(md, range);
    }

    return undefined;
  }

  private getSpecialValueHover(
    value: string
  ): vscode.MarkdownString | undefined {
    if (value === "$TURBO_DEFAULT$") {
      const md = new vscode.MarkdownString();
      md.appendMarkdown("**$TURBO_DEFAULT$**\n\n");
      md.appendMarkdown(
        "Expands to the default set of inputs for a task:\n\n"
      );
      md.appendMarkdown(
        "- All files tracked by git in the package directory\n"
      );
      md.appendMarkdown("- Excludes outputs from other tasks\n");
      md.appendMarkdown("- Excludes files matched by `.gitignore`\n\n");
      md.appendMarkdown(
        "Use this as a base and add additional patterns:\n"
      );
      md.appendMarkdown(
        '```json\n"inputs": ["$TURBO_DEFAULT$", ".env*"]\n```\n\n'
      );
      md.appendMarkdown(
        "[Documentation](https://turbo.build/repo/docs/reference/configuration#inputs)"
      );
      return md;
    }

    if (value.startsWith("^")) {
      const taskName = value.slice(1);
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`**Topological Dependency: ^${taskName}**\n\n`);
      md.appendMarkdown(
        `Run the \`${taskName}\` task in all **upstream packages** (dependencies in package.json) before running this task.\n\n`
      );
      md.appendMarkdown(
        "This ensures that dependencies are built before dependents.\n\n"
      );
      md.appendMarkdown(
        "[Documentation](https://turbo.build/repo/docs/reference/configuration#dependson)"
      );
      return md;
    }

    if (value === "//") {
      const md = new vscode.MarkdownString();
      md.appendMarkdown("**Root Workspace**\n\n");
      md.appendMarkdown(
        'Used in `extends` to inherit configuration from the root `turbo.json`.\n\n'
      );
      md.appendMarkdown(
        '```json\n"extends": ["//"]  // Extends root turbo.json\n```\n\n'
      );
      md.appendMarkdown(
        "[Documentation](https://turbo.build/repo/docs/reference/configuration#extends)"
      );
      return md;
    }

    if (value.includes("#")) {
      const [pkg, task] = value.split("#");
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`**Package-specific Dependency**\n\n`);
      md.appendMarkdown(
        `Run the \`${task}\` task in the \`${pkg}\` package before running this task.\n\n`
      );
      md.appendMarkdown(
        "[Documentation](https://turbo.build/repo/docs/reference/configuration#dependson)"
      );
      return md;
    }

    return undefined;
  }

  private getGlobHover(value: string): vscode.MarkdownString | undefined {
    if (!value.includes("*") && !value.startsWith("!")) {
      return undefined;
    }

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**Glob Pattern: \`${value}\`**\n\n`);

    if (value.startsWith("!")) {
      md.appendMarkdown(
        `**Negation pattern.** Excludes files matching \`${value.slice(1)}\`.\n\n`
      );
    }

    if (value.includes("**")) {
      md.appendMarkdown("`**` matches any number of directories.\n\n");
    }

    if (value.includes("*") && !value.includes("**")) {
      md.appendMarkdown("`*` matches any number of characters (except `/`).\n\n");
    }

    return md;
  }
}
