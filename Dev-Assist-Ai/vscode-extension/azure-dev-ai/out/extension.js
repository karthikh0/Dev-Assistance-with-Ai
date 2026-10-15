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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const mcpClient_1 = require("./mcpClient");
const taskProvider_1 = require("./taskProvider");
let mcpClient;
async function activate(context) {
    console.log("Azure Dev AI extension activated.");
    mcpClient =
        new mcpClient_1.MCPClient(context);
    /**
     * Set Azure DevOps PAT.
     */
    context.subscriptions.push(vscode.commands.registerCommand("azureDevAi.setPat", async () => {
        const pat = await vscode.window.showInputBox({
            prompt: "Enter your Azure DevOps Personal Access Token",
            password: true,
            ignoreFocusOut: true,
            placeHolder: "Azure DevOps PAT"
        });
        if (!pat) {
            return;
        }
        await context.secrets.store("azureDevAi.azureDevOpsPat", pat);
        vscode.window.showInformationMessage("Azure DevOps PAT saved securely.");
    }));
    /**
     * Test MCP connection.
     */
    context.subscriptions.push(vscode.commands.registerCommand("azureDevAi.testConnection", async () => {
        try {
            if (!mcpClient) {
                throw new Error("MCP client is not initialized.");
            }
            await mcpClient.connect();
            vscode.window.showInformationMessage("Azure Dev AI MCP connection successful.");
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : String(error);
            vscode.window.showErrorMessage(`MCP connection failed: ${message}`);
        }
    }));
    /**
     * Create task provider.
     */
    const taskProvider = new taskProvider_1.AzureTaskProvider(mcpClient);
    context.subscriptions.push(vscode.window.registerTreeDataProvider("myAzureTasks", taskProvider));
    /**
     * Refresh tasks.
     */
    context.subscriptions.push(vscode.commands.registerCommand("azureDevAi.refreshTasks", () => {
        taskProvider.refresh();
    }));
    /**
     * Open Azure DevOps task.
     */
    context.subscriptions.push(vscode.commands.registerCommand("azureDevAi.openTask", async (task) => {
        if (!task?.url) {
            return;
        }
        await vscode.env.openExternal(vscode.Uri.parse(task.url));
    }));
    /**
     * Set Azure PAT on first activation.
     */
    const existingPat = await context.secrets.get("azureDevAi.azureDevOpsPat");
    if (!existingPat) {
        vscode.window.showInformationMessage("Azure Dev AI: Configure your Azure DevOps PAT.", "Set PAT").then(selection => {
            if (selection === "Set PAT") {
                vscode.commands.executeCommand("azureDevAi.setPat");
            }
        });
    }
}
async function deactivate() {
    if (mcpClient) {
        await mcpClient.dispose();
    }
    mcpClient = undefined;
}
//# sourceMappingURL=extension.js.map