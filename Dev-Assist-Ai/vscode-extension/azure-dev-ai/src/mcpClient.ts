import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import * as path from "path";
import * as vscode from "vscode";

export interface AzureTask {
    id: number;
    title: string;
    state: string;
    workItemType: string;
    assignedTo: string;
    url: string;
    description: string;
    figmaLinks: string[];
    attachments: Array<{
        name: string;
        url: string;
    }>;
}

export class MCPClient {

    private client: Client | undefined;
    private transport: StdioClientTransport | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext
    ) {}

    async connect(): Promise<void> {

        const org =
            vscode.workspace
                .getConfiguration("azureDevAi")
                .get<string>("organization");

        const project =
            vscode.workspace
                .getConfiguration("azureDevAi")
                .get<string>("project");

        const team =
            vscode.workspace
                .getConfiguration("azureDevAi")
                .get<string>("team");

        if (!org || !project) {
            throw new Error(
                "Azure DevOps organization/project is not configured."
            );
        }

        const pat =
            await this.context.secrets.get(
                "azureDevAi.azureDevOpsPat"
            );

        if (!pat) {
            throw new Error(
                "Azure DevOps PAT is not configured. Run 'Azure Dev AI: Set Azure DevOps PAT'."
            );
        }

        /**
         * mcp-server is a sibling of vscode-extension.
         *
         * Current structure:
         *
         * AZURE-DEV-AI
         * ├── mcp-server
         * └── vscode-extension
         *     └── azure-dev-ai
         */
        const serverPath =
            path.resolve(
                this.context.extensionPath,
                "..",
                "..",
                "mcp-server",
                "dist",
                "server.js"
            );

        this.transport =
            new StdioClientTransport({
                command: "node",
                args: [serverPath],
                env: {
                    AZURE_DEVOPS_ORG: org,
                    AZURE_DEVOPS_PROJECT: project,
                    AZURE_DEVOPS_TEAM: team ?? "",
                    AZURE_DEVOPS_PAT: pat
                },
                stderr: "inherit"
            });

        this.client =
            new Client({
                name: "azure-dev-ai-vscode",
                version: "1.0.0"
            });

        await this.client.connect(
            this.transport
        );
    }

    async getMyActiveTasks(): Promise<AzureTask[]> {

        if (!this.client) {
            await this.connect();
        }

        const result =
            await this.client!.callTool({
                name: "get_my_active_tasks",
                arguments: {}
            });

        if (result.isError) {

            const text =
                result.content
                    ?.filter(
                        block => block.type === "text"
                    )
                    .map(
                        block =>
                            block.type === "text"
                                ? block.text
                                : ""
                    )
                    .join("\n");

            throw new Error(
                text || "MCP server returned an error."
            );
        }

        const text =
            result.content
                ?.filter(
                    block => block.type === "text"
                )
                .map(
                    block =>
                        block.type === "text"
                            ? block.text
                            : ""
                )
                .join("\n");

        if (!text) {
            return [];
        }

        return JSON.parse(text) as AzureTask[];
    }

    async getWorkItem(
        id: number
    ): Promise<AzureTask> {

        if (!this.client) {
            await this.connect();
        }

        const result =
            await this.client!.callTool({
                name: "get_work_item",
                arguments: { id }
            });

        const text =
            result.content
                ?.filter(
                    block => block.type === "text"
                )
                .map(
                    block =>
                        block.type === "text"
                            ? block.text
                            : ""
                )
                .join("\n");

        if (!text) {
            throw new Error(
                "MCP server returned no data."
            );
        }

        return JSON.parse(text) as AzureTask;
    }

    async dispose(): Promise<void> {

        try {
            await this.client?.close();
        } catch {
            // Ignore cleanup errors.
        }

        this.client = undefined;
        this.transport = undefined;
    }
}