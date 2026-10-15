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
exports.AzureTaskItem = exports.AzureTaskProvider = void 0;
const vscode = __importStar(require("vscode"));
class AzureTaskProvider {
    mcpClient;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    tasks = [];
    constructor(mcpClient) {
        this.mcpClient = mcpClient;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (element) {
            return [];
        }
        try {
            this.tasks =
                await this.mcpClient.getMyActiveTasks();
            if (!this.tasks.length) {
                return [
                    new AzureTaskItem("No active tasks found", vscode.TreeItemCollapsibleState.None)
                ];
            }
            return this.tasks.map(task => new AzureTaskItem(`#${task.id}  ${task.title}`, vscode.TreeItemCollapsibleState.None, task));
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : String(error);
            vscode.window.showErrorMessage(`Azure Dev AI: ${message}`);
            return [
                new AzureTaskItem("Unable to load Azure tasks", vscode.TreeItemCollapsibleState.None)
            ];
        }
    }
}
exports.AzureTaskProvider = AzureTaskProvider;
class AzureTaskItem extends vscode.TreeItem {
    task;
    constructor(label, collapsibleState, task) {
        super(label, collapsibleState);
        this.task = task;
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
                new vscode.ThemeIcon("checklist");
        }
    }
}
exports.AzureTaskItem = AzureTaskItem;
//# sourceMappingURL=taskProvider.js.map