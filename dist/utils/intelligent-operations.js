import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { findServerMapping, getAvailableServers, } from "../config/server-mappings.js";
export function parseServerRequest(input) {
    const normalizedInput = input.toLowerCase().trim();
    let operation;
    if (normalizedInput.includes("restart nginx") ||
        normalizedInput.includes("nginx restart")) {
        operation = "nginx_restart";
    }
    else if (normalizedInput.includes("reload nginx") ||
        normalizedInput.includes("nginx reload")) {
        operation = "nginx_reload";
    }
    else if (normalizedInput.includes("restart php") ||
        normalizedInput.includes("php restart")) {
        operation = "php_restart";
    }
    else if (normalizedInput.includes("reload php") ||
        normalizedInput.includes("php reload")) {
        operation = "php_reload";
    }
    else if (normalizedInput.includes("restart apache") ||
        normalizedInput.includes("apache restart")) {
        operation = "apache_restart";
    }
    else if (normalizedInput.includes("reload apache") ||
        normalizedInput.includes("apache reload")) {
        operation = "apache_reload";
    }
    else if (normalizedInput.includes("start apache") ||
        normalizedInput.includes("apache start")) {
        operation = "apache_start";
    }
    else if (normalizedInput.includes("restart")) {
        operation = "nginx_restart";
    }
    else {
        operation = "nginx_restart";
    }
    const serverName = normalizedInput
        .replace(/\b(restart|reload|nginx|php|server)\b/g, "")
        .replace(/\s+/g, " ")
        .trim();
    return {
        serverName,
        operation,
    };
}
export function resolveServerOperation(request) {
    const mapping = findServerMapping(request.serverName);
    if (!mapping) {
        const availableServers = getAvailableServers()
            .map(({ name }) => `"${name}"`)
            .join(", ");
        throw new McpError(ErrorCode.InvalidParams, `Server "${request.serverName}" not found in mappings. Available servers: ${availableServers}`);
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
export function generateConfirmationMessage(resolved) {
    const actionMap = {
        nginx_restart: "restarting NGINX",
        nginx_reload: "reloading NGINX configuration",
        php_restart: "restarting PHP-FPM",
        php_reload: "reloading PHP-FPM configuration",
        apache_restart: "restarting Apache",
        apache_reload: "reloading Apache configuration",
        apache_start: "starting Apache",
    };
    const action = actionMap[resolved.operation] ||
        resolved.operation;
    const description = resolved.resolvedMapping.description || resolved.originalServerName;
    const clusterInfo = resolved.clusterDetails
        ? ` - ${resolved.clusterDetails.name} (${resolved.clusterDetails.status})`
        : "";
    return `${action} on ${description} (${resolved.clusterId}/${resolved.serverCharacter}${clusterInfo})`;
}
export function extractServerName(input) {
    const patterns = [
        /^(restart|reload|start|stop)\s+/i,
        /\s+(server|nginx|php)$/i,
        /\s+(restart|reload|start|stop)$/i,
    ];
    let cleaned = input.trim();
    for (const pattern of patterns) {
        cleaned = cleaned.replace(pattern, "").trim();
    }
    return cleaned;
}
export function validateResolvedOperation(resolved) {
    if (!resolved.clusterId) {
        throw new McpError(ErrorCode.InvalidParams, "Cluster ID is required");
    }
    if (!resolved.serverCharacter) {
        throw new McpError(ErrorCode.InvalidParams, "Server character is required");
    }
    if (!resolved.operation) {
        throw new McpError(ErrorCode.InvalidParams, "Operation is required");
    }
    if (!/^[Cc]-\d+$/.test(resolved.clusterId)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid cluster ID format");
    }
    if (!/^(srv|db|cache|search|queue|storage)-[a-h]$/.test(resolved.serverCharacter)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid server character format");
    }
    if (resolved.clusterDetails && !resolved.clusterDetails.id) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid cluster details - cluster ID is missing");
    }
}
//# sourceMappingURL=intelligent-operations.js.map