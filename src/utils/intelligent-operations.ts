import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import {
  findServerMapping,
  getAvailableServers,
} from "../config/server-mappings.js";
import type { ServerMapping } from "../config/server-mappings.js";

export interface IntelligentServerRequest {
  serverName: string;
  operation:
    | "nginx_restart"
    | "nginx_reload"
    | "php_restart"
    | "php_reload"
    | "apache_restart"
    | "apache_reload"
    | "apache_start";
  personalAccessToken?: string;
}

export interface ResolvedServerOperation {
  clusterId: string;
  serverCharacter: string;
  operation: string;
  personalAccessToken?: string | undefined;
  originalServerName: string;
  resolvedMapping: ServerMapping;
  clusterDetails?: {
    id: number;
    name: string;
    status: string;
  };
}

/**
 * Parse natural language server requests and resolve them to specific operations
 */
export function parseServerRequest(input: string): IntelligentServerRequest {
  const normalizedInput = input.toLowerCase().trim();

  // Determine operation type
  let operation: IntelligentServerRequest["operation"];

  if (
    normalizedInput.includes("restart nginx") ||
    normalizedInput.includes("nginx restart")
  ) {
    operation = "nginx_restart";
  } else if (
    normalizedInput.includes("reload nginx") ||
    normalizedInput.includes("nginx reload")
  ) {
    operation = "nginx_reload";
  } else if (
    normalizedInput.includes("restart php") ||
    normalizedInput.includes("php restart")
  ) {
    operation = "php_restart";
  } else if (
    normalizedInput.includes("reload php") ||
    normalizedInput.includes("php reload")
  ) {
    operation = "php_reload";
  } else if (
    normalizedInput.includes("restart apache") ||
    normalizedInput.includes("apache restart")
  ) {
    operation = "apache_restart";
  } else if (
    normalizedInput.includes("reload apache") ||
    normalizedInput.includes("apache reload")
  ) {
    operation = "apache_reload";
  } else if (
    normalizedInput.includes("start apache") ||
    normalizedInput.includes("apache start")
  ) {
    operation = "apache_start";
  } else if (normalizedInput.includes("restart")) {
    // Default to nginx restart for generic "restart" commands
    operation = "nginx_restart";
  } else {
    // Default operation if no specific action is mentioned
    operation = "nginx_restart";
  }

  // Extract server name - remove operation keywords
  const serverName = normalizedInput
    .replace(/\b(restart|reload|nginx|php|server)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    serverName,
    operation,
  };
}

/**
 * Resolve server name to cluster configuration
 */
export function resolveServerOperation(
  request: IntelligentServerRequest,
): ResolvedServerOperation {
  const mapping = findServerMapping(request.serverName);

  if (!mapping) {
    const availableServers = getAvailableServers()
      .map(({ name }) => `"${name}"`)
      .join(", ");

    throw new McpError(
      ErrorCode.InvalidParams,
      `Server "${request.serverName}" not found in mappings. Available servers: ${availableServers}`,
    );
  }

  return {
    clusterId: mapping.clusterId,
    serverCharacter: mapping.serverCharacter,
    operation: request.operation,
    personalAccessToken: request.personalAccessToken,
    originalServerName: request.serverName,
    resolvedMapping: mapping,
  };
}

/**
 * Generate human-readable confirmation message
 */
export function generateConfirmationMessage(
  resolved: ResolvedServerOperation,
): string {
  const actionMap = {
    nginx_restart: "restarting NGINX",
    nginx_reload: "reloading NGINX configuration",
    php_restart: "restarting PHP-FPM",
    php_reload: "reloading PHP-FPM configuration",
    apache_restart: "restarting Apache",
    apache_reload: "reloading Apache configuration",
    apache_start: "starting Apache",
  };

  const action =
    actionMap[resolved.operation as keyof typeof actionMap] ||
    resolved.operation;
  const description =
    resolved.resolvedMapping.description || resolved.originalServerName;

  const clusterInfo = resolved.clusterDetails
    ? ` - ${resolved.clusterDetails.name} (${resolved.clusterDetails.status})`
    : "";

  return `${action} on ${description} (${resolved.clusterId}/${resolved.serverCharacter}${clusterInfo})`;
}

/**
 * Extract server name from various input formats
 */
export function extractServerName(input: string): string {
  // Common patterns to clean up
  const patterns = [
    /^(restart|reload|start|stop)\s+/i, // Remove action at start
    /\s+(server|nginx|php)$/i, // Remove service at end
    /\s+(restart|reload|start|stop)$/i, // Remove action at end
  ];

  let cleaned = input.trim();

  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, "").trim();
  }

  return cleaned;
}

/**
 * Validate that the resolved operation has all required parameters
 */
export function validateResolvedOperation(
  resolved: ResolvedServerOperation,
): void {
  if (!resolved.clusterId) {
    throw new McpError(ErrorCode.InvalidParams, "Cluster ID is required");
  }

  if (!resolved.serverCharacter) {
    throw new McpError(ErrorCode.InvalidParams, "Server character is required");
  }

  if (!resolved.operation) {
    throw new McpError(ErrorCode.InvalidParams, "Operation is required");
  }

  // Validate cluster ID format
  if (!/^[Cc]-\d+$/.test(resolved.clusterId)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid cluster ID format");
  }

  // Validate server character format
  if (
    !/^(srv|db|cache|search|queue|storage)-[a-h]$/.test(
      resolved.serverCharacter,
    )
  ) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Invalid server character format",
    );
  }

  // Validate that cluster details exist if provided
  if (resolved.clusterDetails && !resolved.clusterDetails.id) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Invalid cluster details - cluster ID is missing",
    );
  }
}
