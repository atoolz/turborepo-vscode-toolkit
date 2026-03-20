import * as vscode from "vscode";
import * as path from "path";

export const FIXTURES_PATH = path.resolve(__dirname, "../../../test-fixtures");

export async function openTurboFixture(
  filename: string
): Promise<vscode.TextDocument> {
  const uri = vscode.Uri.file(path.join(FIXTURES_PATH, filename));
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc);
  // Allow language server and providers to initialize
  await sleep(1500);
  return doc;
}

export async function createTurboDocument(
  content: string
): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument({
    language: "turbo-json",
    content,
  });
  await vscode.window.showTextDocument(doc);
  await sleep(1500);
  return doc;
}

export async function createJsonDocument(
  content: string
): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument({
    language: "json",
    content,
  });
  await vscode.window.showTextDocument(doc);
  await sleep(500);
  return doc;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Find the position of a string in a document.
 * Returns the position at the start of the match.
 */
export function findPositionOf(
  doc: vscode.TextDocument,
  search: string
): vscode.Position {
  const text = doc.getText();
  const idx = text.indexOf(search);
  if (idx === -1) {
    throw new Error(`Could not find "${search}" in document`);
  }
  return doc.positionAt(idx);
}

/**
 * Find the position in the middle of a quoted key.
 * Searches for "key" and returns position inside the quotes.
 */
export function findKeyPosition(
  doc: vscode.TextDocument,
  key: string
): vscode.Position {
  const search = `"${key}"`;
  const pos = findPositionOf(doc, search);
  // Move into the middle of the key
  return new vscode.Position(pos.line, pos.character + 1 + Math.floor(key.length / 2));
}
