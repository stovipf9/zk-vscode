import * as vscode from "vscode";
import { ZkNotes } from "./ZkNotes";

export class ZkListProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private zkNotes: ZkNotes;

  private _onDidChangeTreeDate: vscode.EventEmitter<
    vscode.TreeItem | undefined
  > = new vscode.EventEmitter<vscode.TreeItem | undefined>();
  readonly onDidChangeTreeData?:
    | vscode.Event<
        void | vscode.TreeItem | vscode.TreeItem[] | null | undefined
      >
    | undefined = this._onDidChangeTreeDate.event;

  constructor(zkNotes: ZkNotes) {
    vscode.commands.registerCommand("zkls.treeview.refresh", () =>
      this.refresh()
    );
    this.zkNotes = zkNotes;
  }

  async refresh() {
    this.zkNotes.notes = await ZkNotes.retrieveNotes();
    this._onDidChangeTreeDate.fire(undefined);
  }

  getTreeItem(
    element: vscode.TreeItem
  ): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(
    element?: vscode.TreeItem | undefined
  ): vscode.ProviderResult<vscode.TreeItem[]> {
    return this.zkNotes.toTreeItems();
  }
}
