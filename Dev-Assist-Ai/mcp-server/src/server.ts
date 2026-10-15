import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

function requiredEnv(name: string): string {
    const value = process.env[name];

    if(!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

interface AzureWorkItem {
    id: number;
    url: string;
    fields?: {
        "System.Title"?: string;
        "System.State"?: string;
        "System.AssignedTo"?: {
            displayName?: string;
            uniqueName?: string;
        };
        "System.Description"?: string;
        "System.WorkItemType"?: string;
    };
    relations?: Array<{
        rel?: string;
        url?: string;
        attributes?: {
            name?: string;
            resourceSize?: number;
        };
    }>;
}

interface WiqlResponse {
    workItems: Array<{
        id: number;
        url: string;
    }>;
}

/**
 * Configuration comes from environment variables.
 *
 * The VS Code extension gets the PAT from SecretStorage
 * and passes it to this MCP server process.
 */
const AZURE_ORG = requiredEnv("AZURE_ORG");
const AZURE_PROJECT = requiredEnv("AZURE_PROJECT");
const AZURE_PAT = requiredEnv("AZURE_PAT");

const AZURE_TEAM = process.env.AZURE_TEAM;

if (!AZURE_ORG) {
    throw new Error("AZURE_DEVOPS_ORG is not configured.");
}

if (!AZURE_PROJECT) {
    throw new Error("AZURE_DEVOPS_PROJECT is not configured.");
}

if (!AZURE_PAT) {
    throw new Error("AZURE_DEVOPS_PAT is not configured.");
}

const API_VERSION = "7.1";

function getAuthHeader(): string {
    const token = Buffer.from(`:${AZURE_PAT}`).toString("base64");

    return `Basic ${token}`;
}

async function azureRequest<T>(
    url: string,
    options: RequestInit = {}
): Promise<T> {

    const response = await fetch(url, {
        ...options,
        headers: {
            Authorization: getAuthHeader(),
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(options.headers ?? {})
        }
    });

    if (!response.ok) {
        const body = await response.text();

        throw new Error(
            `Azure DevOps API failed: ${response.status} ${response.statusText}\n${body}`
        );
    }

    return await response.json() as T;
}

/**
 * Get the currently active work items assigned to the current user.
 */
async function getMyActiveTasks(): Promise<AzureWorkItem[]> {

    const teamPart = AZURE_TEAM
        ? `/${encodeURIComponent(AZURE_TEAM)}`
        : "";

    const wiqlUrl =
        `https://dev.azure.com/${encodeURIComponent(AZURE_ORG)}` +
        `/${encodeURIComponent(AZURE_PROJECT)}` +
        `${teamPart}/_apis/wit/wiql?api-version=${API_VERSION}`;

    /**
     * @Me means the currently authenticated Azure DevOps user.
     *
     * We intentionally query Task work items here.
     */
    const wiql = {
        query: `
            SELECT
                [System.Id],
                [System.Title],
                [System.State],
                [System.AssignedTo],
                [System.WorkItemType]
            FROM WorkItems
            WHERE
                [System.TeamProject] = '${AZURE_PROJECT.replace(/'/g, "''")}'
                AND [System.WorkItemType] = 'Task'
                AND [System.State] = 'Active'
                AND [System.AssignedTo] = @Me
            ORDER BY [System.ChangedDate] DESC
        `
    };

    const queryResult = await azureRequest<WiqlResponse>(
        wiqlUrl,
        {
            method: "POST",
            body: JSON.stringify(wiql)
        }
    );

    if (!queryResult.workItems?.length) {
        return [];
    }

    /**
     * Azure DevOps allows bulk retrieval of work items.
     * Maximum is 200 IDs per request.
     */
    const ids = queryResult.workItems
        .map(item => item.id)
        .slice(0, 200);

    const idsString = ids.join(",");

    const workItemsUrl =
        `https://dev.azure.com/${encodeURIComponent(AZURE_ORG)}` +
        `/${encodeURIComponent(AZURE_PROJECT)}` +
        `/_apis/wit/workitems` +
        `?ids=${idsString}` +
        `&$expand=Relations` +
        `&api-version=${API_VERSION}`;

    const result = await azureRequest<{
        value: AzureWorkItem[];
    }>(workItemsUrl);

    return result.value ?? [];
}

function getAzureWorkItemUrl(id: number): string {

    return `https://dev.azure.com/` +
        `${encodeURIComponent(AZURE_ORG)}/` +
        `${encodeURIComponent(AZURE_PROJECT)}/` +
        `/_workitems/edit/${id}`;
}

function stripHtml(html: string): string {

    return html
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function extractFigmaLinks(text: string): string[] {

    const matches = text.match(
        /https?:\/\/[^\s"'<>]*figma\.com[^\s"'<>]*/gi
    );

    return [...new Set(matches ?? [])];
}

function mapWorkItem(item: AzureWorkItem) {

    const description =
        stripHtml(
            item.fields?.["System.Description"] ?? ""
        );

    const figmaLinks = extractFigmaLinks(description);

    const attachments =
        (item.relations ?? [])
            .filter(relation => relation.rel === "AttachedFile")
            .map(relation => ({
                name: relation.attributes?.name ?? "Attachment",
                url: relation.url ?? ""
            }));

    return {
        id: item.id,
        title: item.fields?.["System.Title"] ?? "",
        state: item.fields?.["System.State"] ?? "",
        workItemType: item.fields?.["System.WorkItemType"] ?? "",
        assignedTo:
            item.fields?.["System.AssignedTo"]?.displayName ??
            item.fields?.["System.AssignedTo"]?.uniqueName ??
            "",
        url: getAzureWorkItemUrl(item.id),
        description,
        figmaLinks,
        attachments
    };
}

/**
 * Create MCP server.
 */
const server = new McpServer({
    name: "azure-dev-ai",
    version: "1.0.0"
});

/**
 * MCP tool:
 *
 * get_my_active_tasks
 */
server.registerTool(
    "get_my_active_tasks",
    {
        title: "Get My Active Azure DevOps Tasks",
        description:
            "Returns active Azure DevOps Task work items assigned to the current user, including Azure DevOps links, descriptions, Figma links and attachments."
    },
    async () => {

        try {

            const tasks = await getMyActiveTasks();

            const mappedTasks = tasks.map(mapWorkItem);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(
                            mappedTasks,
                            null,
                            2
                        )
                    }
                ]
            };

        } catch (error) {

            const message =
                error instanceof Error
                    ? error.message
                    : String(error);

            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: message
                    }
                ]
            };
        }
    }
);

/**
 * MCP tool for retrieving a single work item.
 */
server.registerTool(
    "get_work_item",
    {
        title: "Get Azure DevOps Work Item",
        description:
            "Gets detailed information about one Azure DevOps work item.",
        inputSchema: z.object({
            id: z.number().int().positive()
        })
    },
    async ({ id }) => {

        try {

            const url =
                `https://dev.azure.com/` +
                `${encodeURIComponent(AZURE_ORG!)}/` +
                `${encodeURIComponent(AZURE_PROJECT!)}` +
                `/_apis/wit/workitems/${id}` +
                `?$expand=Relations` +
                `&api-version=${API_VERSION}`;

            const item =
                await azureRequest<AzureWorkItem>(url);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(
                            mapWorkItem(item),
                            null,
                            2
                        )
                    }
                ]
            };

        } catch (error) {

            const message =
                error instanceof Error
                    ? error.message
                    : String(error);

            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: message
                    }
                ]
            };
        }
    }
);

/**
 * Start MCP stdio server.
 */
const transport = new StdioServerTransport();

await server.connect(transport);