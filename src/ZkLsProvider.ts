import * as vscode from 'vscode';

interface Note {
    title: string;
    absPath: string;
    metadata: { aliases: string[] | string; };
}

export class ZkLsProvider implements vscode.TreeDataProvider<ZkLsItem> {
    // path to zk root directory
    rootPath = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;

    private _onDidChangeTreeData: vscode.EventEmitter<ZkLsItem | undefined> = new vscode.EventEmitter<ZkLsItem | undefined>();
    readonly onDidChangeTreeData?: vscode.Event<void | ZkLsItem | ZkLsItem[] | null | undefined> | undefined = this._onDidChangeTreeData.event;

    constructor() {
        vscode.commands.registerCommand(
            'zkls.treeview.item_clicked',
            (item: ZkLsItem) => this.itemClicked(item));
        vscode.commands.registerCommand(
            'zkls.treeview.refresh',
            () => this.refresh());
    }

    itemClicked(item: ZkLsItem) {
        item.open();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: ZkLsItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        element.command = {
            command: 'zkls.treeview.item_clicked',
            title: `${element.label} was clicked`,
            arguments: [element]
        };
        return element;
    }

    async getChildren(element?: ZkLsItem | undefined): Promise<ZkLsItem[]> {
        return this.createList();
    }

    private async createList(): Promise<ZkLsItem[]> {
        // parse stdout from the command "zk list" into list of TreeItems
        try {
            const stdout = await this.executeCommand(`zk list -W ${this.rootPath} -P -f json`);
            return JSON.parse(stdout)
                .filter((datum: Note) => datum.title !== "")
                .flatMap((datum: Note) => {
                    const _aliases = datum.metadata.aliases;
                    return [
                        // item from title
                        new ZkLsItem(datum.title, vscode.Uri.file(datum.absPath)),
                        // items from aliases
                        ...(Array.isArray(_aliases)
                            ? _aliases
                            : (typeof _aliases === "string"
                                ? _aliases.split(',').map((alias: string) => alias.trim())
                                : [])
                        ).map((alias: string) => new ZkLsItem(alias, vscode.Uri.file(datum.absPath)))
                    ];
                });
        } catch (error) {
            const errStr = error instanceof Error
                ? `Error executing command: ${error.message}`
                : "Error executing command";
            vscode.window.showErrorMessage(errStr);
            throw error;
        }
    }

    private async executeCommand(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            require('child_process').exec(command, (error: Error | null, stdout: string, stderr: string) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
    }
}

class ZkLsItem extends vscode.TreeItem {
    constructor(
        label: string,
        resourceUri: vscode.Uri
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.resourceUri = resourceUri;
    };

    open() {
        if (this.resourceUri === undefined) { return; }
        vscode.workspace.openTextDocument(this.resourceUri).then((document: vscode.TextDocument) => {
            vscode.window.showTextDocument(document);
        });
    }
}
