import * as vscode from "vscode";
import {
    AzureTask,
    MCPClient
} from "./mcpClient";

export class AzureTaskProvider
    implements vscode.TreeDataProvider<AzureTaskItem> {

    private readonly _onDidChangeTreeData =
        new vscode.EventEmitter<
            AzureTaskItem | undefined | void
        >();

    readonly onDidChangeTreeData =
        this._onDidChangeTreeData.event;

    private tasks: AzureTask[] = [];

    constructor(
        private readonly mcpClient: MCPClient
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(
        element: AzureTaskItem
    ): vscode.TreeItem {

        return element;
    }

    async getChildren(
        element?: AzureTaskItem
    ): Promise<AzureTaskItem[]> {

        if (element) {
            return [];
        }

        try {

            this.tasks =
                await this.mcpClient.getMyActiveTasks();

            if (!this.tasks.length) {

                return [
                    new AzureTaskItem(
                        "No active tasks found",
                        vscode.TreeItemCollapsibleState.None
                    )
                ];
            }

            return this.tasks.map(
                task => new AzureTaskItem(
                    `#${task.id}  ${task.title}`,
                    vscode.TreeItemCollapsibleState.None,
                    task
                )
            );

        } catch (error) {

            const message =
                error instanceof Error
                    ? error.message
                    : String(error);

            vscode.window.showErrorMessage(
                `Azure Dev AI: ${message}`
            );

            return [
                new AzureTaskItem(
                    "Unable to load Azure tasks",
                    vscode.TreeItemCollapsibleState.None
                )
            ];
        }
    }
}

export class AzureTaskItem
    extends vscode.TreeItem {

    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly task?: AzureTask
    ) {

        super(
            label,
            collapsibleState
        );

        if (task) {

            this.description =
                task.state;

            this.tooltip =
                `${task.title}\n` +
                `State: ${task.state}\n` +
                `Assigned To: ${task.assignedTo}`;

            this.command = {
                command: "azureDevAi.openTask",
                title: "Open Azure DevOps Task",
                arguments: [task]
            };

            this.contextValue =
                "azureDevAiTask";

            this.iconPath =
                new vscode.ThemeIcon(
                    "checklist"
                );
        }
    }
}