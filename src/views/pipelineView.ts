import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { parseTurboJson, TaskConfig } from "../utils/turboParser";

interface TaskNode {
  name: string;
  config: TaskConfig;
  x: number;
  y: number;
  level: number;
}

interface TaskEdge {
  from: string;
  to: string;
  isTopological: boolean;
}

export class PipelineViewProvider {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  async show(): Promise<void> {
    const turboJson = await this.readTurboJson();
    if (!turboJson || !turboJson.tasks) {
      vscode.window.showWarningMessage("No turbo.json found in workspace root.");
      return;
    }

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        "turboPipeline",
        "Turborepo Pipeline",
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
    }

    const { nodes, edges } = this.buildGraph(turboJson.tasks);
    this.panel.webview.html = this.getHtml(nodes, edges);

    this.panel.webview.onDidReceiveMessage((message) => {
      if (message.command === "navigateToTask") {
        this.navigateToTask(message.taskName);
      }
    });
  }

  private buildGraph(
    tasks: Record<string, TaskConfig>
  ): { nodes: TaskNode[]; edges: TaskEdge[] } {
    const taskNames = Object.keys(tasks);
    const edges: TaskEdge[] = [];

    // Build edges
    for (const [taskName, config] of Object.entries(tasks)) {
      if (config.dependsOn) {
        for (const dep of config.dependsOn) {
          const isTopological = dep.startsWith("^");
          const cleanDep = dep.replace(/^\^/, "").replace(/^\$/, "");
          // Only include edges to tasks that exist in this config
          if (taskNames.includes(cleanDep)) {
            edges.push({
              from: cleanDep,
              to: taskName,
              isTopological,
            });
          }
        }
      }
    }

    // Topological sort to assign levels
    const levels = this.assignLevels(taskNames, edges);

    // Position nodes
    const levelGroups: Map<number, string[]> = new Map();
    for (const [name, level] of Object.entries(levels)) {
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(name);
    }

    const nodeWidth = 160;
    const nodeHeight = 60;
    const horizontalGap = 60;
    const verticalGap = 40;

    const nodes: TaskNode[] = [];
    for (const [level, names] of levelGroups) {
      const totalWidth =
        names.length * nodeWidth + (names.length - 1) * horizontalGap;
      const startX = -totalWidth / 2 + nodeWidth / 2;

      names.forEach((name, index) => {
        nodes.push({
          name,
          config: tasks[name],
          x: startX + index * (nodeWidth + horizontalGap),
          y: level * (nodeHeight + verticalGap),
          level,
        });
      });
    }

    return { nodes, edges };
  }

  private assignLevels(
    taskNames: string[],
    edges: TaskEdge[]
  ): Record<string, number> {
    const inDegree: Record<string, number> = {};
    const adjacency: Record<string, string[]> = {};

    for (const name of taskNames) {
      inDegree[name] = 0;
      adjacency[name] = [];
    }

    for (const edge of edges) {
      if (inDegree[edge.to] !== undefined) {
        inDegree[edge.to]++;
      }
      if (adjacency[edge.from]) {
        adjacency[edge.from].push(edge.to);
      }
    }

    // BFS topological sort
    const levels: Record<string, number> = {};
    const queue: string[] = [];

    for (const name of taskNames) {
      if (inDegree[name] === 0) {
        queue.push(name);
        levels[name] = 0;
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const next of adjacency[current] || []) {
        inDegree[next]--;
        const newLevel = (levels[current] || 0) + 1;
        levels[next] = Math.max(levels[next] || 0, newLevel);
        if (inDegree[next] === 0) {
          queue.push(next);
        }
      }
    }

    // Assign level 0 to any remaining (cycles or isolated)
    for (const name of taskNames) {
      if (levels[name] === undefined) {
        levels[name] = 0;
      }
    }

    return levels;
  }

  private getHtml(nodes: TaskNode[], edges: TaskEdge[]): string {
    const padding = 100;
    const nodeWidth = 160;
    const nodeHeight = 54;

    // Calculate SVG dimensions
    let minX = 0,
      maxX = 0,
      maxY = 0;
    for (const node of nodes) {
      minX = Math.min(minX, node.x - nodeWidth / 2);
      maxX = Math.max(maxX, node.x + nodeWidth / 2);
      maxY = Math.max(maxY, node.y + nodeHeight);
    }

    const svgWidth = maxX - minX + padding * 2;
    const svgHeight = maxY + padding * 2;
    const offsetX = -minX + padding;
    const offsetY = padding;

    const nodeMap = new Map(nodes.map((n) => [n.name, n]));

    let edgeSvg = "";
    for (const edge of edges) {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      if (!from || !to) continue;

      const x1 = from.x + offsetX;
      const y1 = from.y + offsetY + nodeHeight;
      const x2 = to.x + offsetX;
      const y2 = to.y + offsetY;
      const midY = (y1 + y2) / 2;

      const dashArray = edge.isTopological ? "6,3" : "none";
      const color = edge.isTopological ? "#94a3b8" : "#64748b";

      edgeSvg += `<path d="M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}"
        fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="${dashArray}"
        marker-end="url(#arrowhead)"/>`;
    }

    let nodeSvg = "";
    for (const node of nodes) {
      const x = node.x + offsetX - nodeWidth / 2;
      const y = node.y + offsetY;
      const cached = node.config.cache !== false;
      const persistent = node.config.persistent === true;

      let fillColor = "#1e293b";
      let borderColor = "#3b82f6";
      if (persistent) {
        fillColor = "#1e1b2e";
        borderColor = "#a855f7";
      } else if (!cached) {
        fillColor = "#1e2a1e";
        borderColor = "#22c55e";
      }

      const statusLabel = persistent
        ? "persistent"
        : cached
          ? "cached"
          : "no-cache";
      const statusColor = persistent
        ? "#a855f7"
        : cached
          ? "#3b82f6"
          : "#22c55e";

      nodeSvg += `
        <g class="node" data-task="${node.name}" style="cursor:pointer">
          <rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="8" ry="8"
            fill="${fillColor}" stroke="${borderColor}" stroke-width="2"/>
          <text x="${x + nodeWidth / 2}" y="${y + 22}" text-anchor="middle"
            fill="white" font-size="14" font-weight="600" font-family="system-ui, sans-serif">${node.name}</text>
          <text x="${x + nodeWidth / 2}" y="${y + 40}" text-anchor="middle"
            fill="${statusColor}" font-size="10" font-family="system-ui, sans-serif">${statusLabel}</text>
        </g>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #0f172a;
      overflow: auto;
      font-family: system-ui, sans-serif;
    }
    .header {
      padding: 16px 24px;
      background: #1e293b;
      border-bottom: 1px solid #334155;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header h1 {
      margin: 0;
      color: #f1f5f9;
      font-size: 16px;
      font-weight: 600;
    }
    .legend {
      display: flex;
      gap: 16px;
      margin-left: auto;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #94a3b8;
      font-size: 12px;
    }
    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    svg {
      display: block;
      margin: 20px auto;
    }
    .node:hover rect {
      stroke-width: 3;
      filter: brightness(1.2);
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Pipeline Visualization</h1>
    <div class="legend">
      <div class="legend-item">
        <div class="legend-dot" style="background:#3b82f6"></div>
        Cached
      </div>
      <div class="legend-item">
        <div class="legend-dot" style="background:#22c55e"></div>
        No Cache
      </div>
      <div class="legend-item">
        <div class="legend-dot" style="background:#a855f7"></div>
        Persistent
      </div>
      <div class="legend-item">
        <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke="#64748b" stroke-width="2"/></svg>
        Direct
      </div>
      <div class="legend-item">
        <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4,2"/></svg>
        Topological
      </div>
    </div>
  </div>
  <svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#64748b"/>
      </marker>
    </defs>
    ${edgeSvg}
    ${nodeSvg}
  </svg>
  <script>
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('.node').forEach(node => {
      node.addEventListener('click', () => {
        const taskName = node.getAttribute('data-task');
        vscode.postMessage({ command: 'navigateToTask', taskName });
      });
    });
  </script>
</body>
</html>`;
  }

  private async navigateToTask(taskName: string): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;

    const turboJsonPath = path.join(workspaceRoot, "turbo.json");
    try {
      const doc = await vscode.workspace.openTextDocument(turboJsonPath);
      const editor = await vscode.window.showTextDocument(
        doc,
        vscode.ViewColumn.One
      );
      const text = doc.getText();
      const escapedName = taskName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`"${escapedName}"\\s*:\\s*\\{`);
      const match = pattern.exec(text);
      if (match) {
        const pos = doc.positionAt(match.index);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(
          new vscode.Range(pos, pos),
          vscode.TextEditorRevealType.InCenter
        );
      }
    } catch {
      // File not found
    }
  }

  private async readTurboJson(): Promise<{
    tasks?: Record<string, TaskConfig>;
  } | null> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return null;

    const turboJsonPath = path.join(workspaceRoot, "turbo.json");
    try {
      const content = await fs.promises.readFile(turboJsonPath, "utf-8");
      return parseTurboJson(content);
    } catch {
      return null;
    }
  }
}
