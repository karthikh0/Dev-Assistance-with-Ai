"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPClient = void 0;
const client_1 = require("@modelcontextprotocol/client");
const stdio_1 = require("@modelcontextprotocol/client/stdio");
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
class MCPClient {
    context;
    client;
    transport;
    constructor(context) {
        this.context = context;
    }
    async connect() {
        const org = vscode.workspace
            .getConfiguration("azureDevAi")
            .get("organization");
        const project = vscode.workspace
            .getConfiguration("azureDevAi")
            .get("project");
        const team = vscode.workspace
            .getConfiguration("azureDevAi")
            .get("team");
        if (!org || !project) {
            throw new Error("Azure DevOps organization/project is not configured.");
        }
        const pat = await this.context.secrets.get("azureDevAi.azureDevOpsPat");
        if (!pat) {
            throw new Error("Azure DevOps PAT is not configured. Run 'Azure Dev AI: Set Azure DevOps PAT'.");
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
        const serverPath = path.resolve(this.context.extensionPath, "..", "..", "mcp-server", "dist", "server.js");
        this.transport =
            new stdio_1.StdioClientTransport({
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
            new client_1.Client({
                name: "azure-dev-ai-vscode",
                version: "1.0.0"
            });
        await this.client.connect(this.transport);
    }
    async getMyActiveTasks() {
        if (!this.client) {
            await this.connect();
        }
        const result = await this.client.callTool({
            name: "get_my_active_tasks",
            arguments: {}
        });
        if (result.isError) {
            const text = result.content
                ?.filter(block => block.type === "text")
                .map(block => block.type === "text"
                ? block.text
                : "")
                .join("\n");
            throw new Error(text || "MCP server returned an error.");
        }
        const text = result.content
            ?.filter(block => block.type === "text")
            .map(block => block.type === "text"
            ? block.text
            : "")
            .join("\n");
        if (!text) {
            return [];
        }
        return JSON.parse(text);
    }
    async getWorkItem(id) {
        if (!this.client) {
            await this.connect();
        }
        const result = await this.client.callTool({
            name: "get_work_item",
            arguments: { id }
        });
        const text = result.content
            ?.filter(block => block.type === "text")
            .map(block => block.type === "text"
            ? block.text
            : "")
            .join("\n");
        if (!text) {
            throw new Error("MCP server returned no data.");
        }
        return JSON.parse(text);
    }
    async dispose() {
        try {
            await this.client?.close();
        }
        catch {
            // Ignore cleanup errors.
        }
        this.client = undefined;
        this.transport = undefined;
    }
}
exports.MCPClient = MCPClient;
//# sourceMappingURL=mcpClient.js.map