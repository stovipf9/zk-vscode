import * as vscode from "vscode";

// Results of JSON.parse
interface ZkNoteDatum {
  title: string;
  absPath: string;
  metadata: { aliases: string[] | string };
  modified: string;
  body: string;
}

export class ZkNote {
  public title: string;
  public uri: vscode.Uri;
  public modifiedDate: Date;
  public body: string;

  constructor(
    title: string,
    uri: vscode.Uri,
    modifiedDate: Date,
    body: string
  ) {
    this.title = title;
    this.uri = uri;
    this.modifiedDate = modifiedDate;
    this.body = body;
  }

  toTreeItem(): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(this.title);
    treeItem.resourceUri = this.uri;
    treeItem.command = {
      command: "vscode.open",
      title: `${this.title} is opened`,
      arguments: [this.uri],
    };
    return treeItem;
  }

  toQuickPickItem(): vscode.QuickPickItem & { uri: vscode.Uri } {
    return {
      label: this.title,
      kind: vscode.QuickPickItemKind.Default,
      description: vscode.workspace.asRelativePath(this.uri),
      detail: this.body,
      picked: false,
      alwaysShow: false,
      uri: this.uri,
    };
  }
}

type ZkNotesOption = (_: ZkNotes) => void;

export class ZkNotes {
  // Path to zk root directory
  private static rootPath: string | undefined;
  notes: ZkNote[] = [];

  constructor(...options: ZkNotesOption[]) {
    for (const option of options) {
      option(this);
    }
  }

  public static withRootPath(rootPath: string): ZkNotesOption {
    return (z: ZkNotes) => {
      ZkNotes.rootPath = rootPath;
    };
  }

  public static async withNotes(): Promise<ZkNotesOption> {
    const zkNotes = await ZkNotes.retrieveNotes();
    return (z: ZkNotes) => {
      z.notes = zkNotes;
    };
  }

  public static async retrieveNotes(): Promise<ZkNote[]> {
    // Check if the root path is not set and set it from the workspace if available
    if (ZkNotes.rootPath === undefined) {
      ZkNotes.rootPath =
        vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length > 0
          ? vscode.workspace.workspaceFolders[0].uri.fsPath
          : undefined;
    }
    // Parse stdout from the command "zk list" into list of TreeItems
    try {
      const stdout = await ZkNotes.executeCommand(
        `zk list -W ${this.rootPath} -P -f json`
      );
      const notes = await JSON.parse(stdout)
        .filter((datum: ZkNoteDatum) => datum.title !== "")
        .flatMap((datum: ZkNoteDatum) => {
          const aliases = datum.metadata.aliases;
          return [
            // Item from title
            new ZkNote(
              datum.title,
              vscode.Uri.file(datum.absPath),
              new Date(datum.modified),
              datum.body
            ),
            // Items from aliases
            ...(Array.isArray(aliases)
              ? aliases
              : typeof aliases === "string"
              ? aliases.split(",").map((alias: string) => alias.trim())
              : []
            ).map(
              (alias: string): ZkNote =>
                new ZkNote(
                  alias,
                  vscode.Uri.file(datum.absPath),
                  new Date(datum.modified),
                  datum.body
                )
            ),
          ];
        });
      // Sort notes based on modified date (descending)
      return notes.sort((note1: ZkNote, note2: ZkNote) => {
        return note2.modifiedDate.getTime() - note1.modifiedDate.getTime();
      });
    } catch (error) {
      const errStr =
        error instanceof Error
          ? `Error executing command: ${error.message}`
          : "Error executing command";
      vscode.window.showErrorMessage(errStr);
      throw error;
    }
  }

  private static async executeCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      require("child_process").exec(
        command,
        (error: Error | null, stdout: string, stderr: string) => {
          if (error) {
            reject(error);
          } else {
            resolve(stdout);
          }
        }
      );
    });
  }

  toTreeItems(): vscode.TreeItem[] {
    return this.notes.map((zkNote: ZkNote) => zkNote.toTreeItem());
  }

  toQuickPickItems(): (vscode.QuickPickItem & { uri: vscode.Uri })[] {
    return this.notes.map((zkNote: ZkNote) => zkNote.toQuickPickItem());
  }

  randomNote(): ZkNote {
    return this.notes[Math.floor(Math.random() * this.notes.length)];
  }
}
