import * as vscode from "vscode";
import * as path from "path";

import {
    MCPClient
} from "./mcpClient";

import {
    AzureTaskProvider
} from "./taskProvider";

let mcpClient: MCPClient | undefined;

export async function activate(
    context: vscode.ExtensionContext
) {

    console.log(
        "Azure Dev AI extension activated."
    );

    mcpClient =
        new MCPClient(context);

    /**
     * Set Azure DevOps PAT.
     */
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "azureDevAi.setPat",
            async () => {

                const pat =
                    await vscode.window.showInputBox({
                        prompt:
                            "Enter your Azure DevOps Personal Access Token",
                        password: true,
                        ignoreFocusOut: true,
                        placeHolder:
                            "Azure DevOps PAT"
                    });

                if (!pat) {
                    return;
                }

                await context.secrets.store(
                    "azureDevAi.azureDevOpsPat",
                    pat
                );

                vscode.window.showInformationMessage(
                    "Azure DevOps PAT saved securely."
                );
            }
        )
    );

    /**
     * Test MCP connection.
     */
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "azureDevAi.testConnection",
            async () => {

                try {

                    if (!mcpClient) {
                        throw new Error(
                            "MCP client is not initialized."
                        );
                    }

                    await mcpClient.connect();

                    vscode.window.showInformationMessage(
                        "Azure Dev AI MCP connection successful."
                    );

                } catch (error) {

                    const message =
                        error instanceof Error
                            ? error.message
                            : String(error);

                    vscode.window.showErrorMessage(
                        `MCP connection failed: ${message}`
                    );
                }
            }
        )
    );

    /**
     * Create task provider.
     */
    const taskProvider =
        new AzureTaskProvider(
            mcpClient
        );

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            "myAzureTasks",
            taskProvider
        )
    );

    /**
     * Refresh tasks.
     */
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "azureDevAi.refreshTasks",
            () => {
                taskProvider.refresh();
            }
        )
    );

    /**
     * Open Azure DevOps task.
     */
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "azureDevAi.openTask",
            async (task) => {

                if (!task?.url) {
                    return;
                }

                await vscode.env.openExternal(
                    vscode.Uri.parse(task.url)
                );
            }
        )
    );

    /**
     * Set Azure PAT on first activation.
     */
    const existingPat =
        await context.secrets.get(
            "azureDevAi.azureDevOpsPat"
        );

    if (!existingPat) {

        vscode.window.showInformationMessage(
            "Azure Dev AI: Configure your Azure DevOps PAT.",
            "Set PAT"
        ).then(selection => {

            if (selection === "Set PAT") {

                vscode.commands.executeCommand(
                    "azureDevAi.setPat"
                );
            }
        });
    }
}

export async function deactivate() {

    if (mcpClient) {
        await mcpClient.dispose();
    }

    mcpClient = undefined;
}