import * as assert from "assert";
import * as vscode from "vscode";
import { TaskTreeProvider } from "../../providers/taskTreeProvider";
import { sleep } from "./helper";

suite("Task Explorer (TreeView)", () => {
  test("TaskTreeProvider can be instantiated and has required methods", () => {
    const provider = new TaskTreeProvider();
    assert.ok(provider, "TaskTreeProvider should be instantiable");
    assert.ok(
      typeof provider.getChildren === "function",
      "Should have getChildren method"
    );
    assert.ok(
      typeof provider.getTreeItem === "function",
      "Should have getTreeItem method"
    );
    assert.ok(
      typeof provider.refresh === "function",
      "Should have refresh method"
    );
  });

  test("should return tree items for tasks defined in turbo.json", async () => {
    // Wait for extension activation
    await sleep(2000);

    const provider = new TaskTreeProvider();
    const children = await provider.getChildren();

    // The test-fixtures workspace has turbo.json with 7 tasks
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0
    ) {
      assert.ok(
        children.length > 0,
        `Should return tree items for tasks, got ${children.length}`
      );

      // Check that we get expected task names
      const labels = children.map((item: vscode.TreeItem) =>
        typeof item.label === "string" ? item.label : ""
      );
      assert.ok(labels.includes("build"), 'Should include "build" task');
      assert.ok(labels.includes("dev"), 'Should include "dev" task');
      assert.ok(labels.includes("test"), 'Should include "test" task');
    } else {
      // If no workspace folder, just verify it returns an array
      assert.ok(Array.isArray(children), "Should return an array");
    }
  });
});
