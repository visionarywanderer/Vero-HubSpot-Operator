import { authManager } from "@/lib/auth-manager";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: object;
}

export interface McpResult {
  content?: unknown;
  [key: string]: unknown;
}

export interface McpConnector {
  connect(token: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  listTools(): Promise<McpTool[]>;
  callTool(toolName: string, params: object): Promise<McpResult>;
  executePrompt(prompt: string, context?: object): Promise<McpResult>;
}

type JsonRpcResponse = {
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
};

function pickMcpUrl(): string {
  return process.env.HUBSPOT_MCP_URL || "https://mcp.hubspot.com";
}

class HubSpotMcpConnector implements McpConnector {
  private connected = false;
  private token: string | null = null;
  private requestCounter = 1;

  async connect(token: string): Promise<void> {
    this.token = token;
    this.connected = true;
    await this.listTools();
  }

  async connectWithAuthManager(): Promise<void> {
    await authManager.ensureValidatedForSession();
    await this.connect(authManager.getToken());
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.token = null;
  }

  isConnected(): boolean {
    return this.connected && Boolean(this.token);
  }

  async listTools(): Promise<McpTool[]> {
    const response = await this.sendRpc("tools/list", {});
    const result = (response.result || {}) as { tools?: McpTool[] };
    return result.tools ?? [];
  }

  async callTool(toolName: string, params: object): Promise<McpResult> {
    const response = await this.sendRpc("tools/call", {
      name: toolName,
      arguments: params
    });

    return (response.result || {}) as McpResult;
  }

  async executePrompt(prompt: string, context?: object): Promise<McpResult> {
    const tools = await this.listTools();

    const preferredTool =
      tools.find((tool) => tool.name === "hubspot_execute_prompt") ||
      tools.find((tool) => tool.name === "hubspot_natural_language_query") ||
      tools.find((tool) => tool.name.toLowerCase().includes("search"));

    if (!preferredTool) {
      throw new Error("No MCP tool available for prompt execution");
    }

    return this.callTool(preferredTool.name, {
      prompt,
      context: context ?? {}
    });
  }

  private async sendRpc(method: string, params: object): Promise<JsonRpcResponse> {
    if (!this.isConnected() || !this.token) {
      throw new Error("MCP connector is not connected");
    }

    const body = {
      jsonrpc: "2.0",
      id: this.requestCounter++,
      method,
      params
    };

    const response = await fetch(pickMcpUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`MCP request failed with status ${response.status}`);
    }

    const json = (await response.json()) as JsonRpcResponse;

    if (json.error) {
      throw new Error(json.error.message || "MCP error");
    }

    return json;
  }
}

export const mcpConnector = new HubSpotMcpConnector();
