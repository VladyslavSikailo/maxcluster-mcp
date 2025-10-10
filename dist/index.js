#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { z } from "zod";
import { API_CONFIG, API_ENDPOINTS, ERROR_MESSAGES, HTTP_STATUS, } from "./utils/constants.js";
import { validatePersonalAccessToken, extractApiErrorInfo, } from "./utils/validation.js";
import { parseServerRequest, resolveServerOperation, generateConfirmationMessage, } from "./utils/intelligent-operations.js";
import { getAvailableServers } from "./config/server-mappings.js";
const ClusterOperationSchema = z.object({
    cluster_id: z.string().describe('Cluster ID (e.g., "C-1234")'),
    server_character: z.string().describe('Server character (e.g., "srv-a")'),
    personal_access_token: z
        .string()
        .optional()
        .describe("Personal Access Token for authentication (optional if configured in environment)"),
});
const IntelligentServerOperationSchema = z.object({
    server_request: z
        .string()
        .describe('Natural language server operation request (e.g., "restart promocell staging", "reload nginx on production server")'),
    personal_access_token: z
        .string()
        .optional()
        .describe("Personal Access Token for authentication (optional if configured in environment)"),
});
class ClusterControlMCPServer {
    server;
    constructor() {
        this.server = new Server({
            name: "clustercontrol-mcp-server",
            version: "1.0.0",
        });
        this.setupToolHandlers();
        this.setupErrorHandling();
    }
    setupErrorHandling() {
        this.server.onerror = (error) => {
            console.error("[MCP Error]", error);
        };
        process.on("SIGINT", async () => {
            await this.server.close();
            process.exit(0);
        });
        process.on("uncaughtException", (error) => {
            console.error("Uncaught Exception:", error);
            process.exit(1);
        });
        process.on("unhandledRejection", (reason, promise) => {
            console.error("Unhandled Rejection at:", promise, "reason:", reason);
            process.exit(1);
        });
    }
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "intelligent_server_operation",
                        description: "Perform server operations using natural language with a 5-step workflow: 1) Retrieve cluster information using PAT, 2) Parse natural language request, 3) Determine correct cluster/server with validation, 4) Execute appropriate restart command, 5) Clean up temporary files. Examples: 'restart promocell staging', 'reload nginx on production'.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                server_request: {
                                    type: "string",
                                    description: 'Natural language server operation request (e.g., "restart promocell staging", "reload nginx on production server")',
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["server_request"],
                        },
                    },
                    {
                        name: "list_available_servers",
                        description: "List all available server mappings that can be used with intelligent operations",
                        inputSchema: {
                            type: "object",
                            properties: {},
                        },
                    },
                    {
                        name: "list_clusters",
                        description: "List all MaxCluster clusters accessible with the provided Personal Access Token",
                        inputSchema: {
                            type: "object",
                            properties: {
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                        },
                    },
                    {
                        name: "nginx_restart",
                        description: "Restart the NGINX webserver on a MaxCluster server",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character (e.g., "srv-a", "srv-b", "db-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "nginx_reload",
                        description: "Reload the NGINX webserver configuration on a MaxCluster server (graceful reload without dropping connections)",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character (e.g., "srv-a", "srv-b", "db-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "php_restart",
                        description: "Restart PHP-FPM on a MaxCluster server (WARNING: Will kill all active PHP connections)",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character (e.g., "srv-a", "srv-b", "db-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "php_reload",
                        description: "Gracefully reload PHP-FPM on a MaxCluster server (graceful restart with 30s timeout)",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character (e.g., "srv-a", "srv-b", "db-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "php_status",
                        description: "Get the current PHP status, versions, and configuration on a MaxCluster server",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character (e.g., "srv-a", "srv-b", "db-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "php_install_version",
                        description: "Install a specific PHP version on a MaxCluster server",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character (e.g., "srv-a", "srv-b", "db-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                version: {
                                    type: "string",
                                    description: 'PHP version to install (e.g., "8.2", "8.1")',
                                    pattern: "^\\d+\\.\\d+$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character", "version"],
                        },
                    },
                    {
                        name: "php_uninstall_version",
                        description: "Uninstall a specific PHP version from a MaxCluster server (only versions not in use)",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character (e.g., "srv-a", "srv-b", "db-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                version: {
                                    type: "string",
                                    description: 'PHP version to uninstall (e.g., "8.1", "7.4")',
                                    pattern: "^\\d+\\.\\d+$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character", "version"],
                        },
                    },
                    {
                        name: "php_change_cli_version",
                        description: "Change the default PHP CLI version on a MaxCluster server",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character (e.g., "srv-a", "srv-b", "db-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                version: {
                                    type: "string",
                                    description: 'PHP version to set as default CLI (e.g., "8.2", "8.1")',
                                    pattern: "^\\d+\\.\\d+$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character", "version"],
                        },
                    },
                    {
                        name: "php_change_composer_version",
                        description: "Change the default Composer version on a MaxCluster server",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character (e.g., "srv-a", "srv-b", "db-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                version: {
                                    type: "string",
                                    description: 'Composer version to set as default (e.g., "2.6", "2.5")',
                                    pattern: "^\\d+\\.\\d+$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character", "version"],
                        },
                    },
                    {
                        name: "apache_start",
                        description: "Start the Apache webserver on a MaxCluster server (executes switchover from NGINX if active)",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character (e.g., "srv-a", "srv-b", "db-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "apache_restart",
                        description: "Restart the Apache webserver on a MaxCluster server",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character (e.g., "srv-a", "srv-b", "db-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "apache_reload",
                        description: "Reload the Apache webserver configuration on a MaxCluster server (graceful reload without dropping connections)",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character (e.g., "srv-a", "srv-b", "db-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "apache_status",
                        description: "Get the current status and configuration of the Apache webserver on a MaxCluster server",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character (e.g., "srv-a", "srv-b", "db-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "server_info",
                        description: "Get detailed information about a MaxCluster server including hardware specs, network configuration, and storage details",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character (e.g., "srv-a", "srv-b", "db-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "mysql_status",
                        description: "Get MySQL/MariaDB status including version, state, ports, and list of databases with users",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically db-* for database servers (e.g., "db-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "mysql_restart",
                        description: "Restart MySQL/MariaDB service (WARNING: Will drop all active connections)",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically db-* for database servers (e.g., "db-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "mysql_create_database",
                        description: "Create a new MySQL/MariaDB database with auto-generated name, username, and secure password. Returns connection details for Magento configuration.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically db-* for database servers (e.g., "db-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                description: {
                                    type: "string",
                                    description: 'Optional description for the database (e.g., "Magento 2 Production")',
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "mysql_list_databases",
                        description: "List all MySQL/MariaDB databases on the server with usernames and descriptions",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically db-* for database servers (e.g., "db-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "mysql_delete_database",
                        description: "Delete a MySQL/MariaDB database (WARNING: DESTRUCTIVE operation, cannot be undone)",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically db-* for database servers (e.g., "db-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                database_id: {
                                    type: "string",
                                    description: "Database ID to delete (get from mysql_list_databases)",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character", "database_id"],
                        },
                    },
                    {
                        name: "redis_status",
                        description: "Get Redis status including version, instance count, and details of all running instances",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically cache-* for Redis servers (e.g., "cache-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "redis_create_cache_instance",
                        description: "Create a Redis instance optimized for default caching (1GB RAM, volatile-lru policy, no persistence) - perfect for Magento default cache",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically cache-* for Redis servers (e.g., "cache-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                description: {
                                    type: "string",
                                    description: 'Optional description (e.g., "Magento 2 Default Cache")',
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "redis_create_session_instance",
                        description: "Create a Redis instance optimized for session storage (512MB RAM, volatile-lru policy, persistence enabled) - perfect for Magento sessions",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically cache-* for Redis servers (e.g., "cache-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                description: {
                                    type: "string",
                                    description: 'Optional description (e.g., "Magento 2 Session Storage")',
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "redis_create_fpc_instance",
                        description: "Create a Redis instance optimized for full-page cache (1GB RAM, volatile-lru policy, no persistence) - perfect for Magento FPC",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically cache-* for Redis servers (e.g., "cache-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                description: {
                                    type: "string",
                                    description: 'Optional description (e.g., "Magento 2 Full Page Cache")',
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "redis_start_instance",
                        description: "Start a Redis instance by port number",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically cache-* for Redis servers (e.g., "cache-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                port: {
                                    type: "number",
                                    description: "Redis instance port number (get from redis_status)",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character", "port"],
                        },
                    },
                    {
                        name: "redis_stop_instance",
                        description: "Stop a Redis instance by port number",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically cache-* for Redis servers (e.g., "cache-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                port: {
                                    type: "number",
                                    description: "Redis instance port number (get from redis_status)",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character", "port"],
                        },
                    },
                    {
                        name: "redis_flush_instance",
                        description: "Flush all data from a Redis instance (WARNING: Clears all keys, cannot be undone)",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically cache-* for Redis servers (e.g., "cache-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                port: {
                                    type: "number",
                                    description: "Redis instance port number (get from redis_status)",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character", "port"],
                        },
                    },
                    {
                        name: "rabbitmq_status",
                        description: "Get RabbitMQ status including version, state, ports, virtual hosts, and users",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically queue-* for RabbitMQ servers (e.g., "queue-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "rabbitmq_start",
                        description: "Start the RabbitMQ service",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically queue-* for RabbitMQ servers (e.g., "queue-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "rabbitmq_stop",
                        description: "Stop the RabbitMQ service",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically queue-* for RabbitMQ servers (e.g., "queue-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "rabbitmq_create_vhost",
                        description: "Create a RabbitMQ virtual host (vhost) with optional automatic user permissions",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically queue-* for RabbitMQ servers (e.g., "queue-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                vhost_name: {
                                    type: "string",
                                    description: 'Virtual host name (e.g., "/magento", "magento-prod")',
                                },
                                users: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "Optional array of usernames to grant full access to this vhost",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character", "vhost_name"],
                        },
                    },
                    {
                        name: "rabbitmq_create_user",
                        description: "Create a RabbitMQ user with auto-generated secure password. Returns username and password for Magento configuration.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically queue-* for RabbitMQ servers (e.g., "queue-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                username: {
                                    type: "string",
                                    description: 'Username for RabbitMQ user (e.g., "magento-user")',
                                },
                                tags: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: 'Optional tags for user (e.g., ["administrator", "monitoring"])',
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character", "username"],
                        },
                    },
                    {
                        name: "rabbitmq_setup_magento",
                        description: "Complete RabbitMQ setup for Magento 2: creates vhost, user, and grants full permissions in one operation. Returns AMQP connection URL ready for Magento configuration.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically queue-* for RabbitMQ servers (e.g., "queue-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                vhost_name: {
                                    type: "string",
                                    description: 'Virtual host name for Magento (e.g., "/magento", "magento-prod")',
                                },
                                username: {
                                    type: "string",
                                    description: 'Username for Magento RabbitMQ user (e.g., "magento-user")',
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character", "vhost_name", "username"],
                        },
                    },
                    {
                        name: "elasticsearch_status",
                        description: "Get Elasticsearch status including version, instances, and heap size configuration",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically search-* for Elasticsearch servers (e.g., "search-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "elasticsearch_create_instance",
                        description: "Create a new Elasticsearch instance with specified heap size (minimum 1GB recommended for Magento 2)",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically search-* for Elasticsearch servers (e.g., "search-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                heap_size_mb: {
                                    type: "number",
                                    description: "Heap size in MB (minimum 256, recommended 1024+ for Magento 2)",
                                },
                                description: {
                                    type: "string",
                                    description: 'Optional description (e.g., "Magento 2 Catalog Search")',
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character", "heap_size_mb"],
                        },
                    },
                    {
                        name: "elasticsearch_start_instance",
                        description: "Start an Elasticsearch instance by port number",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically search-* for Elasticsearch servers (e.g., "search-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                port: {
                                    type: "number",
                                    description: "Elasticsearch instance port number (get from elasticsearch_status)",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character", "port"],
                        },
                    },
                    {
                        name: "elasticsearch_stop_instance",
                        description: "Stop an Elasticsearch instance by port number",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically search-* for Elasticsearch servers (e.g., "search-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                port: {
                                    type: "number",
                                    description: "Elasticsearch instance port number (get from elasticsearch_status)",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character", "port"],
                        },
                    },
                    {
                        name: "elasticsearch_restart_instance",
                        description: "Restart an Elasticsearch instance by port number",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically search-* for Elasticsearch servers (e.g., "search-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                port: {
                                    type: "number",
                                    description: "Elasticsearch instance port number (get from elasticsearch_status)",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character", "port"],
                        },
                    },
                    {
                        name: "opensearch_status",
                        description: "Get OpenSearch status including version, instances, and heap size configuration",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically search-* for OpenSearch servers (e.g., "search-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character"],
                        },
                    },
                    {
                        name: "opensearch_create_instance",
                        description: "Create a new OpenSearch instance with specified heap size (minimum 1GB recommended for Magento 2)",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically search-* for OpenSearch servers (e.g., "search-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                heap_size_mb: {
                                    type: "number",
                                    description: "Heap size in MB (minimum 256, recommended 1024+ for Magento 2)",
                                },
                                description: {
                                    type: "string",
                                    description: 'Optional description (e.g., "Magento 2 Catalog Search")',
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character", "heap_size_mb"],
                        },
                    },
                    {
                        name: "opensearch_start_instance",
                        description: "Start an OpenSearch instance by port number",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically search-* for OpenSearch servers (e.g., "search-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                port: {
                                    type: "number",
                                    description: "OpenSearch instance port number (get from opensearch_status)",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character", "port"],
                        },
                    },
                    {
                        name: "opensearch_stop_instance",
                        description: "Stop an OpenSearch instance by port number",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically search-* for OpenSearch servers (e.g., "search-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                port: {
                                    type: "number",
                                    description: "OpenSearch instance port number (get from opensearch_status)",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character", "port"],
                        },
                    },
                    {
                        name: "opensearch_restart_instance",
                        description: "Restart an OpenSearch instance by port number",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                server_character: {
                                    type: "string",
                                    description: 'Server character, typically search-* for OpenSearch servers (e.g., "search-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                port: {
                                    type: "number",
                                    description: "OpenSearch instance port number (get from opensearch_status)",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "server_character", "port"],
                        },
                    },
                    {
                        name: "magento_environment_check",
                        description: "Comprehensive health check for Magento 2 environment - verifies all required services (MySQL, Redis, RabbitMQ, Elasticsearch/OpenSearch, PHP, NGINX/Apache) are running and ready",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                web_server: {
                                    type: "string",
                                    description: 'Web server character (e.g., "srv-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                db_server: {
                                    type: "string",
                                    description: 'Database server character (e.g., "db-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                cache_server: {
                                    type: "string",
                                    description: 'Cache server character (e.g., "cache-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                queue_server: {
                                    type: "string",
                                    description: 'Queue server character (e.g., "queue-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                search_server: {
                                    type: "string",
                                    description: 'Search server character (e.g., "search-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                search_engine: {
                                    type: "string",
                                    description: 'Search engine type: "elasticsearch" or "opensearch"',
                                    enum: ["elasticsearch", "opensearch"],
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "web_server", "db_server", "cache_server", "queue_server", "search_server", "search_engine"],
                        },
                    },
                    {
                        name: "magento_prepare_environment",
                        description: "🔥 ONE-SHOT Magento 2 environment setup: Creates database, 3 Redis instances (cache/session/FPC), RabbitMQ vhost+user, and Elasticsearch/OpenSearch instance. Returns complete Magento 2 configuration ready for app/etc/env.php",
                        inputSchema: {
                            type: "object",
                            properties: {
                                cluster_id: {
                                    type: "string",
                                    description: 'Cluster ID (e.g., "C-1234")',
                                    pattern: "^[Cc]-\\d+$",
                                },
                                web_server: {
                                    type: "string",
                                    description: 'Web server character (e.g., "srv-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                db_server: {
                                    type: "string",
                                    description: 'Database server character (e.g., "db-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                cache_server: {
                                    type: "string",
                                    description: 'Cache server character (e.g., "cache-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                queue_server: {
                                    type: "string",
                                    description: 'Queue server character (e.g., "queue-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                search_server: {
                                    type: "string",
                                    description: 'Search server character (e.g., "search-a")',
                                    pattern: "^(srv|db|cache|search|queue|storage)-[a-h]$",
                                },
                                search_engine: {
                                    type: "string",
                                    description: 'Search engine type: "elasticsearch" or "opensearch"',
                                    enum: ["elasticsearch", "opensearch"],
                                },
                                search_heap_mb: {
                                    type: "number",
                                    description: "Search engine heap size in MB (recommended: 2048 for production)",
                                    default: 2048,
                                },
                                environment_name: {
                                    type: "string",
                                    description: 'Environment name for descriptions (e.g., "Production", "Staging", "Demo")',
                                },
                                rabbitmq_vhost: {
                                    type: "string",
                                    description: 'RabbitMQ vhost name (e.g., "/magento")',
                                    default: "/magento",
                                },
                                rabbitmq_user: {
                                    type: "string",
                                    description: 'RabbitMQ username (e.g., "magento-user")',
                                    default: "magento",
                                },
                                personal_access_token: {
                                    type: "string",
                                    description: "Personal Access Token for authentication (optional if MAXCLUSTER_PAT environment variable is set)",
                                    pattern: "^\\d+\\|[a-z0-9]{40,}$",
                                },
                            },
                            required: ["cluster_id", "web_server", "db_server", "cache_server", "queue_server", "search_server", "search_engine", "environment_name"],
                        },
                    },
                ],
            };
        });
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                const { name, arguments: args } = request.params;
                switch (name) {
                    case "intelligent_server_operation":
                        return await this.handleIntelligentServerOperation(args);
                    case "list_available_servers":
                        return await this.handleListAvailableServers(args);
                    case "list_clusters":
                        return await this.handleListClusters(args);
                    case "nginx_restart":
                        return await this.handleNginxRestart(args);
                    case "nginx_reload":
                        return await this.handleNginxReload(args);
                    case "php_restart":
                        return await this.handlePhpRestart(args);
                    case "php_reload":
                        return await this.handlePhpReload(args);
                    case "php_status":
                        return await this.handlePhpStatus(args);
                    case "php_install_version":
                        return await this.handlePhpInstallVersion(args);
                    case "php_uninstall_version":
                        return await this.handlePhpUninstallVersion(args);
                    case "php_change_cli_version":
                        return await this.handlePhpChangeCliVersion(args);
                    case "php_change_composer_version":
                        return await this.handlePhpChangeComposerVersion(args);
                    case "apache_start":
                        return await this.handleApacheStart(args);
                    case "apache_restart":
                        return await this.handleApacheRestart(args);
                    case "apache_reload":
                        return await this.handleApacheReload(args);
                    case "apache_status":
                        return await this.handleApacheStatus(args);
                    case "server_info":
                        return await this.handleServerInfo(args);
                    case "mysql_status":
                        return await this.handleMysqlStatus(args);
                    case "mysql_restart":
                        return await this.handleMysqlRestart(args);
                    case "mysql_create_database":
                        return await this.handleMysqlCreateDatabase(args);
                    case "mysql_list_databases":
                        return await this.handleMysqlListDatabases(args);
                    case "mysql_delete_database":
                        return await this.handleMysqlDeleteDatabase(args);
                    case "redis_status":
                        return await this.handleRedisStatus(args);
                    case "redis_create_cache_instance":
                        return await this.handleRedisCreateCacheInstance(args);
                    case "redis_create_session_instance":
                        return await this.handleRedisCreateSessionInstance(args);
                    case "redis_create_fpc_instance":
                        return await this.handleRedisCreateFpcInstance(args);
                    case "redis_start_instance":
                        return await this.handleRedisStartInstance(args);
                    case "redis_stop_instance":
                        return await this.handleRedisStopInstance(args);
                    case "redis_flush_instance":
                        return await this.handleRedisFlushInstance(args);
                    case "rabbitmq_status":
                        return await this.handleRabbitmqStatus(args);
                    case "rabbitmq_start":
                        return await this.handleRabbitmqStart(args);
                    case "rabbitmq_stop":
                        return await this.handleRabbitmqStop(args);
                    case "rabbitmq_create_vhost":
                        return await this.handleRabbitmqCreateVhost(args);
                    case "rabbitmq_create_user":
                        return await this.handleRabbitmqCreateUser(args);
                    case "rabbitmq_setup_magento":
                        return await this.handleRabbitmqSetupMagento(args);
                    case "elasticsearch_status":
                        return await this.handleElasticsearchStatus(args);
                    case "elasticsearch_create_instance":
                        return await this.handleElasticsearchCreateInstance(args);
                    case "elasticsearch_start_instance":
                        return await this.handleElasticsearchStartInstance(args);
                    case "elasticsearch_stop_instance":
                        return await this.handleElasticsearchStopInstance(args);
                    case "elasticsearch_restart_instance":
                        return await this.handleElasticsearchRestartInstance(args);
                    case "opensearch_status":
                        return await this.handleOpensearchStatus(args);
                    case "opensearch_create_instance":
                        return await this.handleOpensearchCreateInstance(args);
                    case "opensearch_start_instance":
                        return await this.handleOpensearchStartInstance(args);
                    case "opensearch_stop_instance":
                        return await this.handleOpensearchStopInstance(args);
                    case "opensearch_restart_instance":
                        return await this.handleOpensearchRestartInstance(args);
                    case "magento_environment_check":
                        return await this.handleMagentoEnvironmentCheck(args);
                    case "magento_prepare_environment":
                        return await this.handleMagentoPrepareEnvironment(args);
                    default:
                        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
            }
            catch (error) {
                if (error instanceof McpError) {
                    throw error;
                }
                const errorInfo = extractApiErrorInfo(error);
                throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${errorInfo.message || "Unknown error"}`);
            }
        });
    }
    createApiClient(token) {
        return axios.create({
            baseURL: API_CONFIG.BASE_URL,
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            timeout: API_CONFIG.TIMEOUT,
        });
    }
    async getServerId(apiClient, clusterId, serverCharacter) {
        try {
            const endpoint = `${API_ENDPOINTS.CLUSTERS_LIST()}/${clusterId}/servers`;
            const response = await apiClient.get(endpoint, {
                params: { per_page: 20 },
            });
            const servers = response.data?.data;
            if (!Array.isArray(servers)) {
                throw new Error("Invalid server data received from API");
            }
            const server = servers.find((s) => s.character?.name === serverCharacter);
            if (!server) {
                throw new McpError(ErrorCode.InvalidParams, `${ERROR_MESSAGES.SERVER_NOT_FOUND}: '${serverCharacter}' in cluster C-${clusterId}`);
            }
            return server.id;
        }
        catch (error) {
            if (error instanceof McpError) {
                throw error;
            }
            const errorInfo = extractApiErrorInfo(error);
            if (errorInfo.isApiError) {
                switch (errorInfo.status) {
                    case HTTP_STATUS.UNAUTHORIZED:
                        throw new McpError(ErrorCode.InvalidParams, ERROR_MESSAGES.AUTHENTICATION_FAILED);
                    case HTTP_STATUS.FORBIDDEN:
                    case HTTP_STATUS.NOT_FOUND:
                        throw new McpError(ErrorCode.InvalidParams, `${ERROR_MESSAGES.CLUSTER_NOT_FOUND}: C-${clusterId}`);
                    default:
                        throw new McpError(ErrorCode.InternalError, `${ERROR_MESSAGES.API_REQUEST_FAILED}: ${errorInfo.status} ${errorInfo.statusText}`);
                }
            }
            throw new McpError(ErrorCode.InternalError, `Failed to get server ID: ${errorInfo.message}`);
        }
    }
    async setupClusterConfig(params) {
        const envPat = process.env.MAXCLUSTER_PAT;
        const providedPat = params.personal_access_token;
        if (!providedPat && !envPat) {
            throw new McpError(ErrorCode.InvalidParams, ERROR_MESSAGES.AUTHENTICATION_FAILED);
        }
        const token = providedPat || envPat;
        try {
            validatePersonalAccessToken(token);
        }
        catch (error) {
            throw new McpError(ErrorCode.InvalidParams, ERROR_MESSAGES.INVALID_PAT);
        }
        const apiClient = this.createApiClient(token);
        const tempFiles = [];
        return {
            apiClient,
            tempFiles,
        };
    }
    async executeServiceAction(config, endpoint, actionName, serviceName) {
        try {
            await config.apiClient.post(endpoint);
            await this.cleanupTempFiles(config.tempFiles);
            console.error(`✅ ${serviceName} ${actionName} completed successfully`);
            return {
                content: [
                    {
                        type: "text",
                        text: `${serviceName} ${actionName} completed successfully`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to ${actionName} ${serviceName}:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to ${actionName} ${serviceName}: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleNginxRestart(args) {
        const params = ClusterOperationSchema.parse(args);
        const { apiClient, tempFiles } = await this.setupClusterConfig(params);
        const endpoint = `/v1/clusters/${params.cluster_id}/servers/${await this.getServerId(apiClient, parseInt(params.cluster_id.replace(/^[Cc]-/, "")), params.server_character)}/managed/nginx/actions/restart`;
        return await this.executeServiceAction({ apiClient, tempFiles }, endpoint, "restart", "NGINX");
    }
    async handleNginxReload(args) {
        const params = ClusterOperationSchema.parse(args);
        const { apiClient, tempFiles } = await this.setupClusterConfig(params);
        const endpoint = `/v1/clusters/${params.cluster_id}/servers/${await this.getServerId(apiClient, parseInt(params.cluster_id.replace(/^[Cc]-/, "")), params.server_character)}/managed/nginx/actions/reload`;
        return await this.executeServiceAction({ apiClient, tempFiles }, endpoint, "reload", "NGINX");
    }
    async handlePhpRestart(args) {
        const params = ClusterOperationSchema.parse(args);
        const { apiClient, tempFiles } = await this.setupClusterConfig(params);
        const endpoint = `/v1/clusters/${params.cluster_id}/servers/${await this.getServerId(apiClient, parseInt(params.cluster_id.replace(/^[Cc]-/, "")), params.server_character)}/managed/php/actions/restart`;
        return await this.executeServiceAction({ apiClient, tempFiles }, endpoint, "restart", "PHP-FPM");
    }
    async handlePhpReload(args) {
        const params = ClusterOperationSchema.parse(args);
        const { apiClient, tempFiles } = await this.setupClusterConfig(params);
        const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
        const endpoint = `/v1/clusters/${clusterId}/servers/${await this.getServerId(apiClient, clusterId, params.server_character)}/managed/php/actions/reload`;
        return await this.executeServiceAction({ apiClient, tempFiles }, endpoint, "reload", "PHP-FPM");
    }
    async handlePhpStatus(args) {
        const params = ClusterOperationSchema.parse(args);
        console.error(`📊 Getting PHP status on ${params.cluster_id}/${params.server_character}`);
        try {
            const { apiClient, tempFiles } = await this.setupClusterConfig(params);
            const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
            const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
            const response = await apiClient.get(`/v1/clusters/${clusterId}/servers/${serverId}/managed/php`);
            const versions = response.data?.data?.versions;
            await this.cleanupTempFiles(tempFiles);
            if (!versions) {
                throw new Error("No PHP status data found");
            }
            const formatPhpVersions = (phpVersions) => {
                return phpVersions
                    .map((v) => `${v.version}${v.installed ? " [installed]" : " [not installed]"}`)
                    .join(", ");
            };
            const formatComposerVersions = (composerList) => {
                return composerList.map((v) => v.version).join(", ");
            };
            const getDefaultComposer = (composerList) => {
                const defaultComposer = composerList.find((v) => v.isDefault);
                return defaultComposer ? defaultComposer.version : "N/A";
            };
            console.error(`✅ PHP status retrieved for ${params.cluster_id}/${params.server_character}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `PHP Status on ${params.cluster_id}/${params.server_character}:
  Default CLI Version: ${versions.cli || "N/A"}
  Available CLI Versions: ${formatPhpVersions(versions.php || [])}
  Default FPM Version: ${versions.phpfpmdefault || "N/A"}
  Available FPM Versions: ${formatPhpVersions(versions.phpfpm || [])}
  Default Composer Version: ${getDefaultComposer(versions.composerList || [])}
  Available Composer Versions: ${formatComposerVersions(versions.composerList || [])}`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to get PHP status on ${params.cluster_id}/${params.server_character}:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to get PHP status: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handlePhpInstallVersion(args) {
        const PhpVersionSchema = ClusterOperationSchema.extend({
            version: z.string().describe('PHP version to install (e.g., "8.2")'),
        });
        const params = PhpVersionSchema.parse(args);
        console.error(`📦 Installing PHP ${params.version} on ${params.cluster_id}/${params.server_character}`);
        try {
            const { apiClient, tempFiles } = await this.setupClusterConfig(params);
            const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
            const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
            await apiClient.post(`/v1/clusters/${clusterId}/servers/${serverId}/managed/php/actions/install_version`, { version: params.version });
            await this.cleanupTempFiles(tempFiles);
            console.error(`✅ PHP ${params.version} installed on ${params.cluster_id}/${params.server_character}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `PHP version ${params.version} installed successfully on ${params.cluster_id}/${params.server_character}`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to install PHP ${params.version} on ${params.cluster_id}/${params.server_character}:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to install PHP version ${params.version}: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handlePhpUninstallVersion(args) {
        const PhpVersionSchema = ClusterOperationSchema.extend({
            version: z.string().describe('PHP version to uninstall (e.g., "8.1")'),
        });
        const params = PhpVersionSchema.parse(args);
        console.error(`🗑️ Uninstalling PHP ${params.version} on ${params.cluster_id}/${params.server_character}`);
        try {
            const { apiClient, tempFiles } = await this.setupClusterConfig(params);
            const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
            const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
            await apiClient.post(`/v1/clusters/${clusterId}/servers/${serverId}/managed/php/actions/uninstall_version`, { version: params.version });
            await this.cleanupTempFiles(tempFiles);
            console.error(`✅ PHP ${params.version} uninstalled from ${params.cluster_id}/${params.server_character}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `PHP version ${params.version} uninstalled successfully from ${params.cluster_id}/${params.server_character}`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to uninstall PHP ${params.version} from ${params.cluster_id}/${params.server_character}:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to uninstall PHP version ${params.version}: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handlePhpChangeCliVersion(args) {
        const PhpVersionSchema = ClusterOperationSchema.extend({
            version: z
                .string()
                .describe('PHP CLI version to set as default (e.g., "8.2")'),
        });
        const params = PhpVersionSchema.parse(args);
        console.error(`🔧 Changing PHP CLI version to ${params.version} on ${params.cluster_id}/${params.server_character}`);
        try {
            const { apiClient, tempFiles } = await this.setupClusterConfig(params);
            const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
            const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
            await apiClient.post(`/v1/clusters/${clusterId}/servers/${serverId}/managed/php/actions/change_cli`, { version: params.version });
            await this.cleanupTempFiles(tempFiles);
            console.error(`✅ PHP CLI version changed to ${params.version} on ${params.cluster_id}/${params.server_character}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `PHP CLI default version changed to ${params.version} on ${params.cluster_id}/${params.server_character}`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to change PHP CLI version to ${params.version} on ${params.cluster_id}/${params.server_character}:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to change PHP CLI version to ${params.version}: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handlePhpChangeComposerVersion(args) {
        const ComposerVersionSchema = ClusterOperationSchema.extend({
            version: z
                .string()
                .describe('Composer version to set as default (e.g., "2.6")'),
        });
        const params = ComposerVersionSchema.parse(args);
        console.error(`🎼 Changing Composer version to ${params.version} on ${params.cluster_id}/${params.server_character}`);
        try {
            const { apiClient, tempFiles } = await this.setupClusterConfig(params);
            const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
            const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
            await apiClient.post(`/v1/clusters/${clusterId}/servers/${serverId}/managed/php/actions/change_composer`, { version: params.version });
            await this.cleanupTempFiles(tempFiles);
            console.error(`✅ Composer version changed to ${params.version} on ${params.cluster_id}/${params.server_character}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Composer default version changed to ${params.version} on ${params.cluster_id}/${params.server_character}`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to change Composer version to ${params.version} on ${params.cluster_id}/${params.server_character}:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to change Composer version to ${params.version}: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleApacheStart(args) {
        const params = ClusterOperationSchema.parse(args);
        console.error(`🚀 Starting Apache on ${params.cluster_id}/${params.server_character}`);
        try {
            const { apiClient, tempFiles } = await this.setupClusterConfig(params);
            const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
            const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
            const webserverStatus = await apiClient.get(`/v1/clusters/${clusterId}/servers/${serverId}/managed/webserver`);
            const activeWebserver = webserverStatus.data?.data?.status?.[0]?.instances?.[0]?.properties
                ?.activeWebserver;
            if (activeWebserver === "webservernginx" || activeWebserver === "nginx") {
                console.error(`🔄 Switching from NGINX to Apache on ${params.cluster_id}/${params.server_character}`);
                await apiClient.post(`/v1/clusters/${clusterId}/servers/${serverId}/managed/webserver/actions/switch`);
            }
            else {
                console.error(`✅ Apache started on ${params.cluster_id}/${params.server_character}`);
            }
            await this.cleanupTempFiles(tempFiles);
            return {
                content: [
                    {
                        type: "text",
                        text: `Apache started successfully on ${params.cluster_id}/${params.server_character}${activeWebserver === "webservernginx" ||
                            activeWebserver === "nginx"
                            ? " (switched from NGINX)"
                            : ""}`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to start Apache on ${params.cluster_id}/${params.server_character}:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to start Apache: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleApacheRestart(args) {
        const params = ClusterOperationSchema.parse(args);
        const { apiClient, tempFiles } = await this.setupClusterConfig(params);
        const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
        const endpoint = `/v1/clusters/${clusterId}/servers/${await this.getServerId(apiClient, clusterId, params.server_character)}/managed/apache/actions/restart`;
        return await this.executeServiceAction({ apiClient, tempFiles }, endpoint, "restart", "Apache");
    }
    async handleApacheReload(args) {
        const params = ClusterOperationSchema.parse(args);
        const { apiClient, tempFiles } = await this.setupClusterConfig(params);
        const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
        const endpoint = `/v1/clusters/${clusterId}/servers/${await this.getServerId(apiClient, clusterId, params.server_character)}/managed/apache/actions/reload`;
        return await this.executeServiceAction({ apiClient, tempFiles }, endpoint, "reload", "Apache");
    }
    async handleApacheStatus(args) {
        const params = ClusterOperationSchema.parse(args);
        console.error(`📊 Getting Apache status on ${params.cluster_id}/${params.server_character}`);
        try {
            const { apiClient, tempFiles } = await this.setupClusterConfig(params);
            const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
            const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
            const response = await apiClient.get(`/v1/clusters/${clusterId}/servers/${serverId}/managed/apache`);
            const state = response.data?.data?.status?.[0];
            await this.cleanupTempFiles(tempFiles);
            if (!state) {
                throw new Error("No Apache status data found");
            }
            const statusInfo = {
                version: state.version,
                state: state.instances?.[0]?.status,
                ports: state.instances?.[0]?.resources?.ports || [],
                hosts: state.instances?.[0]?.properties?.hosts?.map((host) => host.hostname) || [],
                redirects: state.instances?.[0]?.properties?.redirects?.map((redirect) => redirect.hostname) || [],
            };
            console.error(`✅ Apache status retrieved for ${params.cluster_id}/${params.server_character}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Apache Status on ${params.cluster_id}/${params.server_character}:
  Version: ${statusInfo.version}
  State: ${statusInfo.state}
  Ports: ${statusInfo.ports.join(", ")}
  Hosts: ${statusInfo.hosts.join(", ")}
  Redirects: ${statusInfo.redirects.join(", ")}`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to get Apache status on ${params.cluster_id}/${params.server_character}:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to get Apache status: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleServerInfo(args) {
        const schema = z.object({
            cluster_id: z.string().regex(/^[Cc]-\d+$/),
            server_character: z
                .string()
                .regex(/^(srv|db|cache|search|queue|storage)-[a-h]$/),
            personal_access_token: z.string().optional(),
        });
        try {
            const params = schema.parse(args);
            const token = params.personal_access_token || process.env.MAXCLUSTER_PAT;
            if (!token) {
                throw new McpError(ErrorCode.InvalidParams, ERROR_MESSAGES.AUTHENTICATION_FAILED);
            }
            const apiClient = this.createApiClient(token);
            const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
            const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
            const serverResponse = await apiClient.get(API_ENDPOINTS.SERVER_INFO(clusterId, serverId));
            const server = serverResponse.data?.data;
            if (!server) {
                throw new McpError(ErrorCode.InternalError, "Failed to retrieve server information");
            }
            let nvmeStorage = null;
            try {
                const volumeResponse = await apiClient.get(API_ENDPOINTS.SERVER_VOLUMES(clusterId));
                nvmeStorage = volumeResponse.data?.data;
            }
            catch (error) {
                console.warn("Could not retrieve volume information:", error);
            }
            const getServerType = (server) => {
                const character = server.character?.name || "";
                if (character.startsWith("srv"))
                    return "server";
                if (character.startsWith("db"))
                    return "database";
                if (character.startsWith("cache"))
                    return "cache";
                if (character.startsWith("search"))
                    return "search";
                if (character.startsWith("queue"))
                    return "queue";
                if (character.startsWith("storage"))
                    return "storage";
                return "server";
            };
            const serverInfo = {
                Server: server.character?.name || params.server_character,
                type: getServerType(server),
                hostname: server.hostname || "N/A",
                number: server.serverNumber || "N/A",
                disk: server.disk?.name || "N/A",
                cpu: server.cpu ? (server.cpu / 100).toString() : "N/A",
                ram: server.ram ? `${Math.round(server.ram / 1024)}GB` : "N/A",
                nvme_ssd: server.nvme ? `${Math.round(server.nvme / 1024)}GB` : "N/A",
                nvme_storage: nvmeStorage
                    ? `${nvmeStorage.size}MB (${nvmeStorage.date})`
                    : "N/A",
                networks: (() => {
                    const networks = [];
                    const serverNetworks = server.serverNetworks || [];
                    const ipv4Addresses = serverNetworks
                        .map((sn) => sn.network?.ipv4)
                        .filter(Boolean);
                    const ipv6Addresses = serverNetworks
                        .map((sn) => sn.network?.ipv6)
                        .filter(Boolean);
                    networks.push(...ipv4Addresses, ...ipv6Addresses);
                    return networks.length > 0 ? networks.join(", ") : "N/A";
                })(),
                id: server.id || "N/A",
            };
            const tableRows = Object.entries(serverInfo).map(([key, value]) => [
                key,
                value.toString(),
            ]);
            let output = `Server Information for ${server.character?.name || params.server_character}:\n`;
            output += "+" + "-".repeat(14) + "+" + "-".repeat(43) + "+\n";
            tableRows.forEach(([key, value]) => {
                const paddedKey = key.padEnd(12);
                const paddedValue = value.padEnd(41);
                output += `| ${paddedKey} | ${paddedValue} |\n`;
            });
            output += "+" + "-".repeat(14) + "+" + "-".repeat(43) + "+";
            return {
                content: [
                    {
                        type: "text",
                        text: output,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            throw new McpError(ErrorCode.InternalError, `Failed to get server info: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleListClusters(args) {
        const schema = z.object({
            personal_access_token: z.string().optional(),
        });
        try {
            const params = schema.parse(args);
            const clusters = await this.retrieveClusterInformation(params.personal_access_token);
            const clusterList = clusters.map((cluster) => ({
                id: `C-${cluster.id}`,
                name: cluster.name,
                label: cluster.label,
            }));
            return {
                content: [
                    {
                        type: "text",
                        text: `Available MaxCluster Clusters:\n${clusterList
                            .map((c) => `  ${c.id}: ${c.name} (${c.label})`)
                            .join("\n")}`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            throw new McpError(ErrorCode.InternalError, `Failed to list clusters: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleIntelligentServerOperation(args) {
        const params = IntelligentServerOperationSchema.parse(args);
        let tempFiles = [];
        console.error(`🚀 Starting intelligent server operation: "${params.server_request}"`);
        try {
            console.error("📊 Step 1: Retrieving cluster information...");
            const availableClusters = await this.retrieveClusterInformation(params.personal_access_token);
            console.error("✅ Step 1 Complete: Cluster information retrieved");
            console.error("🔍 Step 2: Parsing natural language request...");
            const request = parseServerRequest(params.server_request);
            console.error(`✅ Step 2 Complete: Parsed request - Operation: ${request.operation}, Server: ${request.serverName}`);
            console.error("🎯 Step 3: Determining cluster and server...");
            const resolved = await this.determineClusterAndServer(request, availableClusters);
            const confirmationMessage = generateConfirmationMessage(resolved.resolved);
            console.error("✅ Step 3 Complete: Cluster and server determined");
            console.error("⚡ Step 4: Executing server operation...");
            let result;
            const operationParams = {
                cluster_id: resolved.resolved.clusterId,
                server_character: resolved.resolved.serverCharacter,
                personal_access_token: params.personal_access_token,
            };
            switch (resolved.resolved.operation) {
                case "nginx_restart":
                    result = await this.handleNginxRestart(operationParams);
                    break;
                case "nginx_reload":
                    result = await this.handleNginxReload(operationParams);
                    break;
                case "php_restart":
                    result = await this.handlePhpRestart(operationParams);
                    break;
                case "php_reload":
                    result = await this.handlePhpReload(operationParams);
                    break;
                case "apache_restart":
                    result = await this.handleApacheRestart(operationParams);
                    break;
                case "apache_reload":
                    result = await this.handleApacheReload(operationParams);
                    break;
                case "apache_start":
                    result = await this.handleApacheStart(operationParams);
                    break;
                default:
                    throw new McpError(ErrorCode.InvalidParams, `Unsupported operation: ${resolved.resolved.operation}`);
            }
            console.error("✅ Step 4 Complete: Server operation executed");
            console.error("🧹 Step 5: Cleaning up temporary files...");
            await this.cleanupTempFiles(tempFiles);
            console.error("✅ Step 5 Complete: Cleanup finished");
            return {
                content: [
                    {
                        type: "text",
                        text: `${confirmationMessage}\n\n${result.content[0].text}`,
                    },
                ],
            };
        }
        catch (error) {
            console.error(`❌ Intelligent server operation failed for: "${params.server_request}"`, error);
            console.error("🧹 Emergency cleanup: Removing temporary files...");
            await this.cleanupTempFiles(tempFiles);
            if (error instanceof McpError) {
                throw error;
            }
            const errorInfo = extractApiErrorInfo(error);
            throw new McpError(ErrorCode.InternalError, `Intelligent server operation failed: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async retrieveClusterInformation(personalAccessToken) {
        const envPat = process.env.MAXCLUSTER_PAT;
        const providedPat = personalAccessToken;
        if (!providedPat && !envPat) {
            throw new McpError(ErrorCode.InvalidParams, ERROR_MESSAGES.AUTHENTICATION_FAILED);
        }
        const token = providedPat || envPat;
        try {
            validatePersonalAccessToken(token);
        }
        catch (error) {
            throw new McpError(ErrorCode.InvalidParams, ERROR_MESSAGES.INVALID_PAT);
        }
        const apiClient = this.createApiClient(token);
        try {
            const response = await apiClient.get(API_ENDPOINTS.CLUSTERS_LIST(), {
                params: { per_page: 100 },
            });
            return response.data?.data || [];
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            throw new McpError(ErrorCode.InternalError, `Failed to retrieve cluster information: ${errorInfo.message}`);
        }
    }
    async determineClusterAndServer(request, availableClusters) {
        console.error(`🔍 Resolving server mapping for: "${request.serverName}"`);
        const resolved = resolveServerOperation(request);
        const clusterNumber = resolved.clusterId.replace(/^[Cc]-/, "");
        const clusterExists = availableClusters.some((cluster) => cluster.id.toString() === clusterNumber);
        if (!clusterExists) {
            throw new McpError(ErrorCode.InvalidParams, `Cluster ${resolved.clusterId} not found in available clusters. Available clusters: ${availableClusters
                .map((c) => `C-${c.id}`)
                .join(", ")}`);
        }
        console.error(`✅ Cluster validation passed for ${resolved.clusterId}`);
        const clusterDetails = availableClusters.find((cluster) => cluster.id.toString() === clusterNumber);
        console.error(`🎯 Final resolution: ${resolved.clusterId}/${resolved.serverCharacter} → ${clusterDetails?.name || "Unknown"}`);
        return {
            resolved,
            clusterDetails,
        };
    }
    async cleanupTempFiles(tempFiles) {
        if (tempFiles.length === 0)
            return;
        try {
            const fs = await import("fs/promises");
            for (const filePath of tempFiles) {
                try {
                    if (filePath.includes("/tmp/") ||
                        filePath.includes("temp") ||
                        filePath.endsWith(".tmp") ||
                        filePath.endsWith(".md") ||
                        filePath.includes("test-")) {
                        await fs.unlink(filePath);
                        console.log(`🧹 Cleaned up temporary file: ${filePath}`);
                    }
                }
                catch (fileError) {
                    console.warn(`Warning: Could not clean up temp file ${filePath}:`, fileError);
                }
            }
        }
        catch (error) {
            console.warn("Warning: Error during temp file cleanup:", error);
        }
    }
    async handleListAvailableServers(_args) {
        try {
            const availableServers = getAvailableServers();
            if (availableServers.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "📋 No server mappings configured. Add server mappings to src/config/server-mappings.ts to use intelligent operations.",
                        },
                    ],
                };
            }
            const serverList = availableServers
                .map(({ name, mapping }) => {
                const description = mapping.description
                    ? ` - ${mapping.description}`
                    : "";
                return `• "${name}" → ${mapping.clusterId}/${mapping.serverCharacter}${description}`;
            })
                .join("\n");
            return {
                content: [
                    {
                        type: "text",
                        text: `📋 Available Server Mappings:\n\n${serverList}\n\n💡 You can use these server names with natural language commands like:\n• "restart nginx on promocell staging"\n• "reload nginx production"\n• "restart php staging server"`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            throw new McpError(ErrorCode.InternalError, `Failed to list available servers: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleMysqlStatus(args) {
        const params = ClusterOperationSchema.parse(args);
        console.error(`📊 Getting MySQL status on ${params.cluster_id}/${params.server_character}`);
        try {
            const { apiClient, tempFiles } = await this.setupClusterConfig(params);
            const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
            const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
            const response = await apiClient.get(API_ENDPOINTS.MYSQL_STATUS(clusterId, serverId));
            const state = response.data?.data?.status?.[0];
            await this.cleanupTempFiles(tempFiles);
            if (!state) {
                throw new Error("No MySQL status data found");
            }
            const version = state.version || "";
            const fork = version.match(/^10\./) ? "MariaDB" : "MySQL";
            const databases = state.instances?.[0]?.databases || [];
            console.error(`✅ MySQL status retrieved for ${params.cluster_id}/${params.server_character}`);
            let output = `MySQL/MariaDB Status on ${params.cluster_id}/${params.server_character}:\n`;
            output += `Version: ${fork} ${version}\n`;
            output += `State: ${state.instances?.[0]?.status || "unknown"}\n`;
            output += `Ports: ${state.instances?.[0]?.resources?.ports?.join(", ") || "N/A"}\n\n`;
            if (databases.length > 0) {
                output += `Databases (${databases.length}):\n`;
                databases.forEach((db) => {
                    output += `  - ${db.name}\n`;
                    output += `    Username: ${db.username}\n`;
                    if (db.description) {
                        output += `    Description: ${db.description}\n`;
                    }
                    output += "\n";
                });
            }
            else {
                output += "No databases found\n";
            }
            return {
                content: [
                    {
                        type: "text",
                        text: output,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to get MySQL status on ${params.cluster_id}/${params.server_character}:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to get MySQL status: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleMysqlRestart(args) {
        const params = ClusterOperationSchema.parse(args);
        const { apiClient, tempFiles } = await this.setupClusterConfig(params);
        const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
        const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
        return await this.executeServiceAction({ apiClient, tempFiles }, API_ENDPOINTS.MYSQL_RESTART(clusterId, serverId), "restart", "MySQL/MariaDB");
    }
    async handleMysqlCreateDatabase(args) {
        const DatabaseCreateSchema = ClusterOperationSchema.extend({
            description: z.string().optional().describe("Optional database description"),
        });
        const params = DatabaseCreateSchema.parse(args);
        console.error(`💾 Creating MySQL database on ${params.cluster_id}/${params.server_character}`);
        try {
            const { apiClient, tempFiles } = await this.setupClusterConfig(params);
            const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
            const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
            const requestData = {};
            if (params.description) {
                requestData.description = params.description;
            }
            const response = await apiClient.post(API_ENDPOINTS.MYSQL_DATABASES(clusterId, serverId), requestData);
            await this.cleanupTempFiles(tempFiles);
            const database = response.data?.data;
            if (!database) {
                throw new Error("No database data returned from API");
            }
            console.error(`✅ MySQL database created on ${params.cluster_id}/${params.server_character}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `MySQL Database Created Successfully:
Database: ${database.name}
Username: ${database.username}
Password: ${database.password}
${database.description ? `Description: ${database.description}` : ""}

Connection Details for Magento 2:
Host: [your-db-server-hostname]
Port: 3306
Database: ${database.name}
Username: ${database.username}
Password: ${database.password}`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to create MySQL database on ${params.cluster_id}/${params.server_character}:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to create MySQL database: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleMysqlListDatabases(args) {
        const params = ClusterOperationSchema.parse(args);
        console.error(`📋 Listing MySQL databases on ${params.cluster_id}/${params.server_character}`);
        try {
            const { apiClient, tempFiles } = await this.setupClusterConfig(params);
            const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
            const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
            const response = await apiClient.get(API_ENDPOINTS.MYSQL_STATUS(clusterId, serverId));
            const databases = response.data?.data?.status?.[0]?.instances?.[0]?.databases || [];
            await this.cleanupTempFiles(tempFiles);
            console.error(`✅ Listed ${databases.length} MySQL databases on ${params.cluster_id}/${params.server_character}`);
            if (databases.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `No databases found on ${params.cluster_id}/${params.server_character}`,
                        },
                    ],
                };
            }
            let output = `MySQL Databases on ${params.cluster_id}/${params.server_character}:\n\n`;
            databases.forEach((db, index) => {
                output += `${index + 1}. Database: ${db.name}\n`;
                output += `   Username: ${db.username}\n`;
                if (db.description) {
                    output += `   Description: ${db.description}\n`;
                }
                output += "\n";
            });
            return {
                content: [
                    {
                        type: "text",
                        text: output,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to list MySQL databases on ${params.cluster_id}/${params.server_character}:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to list MySQL databases: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleMysqlDeleteDatabase(args) {
        const DatabaseDeleteSchema = ClusterOperationSchema.extend({
            database_id: z.string().describe("Database ID to delete"),
        });
        const params = DatabaseDeleteSchema.parse(args);
        console.error(`🗑️ Deleting MySQL database ${params.database_id} on ${params.cluster_id}/${params.server_character}`);
        try {
            const { apiClient, tempFiles } = await this.setupClusterConfig(params);
            const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
            const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
            await apiClient.delete(API_ENDPOINTS.MYSQL_DATABASE(clusterId, serverId, params.database_id));
            await this.cleanupTempFiles(tempFiles);
            console.error(`✅ MySQL database ${params.database_id} deleted from ${params.cluster_id}/${params.server_character}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `MySQL database ${params.database_id} deleted successfully from ${params.cluster_id}/${params.server_character}`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to delete MySQL database ${params.database_id} from ${params.cluster_id}/${params.server_character}:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to delete MySQL database: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleRedisStatus(args) {
        const params = ClusterOperationSchema.parse(args);
        console.error(`📊 Getting Redis status on ${params.cluster_id}/${params.server_character}`);
        try {
            const { apiClient, tempFiles } = await this.setupClusterConfig(params);
            const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
            const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
            const response = await apiClient.get(API_ENDPOINTS.REDIS_STATUS(clusterId, serverId));
            const state = response.data?.data?.status?.[0];
            await this.cleanupTempFiles(tempFiles);
            if (!state) {
                throw new Error("No Redis status data found");
            }
            const instances = state.instances || [];
            console.error(`✅ Redis status retrieved for ${params.cluster_id}/${params.server_character}`);
            let output = `Redis Status on ${params.cluster_id}/${params.server_character}:\n`;
            output += `Version: ${state.currentVersion || "N/A"}\n`;
            output += `Instances: ${instances.length}/24\n\n`;
            if (instances.length > 0) {
                instances.forEach((instance) => {
                    output += `Instance on Port ${instance.resources?.ports?.[0]}:\n`;
                    output += `  Status: ${instance.status}\n`;
                    output += `  Description: ${instance.properties?.description || "N/A"}\n`;
                    output += `  Optimization: ${instance.properties?.optimization}\n`;
                    output += `  Memory: ${instance.properties?.malloc ? `${instance.properties.malloc}B` : "N/A"}\n`;
                    output += "\n";
                });
            }
            else {
                output += "No Redis instances found\n";
            }
            return {
                content: [
                    {
                        type: "text",
                        text: output,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to get Redis status on ${params.cluster_id}/${params.server_character}:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to get Redis status: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async createRedisInstance(params, optimization, memory, memoryPolicy, persistence, saveSeconds, saveKeys) {
        const { apiClient, tempFiles } = await this.setupClusterConfig(params);
        const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
        const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
        const requestData = {
            optimization,
            malloc: memory,
            maxmemoryPolicy: memoryPolicy,
            persistence,
            access: false,
        };
        if (params.description) {
            requestData.description = params.description;
        }
        if (persistence && saveSeconds && saveKeys) {
            requestData.saveSeconds = saveSeconds;
            requestData.saveKeys = saveKeys;
        }
        const response = await apiClient.post(API_ENDPOINTS.REDIS_INSTANCES(clusterId, serverId), requestData);
        await this.cleanupTempFiles(tempFiles);
        const port = response.data?.data?.resources?.ports?.[0];
        if (!port) {
            throw new Error("No port returned from Redis instance creation");
        }
        return port;
    }
    async handleRedisCreateCacheInstance(args) {
        const RedisCreateSchema = ClusterOperationSchema.extend({
            description: z.string().optional().describe("Optional instance description"),
        });
        const params = RedisCreateSchema.parse(args);
        console.error(`🔴 Creating Redis cache instance on ${params.cluster_id}/${params.server_character}`);
        try {
            const port = await this.createRedisInstance(params, "cache", "1073741824", "volatile-lru", false);
            console.error(`✅ Redis cache instance created on port ${port}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Redis Cache Instance Created Successfully:
Port: ${port}
Optimization: Cache
Memory: 1GB
Policy: volatile-lru
Persistence: Disabled

Magento 2 Configuration (app/etc/env.php):
'cache' => [
    'frontend' => [
        'default' => [
            'backend' => 'Cm_Cache_Backend_Redis',
            'backend_options' => [
                'server' => '127.0.0.1',
                'port' => '${port}',
                'database' => '0',
                'compress_data' => '1'
            ]
        ]
    ]
],`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to create Redis cache instance:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to create Redis cache instance: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleRedisCreateSessionInstance(args) {
        const RedisCreateSchema = ClusterOperationSchema.extend({
            description: z.string().optional().describe("Optional instance description"),
        });
        const params = RedisCreateSchema.parse(args);
        console.error(`🔴 Creating Redis session instance on ${params.cluster_id}/${params.server_character}`);
        try {
            const port = await this.createRedisInstance(params, "session", "536870912", "volatile-lru", true, "600", "1");
            console.error(`✅ Redis session instance created on port ${port}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Redis Session Instance Created Successfully:
Port: ${port}
Optimization: Session
Memory: 512MB
Policy: volatile-lru
Persistence: Enabled (600s, 1 key)

Magento 2 Configuration (app/etc/env.php):
'session' => [
    'save' => 'redis',
    'redis' => [
        'host' => '127.0.0.1',
        'port' => '${port}',
        'timeout' => '2.5',
        'persistent_identifier' => '',
        'database' => '0',
        'compression_threshold' => '2048',
        'compression_library' => 'gzip',
        'log_level' => '4',
        'max_concurrency' => '6',
        'break_after_frontend' => '5',
        'break_after_adminhtml' => '30',
        'first_lifetime' => '600',
        'bot_first_lifetime' => '60',
        'bot_lifetime' => '7200',
        'disable_locking' => '0',
        'min_lifetime' => '60',
        'max_lifetime' => '2592000'
    ]
],`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to create Redis session instance:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to create Redis session instance: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleRedisCreateFpcInstance(args) {
        const RedisCreateSchema = ClusterOperationSchema.extend({
            description: z.string().optional().describe("Optional instance description"),
        });
        const params = RedisCreateSchema.parse(args);
        console.error(`🔴 Creating Redis FPC instance on ${params.cluster_id}/${params.server_character}`);
        try {
            const port = await this.createRedisInstance(params, "full-page-cache", "1073741824", "volatile-lru", false);
            console.error(`✅ Redis FPC instance created on port ${port}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Redis Full-Page Cache Instance Created Successfully:
Port: ${port}
Optimization: Full-Page Cache
Memory: 1GB
Policy: volatile-lru
Persistence: Disabled

Magento 2 Configuration (app/etc/env.php):
'cache' => [
    'frontend' => [
        'page_cache' => [
            'backend' => 'Cm_Cache_Backend_Redis',
            'backend_options' => [
                'server' => '127.0.0.1',
                'port' => '${port}',
                'database' => '0',
                'compress_data' => '0'
            ]
        ]
    ]
],`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to create Redis FPC instance:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to create Redis FPC instance: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleRedisStartInstance(args) {
        const RedisInstanceSchema = ClusterOperationSchema.extend({
            port: z.number().describe("Redis instance port number"),
        });
        const params = RedisInstanceSchema.parse(args);
        const { apiClient, tempFiles } = await this.setupClusterConfig(params);
        const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
        const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
        try {
            await apiClient.post(API_ENDPOINTS.REDIS_INSTANCE_START(clusterId, serverId, params.port));
            await this.cleanupTempFiles(tempFiles);
            console.error(`✅ Redis instance on port ${params.port} started`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Redis instance on port ${params.port} started successfully`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to start Redis instance:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to start Redis instance: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleRedisStopInstance(args) {
        const RedisInstanceSchema = ClusterOperationSchema.extend({
            port: z.number().describe("Redis instance port number"),
        });
        const params = RedisInstanceSchema.parse(args);
        const { apiClient, tempFiles } = await this.setupClusterConfig(params);
        const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
        const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
        try {
            await apiClient.post(API_ENDPOINTS.REDIS_INSTANCE_STOP(clusterId, serverId, params.port));
            await this.cleanupTempFiles(tempFiles);
            console.error(`✅ Redis instance on port ${params.port} stopped`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Redis instance on port ${params.port} stopped successfully`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to stop Redis instance:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to stop Redis instance: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleRedisFlushInstance(args) {
        const RedisInstanceSchema = ClusterOperationSchema.extend({
            port: z.number().describe("Redis instance port number"),
        });
        const params = RedisInstanceSchema.parse(args);
        const { apiClient, tempFiles } = await this.setupClusterConfig(params);
        const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
        const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
        try {
            await apiClient.post(API_ENDPOINTS.REDIS_INSTANCE_FLUSH(clusterId, serverId, params.port));
            await this.cleanupTempFiles(tempFiles);
            console.error(`✅ Redis instance on port ${params.port} flushed`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Redis instance on port ${params.port} flushed successfully (all keys deleted)`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to flush Redis instance:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to flush Redis instance: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleRabbitmqStatus(args) {
        const params = ClusterOperationSchema.parse(args);
        console.error(`📊 Getting RabbitMQ status on ${params.cluster_id}/${params.server_character}`);
        try {
            const { apiClient, tempFiles } = await this.setupClusterConfig(params);
            const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
            const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
            const response = await apiClient.get(API_ENDPOINTS.RABBITMQ_STATUS(clusterId, serverId));
            const state = response.data?.data?.status?.[0];
            await this.cleanupTempFiles(tempFiles);
            if (!state) {
                throw new Error("No RabbitMQ status data found");
            }
            const instances = state.instances || [];
            console.error(`✅ RabbitMQ status retrieved for ${params.cluster_id}/${params.server_character}`);
            let output = `RabbitMQ Status on ${params.cluster_id}/${params.server_character}:\n`;
            instances.forEach((instance) => {
                const internalPorts = [4369, 25672, 5671, 61613, 61614, 1883, 8883];
                const ports = (instance.resources?.ports || []).filter((p) => !internalPorts.includes(p));
                output += `State: ${instance.status}\n`;
                output += `Ports: ${ports.join(", ")}\n\n`;
                const vhosts = instance.properties?.vhosts || [];
                output += `Virtual Hosts (${vhosts.length}):\n`;
                if (vhosts.length > 0) {
                    vhosts.forEach((vhost) => {
                        output += `  - ${vhost.name}\n`;
                    });
                }
                else {
                    output += "  (none)\n";
                }
                output += "\n";
                const users = instance.properties?.users || [];
                output += `Users (${users.length}):\n`;
                if (users.length > 0) {
                    users.forEach((user) => {
                        const tags = user.tags?.join(", ") || "";
                        output += `  - ${user.username}${tags ? ` (#${tags})` : ""}\n`;
                    });
                }
                else {
                    output += "  (none)\n";
                }
            });
            return {
                content: [
                    {
                        type: "text",
                        text: output,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to get RabbitMQ status on ${params.cluster_id}/${params.server_character}:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to get RabbitMQ status: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleRabbitmqStart(args) {
        const params = ClusterOperationSchema.parse(args);
        const { apiClient, tempFiles } = await this.setupClusterConfig(params);
        const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
        const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
        return await this.executeServiceAction({ apiClient, tempFiles }, API_ENDPOINTS.RABBITMQ_START(clusterId, serverId), "start", "RabbitMQ");
    }
    async handleRabbitmqStop(args) {
        const params = ClusterOperationSchema.parse(args);
        const { apiClient, tempFiles } = await this.setupClusterConfig(params);
        const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
        const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
        return await this.executeServiceAction({ apiClient, tempFiles }, API_ENDPOINTS.RABBITMQ_STOP(clusterId, serverId), "stop", "RabbitMQ");
    }
    async handleRabbitmqCreateVhost(args) {
        const VhostCreateSchema = ClusterOperationSchema.extend({
            vhost_name: z.string().describe("Virtual host name"),
            users: z.array(z.string()).optional().describe("Users to grant access"),
        });
        const params = VhostCreateSchema.parse(args);
        console.error(`🐰 Creating RabbitMQ vhost ${params.vhost_name} on ${params.cluster_id}/${params.server_character}`);
        try {
            const { apiClient, tempFiles } = await this.setupClusterConfig(params);
            const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
            const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
            const requestData = {
                name: params.vhost_name,
            };
            if (params.users && params.users.length > 0) {
                requestData.users = params.users;
            }
            await apiClient.post(API_ENDPOINTS.RABBITMQ_VHOSTS(clusterId, serverId), requestData);
            await this.cleanupTempFiles(tempFiles);
            console.error(`✅ RabbitMQ vhost ${params.vhost_name} created`);
            return {
                content: [
                    {
                        type: "text",
                        text: `RabbitMQ Virtual Host Created Successfully:
Vhost: ${params.vhost_name}
${params.users && params.users.length > 0 ? `Granted Access To: ${params.users.join(", ")}` : ""}`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to create RabbitMQ vhost ${params.vhost_name}:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to create RabbitMQ vhost: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleRabbitmqCreateUser(args) {
        const UserCreateSchema = ClusterOperationSchema.extend({
            username: z.string().describe("Username for RabbitMQ user"),
            tags: z.array(z.string()).optional().describe("User tags"),
        });
        const params = UserCreateSchema.parse(args);
        console.error(`🐰 Creating RabbitMQ user ${params.username} on ${params.cluster_id}/${params.server_character}`);
        try {
            const { apiClient, tempFiles } = await this.setupClusterConfig(params);
            const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
            const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
            const requestData = {
                username: params.username,
            };
            if (params.tags && params.tags.length > 0) {
                requestData.tags = params.tags;
            }
            const response = await apiClient.post(API_ENDPOINTS.RABBITMQ_USERS(clusterId, serverId), requestData);
            await this.cleanupTempFiles(tempFiles);
            const user = response.data?.data;
            if (!user) {
                throw new Error("No user data returned from API");
            }
            console.error(`✅ RabbitMQ user ${params.username} created`);
            return {
                content: [
                    {
                        type: "text",
                        text: `RabbitMQ User Created Successfully:
Username: ${user.username}
Password: ${user.password}
${user.tags ? `Tags: ${user.tags}` : ""}`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to create RabbitMQ user ${params.username}:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to create RabbitMQ user: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleRabbitmqSetupMagento(args) {
        const MagentoSetupSchema = ClusterOperationSchema.extend({
            vhost_name: z.string().describe("Virtual host name for Magento"),
            username: z.string().describe("Username for Magento RabbitMQ user"),
        });
        const params = MagentoSetupSchema.parse(args);
        console.error(`🐰 Setting up RabbitMQ for Magento 2 on ${params.cluster_id}/${params.server_character}`);
        try {
            const { apiClient, tempFiles } = await this.setupClusterConfig(params);
            const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
            const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
            console.error(`  Step 1/2: Creating user ${params.username}...`);
            const userResponse = await apiClient.post(API_ENDPOINTS.RABBITMQ_USERS(clusterId, serverId), { username: params.username });
            const user = userResponse.data?.data;
            if (!user) {
                throw new Error("No user data returned from API");
            }
            const password = user.password;
            console.error(`  Step 2/2: Creating vhost ${params.vhost_name} and granting permissions...`);
            await apiClient.post(API_ENDPOINTS.RABBITMQ_VHOSTS(clusterId, serverId), {
                name: params.vhost_name,
                users: [params.username],
            });
            await this.cleanupTempFiles(tempFiles);
            const serverInfo = await apiClient.get(API_ENDPOINTS.SERVER_INFO(clusterId, serverId));
            const hostname = serverInfo.data?.data?.hostname || "[rabbitmq-server-hostname]";
            console.error(`✅ RabbitMQ setup complete for Magento 2`);
            const encodedVhost = encodeURIComponent(params.vhost_name);
            return {
                content: [
                    {
                        type: "text",
                        text: `RabbitMQ Setup for Magento 2 Complete:

Created User:
  Username: ${params.username}
  Password: ${password}

Created Vhost:
  Vhost: ${params.vhost_name}
  Permissions: Full access granted to ${params.username}

AMQP Connection URL:
  amqp://${params.username}:${password}@${hostname}:5672/${encodedVhost}

Magento 2 Configuration (app/etc/env.php):
'queue' => [
    'amqp' => [
        'host' => '${hostname}',
        'port' => '5672',
        'user' => '${params.username}',
        'password' => '${password}',
        'virtualhost' => '${params.vhost_name}'
    ]
],`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to setup RabbitMQ for Magento 2:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to setup RabbitMQ for Magento 2: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async getSearchStatus(params, service) {
        const { apiClient, tempFiles } = await this.setupClusterConfig(params);
        const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
        const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
        const endpoint = service === "elasticsearch"
            ? API_ENDPOINTS.ELASTICSEARCH_STATUS(clusterId, serverId)
            : API_ENDPOINTS.OPENSEARCH_STATUS(clusterId, serverId);
        const response = await apiClient.get(endpoint);
        await this.cleanupTempFiles(tempFiles);
        return response.data?.data?.status?.[0];
    }
    async handleElasticsearchStatus(args) {
        const params = ClusterOperationSchema.parse(args);
        console.error(`📊 Getting Elasticsearch status on ${params.cluster_id}/${params.server_character}`);
        try {
            const state = await this.getSearchStatus(params, "elasticsearch");
            if (!state) {
                throw new Error("No Elasticsearch status data found");
            }
            const instances = state.instances || [];
            console.error(`✅ Elasticsearch status retrieved for ${params.cluster_id}/${params.server_character}`);
            let output = `Elasticsearch Status on ${params.cluster_id}/${params.server_character}:\n`;
            output += `Version: ${state.currentVersion || "N/A"}\n`;
            output += `Instances: ${instances.length}/${state.maxInstances || "N/A"}\n\n`;
            if (instances.length > 0) {
                instances.forEach((instance) => {
                    output += `Instance on Port ${instance.resources?.ports?.[0]}:\n`;
                    output += `  Status: ${instance.status}\n`;
                    output += `  Description: ${instance.properties?.description || "N/A"}\n`;
                    output += `  Heap Size: ${instance.properties?.heapSize || "N/A"}MB\n`;
                    output += `  API State: ${instance.api?.state || "N/A"}\n`;
                    output += `  Auto Snapshots: ${instance.properties?.autoSnapshots ? "enabled" : "disabled"}\n`;
                    output += "\n";
                });
            }
            else {
                output += "No Elasticsearch instances found\n";
            }
            return {
                content: [
                    {
                        type: "text",
                        text: output,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to get Elasticsearch status on ${params.cluster_id}/${params.server_character}:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to get Elasticsearch status: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleElasticsearchCreateInstance(args) {
        const CreateSchema = ClusterOperationSchema.extend({
            heap_size_mb: z.number().min(256).describe("Heap size in MB"),
            description: z.string().optional().describe("Optional instance description"),
        });
        const params = CreateSchema.parse(args);
        console.error(`🔍 Creating Elasticsearch instance on ${params.cluster_id}/${params.server_character}`);
        try {
            const { apiClient, tempFiles } = await this.setupClusterConfig(params);
            const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
            const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
            const requestData = {
                heap_size: params.heap_size_mb,
                auto_snapshots: false,
                access: false,
                ip_address: [],
            };
            if (params.description) {
                requestData.description = params.description;
            }
            const response = await apiClient.post(API_ENDPOINTS.ELASTICSEARCH_INSTANCES(clusterId, serverId), requestData);
            await this.cleanupTempFiles(tempFiles);
            const port = response.data?.data?.port;
            if (!port) {
                throw new Error("No port returned from Elasticsearch instance creation");
            }
            console.error(`✅ Elasticsearch instance created on port ${port}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Elasticsearch Instance Created Successfully:
Port: ${port}
Heap Size: ${params.heap_size_mb}MB
Auto Snapshots: Disabled

Magento 2 Configuration (app/etc/env.php):
'system' => [
    'default' => [
        'catalog' => [
            'search' => [
                'engine' => 'elasticsearch7',
                'elasticsearch7_server_hostname' => '127.0.0.1',
                'elasticsearch7_server_port' => '${port}',
                'elasticsearch7_index_prefix' => 'magento2',
                'elasticsearch7_enable_auth' => '0',
                'elasticsearch7_server_timeout' => '15'
            ]
        ]
    ]
],`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to create Elasticsearch instance:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to create Elasticsearch instance: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleElasticsearchStartInstance(args) {
        const InstanceSchema = ClusterOperationSchema.extend({
            port: z.number().describe("Elasticsearch instance port number"),
        });
        const params = InstanceSchema.parse(args);
        const { apiClient, tempFiles } = await this.setupClusterConfig(params);
        const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
        const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
        try {
            await apiClient.post(API_ENDPOINTS.ELASTICSEARCH_INSTANCE_START(clusterId, serverId, params.port));
            await this.cleanupTempFiles(tempFiles);
            console.error(`✅ Elasticsearch instance on port ${params.port} started`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Elasticsearch instance on port ${params.port} started successfully`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            throw new McpError(ErrorCode.InternalError, `Failed to start Elasticsearch instance: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleElasticsearchStopInstance(args) {
        const InstanceSchema = ClusterOperationSchema.extend({
            port: z.number().describe("Elasticsearch instance port number"),
        });
        const params = InstanceSchema.parse(args);
        const { apiClient, tempFiles } = await this.setupClusterConfig(params);
        const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
        const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
        try {
            await apiClient.post(API_ENDPOINTS.ELASTICSEARCH_INSTANCE_STOP(clusterId, serverId, params.port));
            await this.cleanupTempFiles(tempFiles);
            console.error(`✅ Elasticsearch instance on port ${params.port} stopped`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Elasticsearch instance on port ${params.port} stopped successfully`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            throw new McpError(ErrorCode.InternalError, `Failed to stop Elasticsearch instance: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleElasticsearchRestartInstance(args) {
        const InstanceSchema = ClusterOperationSchema.extend({
            port: z.number().describe("Elasticsearch instance port number"),
        });
        const params = InstanceSchema.parse(args);
        const { apiClient, tempFiles } = await this.setupClusterConfig(params);
        const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
        const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
        try {
            await apiClient.post(API_ENDPOINTS.ELASTICSEARCH_INSTANCE_RESTART(clusterId, serverId, params.port));
            await this.cleanupTempFiles(tempFiles);
            console.error(`✅ Elasticsearch instance on port ${params.port} restarted`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Elasticsearch instance on port ${params.port} restarted successfully`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            throw new McpError(ErrorCode.InternalError, `Failed to restart Elasticsearch instance: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleOpensearchStatus(args) {
        const params = ClusterOperationSchema.parse(args);
        console.error(`📊 Getting OpenSearch status on ${params.cluster_id}/${params.server_character}`);
        try {
            const state = await this.getSearchStatus(params, "opensearch");
            if (!state) {
                throw new Error("No OpenSearch status data found");
            }
            const instances = state.instances || [];
            console.error(`✅ OpenSearch status retrieved for ${params.cluster_id}/${params.server_character}`);
            let output = `OpenSearch Status on ${params.cluster_id}/${params.server_character}:\n`;
            output += `Version: ${state.currentVersion || "N/A"}\n`;
            output += `Instances: ${instances.length}/${state.maxInstances || "N/A"}\n\n`;
            if (instances.length > 0) {
                instances.forEach((instance) => {
                    output += `Instance on Port ${instance.resources?.ports?.[0]}:\n`;
                    output += `  Status: ${instance.status}\n`;
                    output += `  Description: ${instance.properties?.description || "N/A"}\n`;
                    output += `  Heap Size: ${instance.properties?.heapSize || "N/A"}MB\n`;
                    output += `  API State: ${instance.api?.state || "N/A"}\n`;
                    output += `  Auto Snapshots: ${instance.properties?.autoSnapshots ? "enabled" : "disabled"}\n`;
                    output += "\n";
                });
            }
            else {
                output += "No OpenSearch instances found\n";
            }
            return {
                content: [
                    {
                        type: "text",
                        text: output,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to get OpenSearch status on ${params.cluster_id}/${params.server_character}:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to get OpenSearch status: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleOpensearchCreateInstance(args) {
        const CreateSchema = ClusterOperationSchema.extend({
            heap_size_mb: z.number().min(256).describe("Heap size in MB"),
            description: z.string().optional().describe("Optional instance description"),
        });
        const params = CreateSchema.parse(args);
        console.error(`🔍 Creating OpenSearch instance on ${params.cluster_id}/${params.server_character}`);
        try {
            const { apiClient, tempFiles } = await this.setupClusterConfig(params);
            const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
            const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
            const requestData = {
                heap_size: params.heap_size_mb,
                auto_snapshots: false,
                access: false,
                ip_address: [],
            };
            if (params.description) {
                requestData.description = params.description;
            }
            const response = await apiClient.post(API_ENDPOINTS.OPENSEARCH_INSTANCES(clusterId, serverId), requestData);
            await this.cleanupTempFiles(tempFiles);
            const port = response.data?.data?.port;
            if (!port) {
                throw new Error("No port returned from OpenSearch instance creation");
            }
            console.error(`✅ OpenSearch instance created on port ${port}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `OpenSearch Instance Created Successfully:
Port: ${port}
Heap Size: ${params.heap_size_mb}MB
Auto Snapshots: Disabled

Magento 2 Configuration (app/etc/env.php):
'system' => [
    'default' => [
        'catalog' => [
            'search' => [
                'engine' => 'opensearch',
                'opensearch_server_hostname' => '127.0.0.1',
                'opensearch_server_port' => '${port}',
                'opensearch_index_prefix' => 'magento2',
                'opensearch_enable_auth' => '0',
                'opensearch_server_timeout' => '15'
            ]
        ]
    ]
],`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to create OpenSearch instance:`, error);
            throw new McpError(ErrorCode.InternalError, `Failed to create OpenSearch instance: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleOpensearchStartInstance(args) {
        const InstanceSchema = ClusterOperationSchema.extend({
            port: z.number().describe("OpenSearch instance port number"),
        });
        const params = InstanceSchema.parse(args);
        const { apiClient, tempFiles } = await this.setupClusterConfig(params);
        const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
        const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
        try {
            await apiClient.post(API_ENDPOINTS.OPENSEARCH_INSTANCE_START(clusterId, serverId, params.port));
            await this.cleanupTempFiles(tempFiles);
            console.error(`✅ OpenSearch instance on port ${params.port} started`);
            return {
                content: [
                    {
                        type: "text",
                        text: `OpenSearch instance on port ${params.port} started successfully`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            throw new McpError(ErrorCode.InternalError, `Failed to start OpenSearch instance: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleOpensearchStopInstance(args) {
        const InstanceSchema = ClusterOperationSchema.extend({
            port: z.number().describe("OpenSearch instance port number"),
        });
        const params = InstanceSchema.parse(args);
        const { apiClient, tempFiles } = await this.setupClusterConfig(params);
        const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
        const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
        try {
            await apiClient.post(API_ENDPOINTS.OPENSEARCH_INSTANCE_STOP(clusterId, serverId, params.port));
            await this.cleanupTempFiles(tempFiles);
            console.error(`✅ OpenSearch instance on port ${params.port} stopped`);
            return {
                content: [
                    {
                        type: "text",
                        text: `OpenSearch instance on port ${params.port} stopped successfully`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            throw new McpError(ErrorCode.InternalError, `Failed to stop OpenSearch instance: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleOpensearchRestartInstance(args) {
        const InstanceSchema = ClusterOperationSchema.extend({
            port: z.number().describe("OpenSearch instance port number"),
        });
        const params = InstanceSchema.parse(args);
        const { apiClient, tempFiles } = await this.setupClusterConfig(params);
        const clusterId = parseInt(params.cluster_id.replace(/^[Cc]-/, ""));
        const serverId = await this.getServerId(apiClient, clusterId, params.server_character);
        try {
            await apiClient.post(API_ENDPOINTS.OPENSEARCH_INSTANCE_RESTART(clusterId, serverId, params.port));
            await this.cleanupTempFiles(tempFiles);
            console.error(`✅ OpenSearch instance on port ${params.port} restarted`);
            return {
                content: [
                    {
                        type: "text",
                        text: `OpenSearch instance on port ${params.port} restarted successfully`,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            throw new McpError(ErrorCode.InternalError, `Failed to restart OpenSearch instance: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleMagentoEnvironmentCheck(args) {
        const EnvCheckSchema = z.object({
            cluster_id: z.string(),
            web_server: z.string(),
            db_server: z.string(),
            cache_server: z.string(),
            queue_server: z.string(),
            search_server: z.string(),
            search_engine: z.enum(["elasticsearch", "opensearch"]),
            personal_access_token: z.string().optional(),
        });
        const params = EnvCheckSchema.parse(args);
        console.error(`🔍 Checking Magento 2 environment on cluster ${params.cluster_id}`);
        const results = {
            mysql: { status: "pending", message: "" },
            redis: { status: "pending", message: "" },
            rabbitmq: { status: "pending", message: "" },
            search: { status: "pending", message: "" },
            php: { status: "pending", message: "" },
            webserver: { status: "pending", message: "" },
        };
        try {
            console.error("  Checking MySQL...");
            try {
                await this.handleMysqlStatus({
                    cluster_id: params.cluster_id,
                    server_character: params.db_server,
                    personal_access_token: params.personal_access_token,
                });
                results.mysql.status = "✅ PASS";
                results.mysql.message = "MySQL running";
            }
            catch (error) {
                results.mysql.status = "❌ FAIL";
                results.mysql.message = extractApiErrorInfo(error).message;
            }
            console.error("  Checking Redis...");
            try {
                await this.handleRedisStatus({
                    cluster_id: params.cluster_id,
                    server_character: params.cache_server,
                    personal_access_token: params.personal_access_token,
                });
                results.redis.status = "✅ PASS";
                results.redis.message = "Redis running";
            }
            catch (error) {
                results.redis.status = "❌ FAIL";
                results.redis.message = extractApiErrorInfo(error).message;
            }
            console.error("  Checking RabbitMQ...");
            try {
                await this.handleRabbitmqStatus({
                    cluster_id: params.cluster_id,
                    server_character: params.queue_server,
                    personal_access_token: params.personal_access_token,
                });
                results.rabbitmq.status = "✅ PASS";
                results.rabbitmq.message = "RabbitMQ running";
            }
            catch (error) {
                results.rabbitmq.status = "❌ FAIL";
                results.rabbitmq.message = extractApiErrorInfo(error).message;
            }
            console.error(`  Checking ${params.search_engine}...`);
            try {
                if (params.search_engine === "elasticsearch") {
                    await this.handleElasticsearchStatus({
                        cluster_id: params.cluster_id,
                        server_character: params.search_server,
                        personal_access_token: params.personal_access_token,
                    });
                }
                else {
                    await this.handleOpensearchStatus({
                        cluster_id: params.cluster_id,
                        server_character: params.search_server,
                        personal_access_token: params.personal_access_token,
                    });
                }
                results.search.status = "✅ PASS";
                results.search.message = `${params.search_engine} running`;
            }
            catch (error) {
                results.search.status = "❌ FAIL";
                results.search.message = extractApiErrorInfo(error).message;
            }
            console.error("  Checking PHP...");
            try {
                await this.handlePhpStatus({
                    cluster_id: params.cluster_id,
                    server_character: params.web_server,
                    personal_access_token: params.personal_access_token,
                });
                results.php.status = "✅ PASS";
                results.php.message = "PHP-FPM running";
            }
            catch (error) {
                results.php.status = "❌ FAIL";
                results.php.message = extractApiErrorInfo(error).message;
            }
            console.error("  Checking Apache...");
            try {
                await this.handleApacheStatus({
                    cluster_id: params.cluster_id,
                    server_character: params.web_server,
                    personal_access_token: params.personal_access_token,
                });
                results.webserver.status = "✅ PASS";
                results.webserver.message = "Apache running";
            }
            catch (error) {
                results.webserver.status = "⚠️ WARN";
                results.webserver.message = "Apache not active (NGINX may be active)";
            }
            const allPassed = Object.values(results).every((r) => r.status === "✅ PASS" || r.status === "⚠️ WARN");
            console.error(`${allPassed ? "✅" : "❌"} Environment check complete`);
            let output = `Magento 2 Environment Check - Cluster ${params.cluster_id}:\n\n`;
            output += `MySQL (${params.db_server}): ${results.mysql.status} - ${results.mysql.message}\n`;
            output += `Redis (${params.cache_server}): ${results.redis.status} - ${results.redis.message}\n`;
            output += `RabbitMQ (${params.queue_server}): ${results.rabbitmq.status} - ${results.rabbitmq.message}\n`;
            output += `${params.search_engine} (${params.search_server}): ${results.search.status} - ${results.search.message}\n`;
            output += `PHP (${params.web_server}): ${results.php.status} - ${results.php.message}\n`;
            output += `Web Server (${params.web_server}): ${results.webserver.status} - ${results.webserver.message}\n\n`;
            output += `Overall Status: ${allPassed ? "✅ READY FOR MAGENTO 2" : "❌ ISSUES FOUND"}\n`;
            return {
                content: [
                    {
                        type: "text",
                        text: output,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            throw new McpError(ErrorCode.InternalError, `Environment check failed: ${errorInfo.message || "Unknown error"}`);
        }
    }
    async handleMagentoPrepareEnvironment(args) {
        const PrepareSchema = z.object({
            cluster_id: z.string(),
            web_server: z.string(),
            db_server: z.string(),
            cache_server: z.string(),
            queue_server: z.string(),
            search_server: z.string(),
            search_engine: z.enum(["elasticsearch", "opensearch"]),
            search_heap_mb: z.number().default(2048),
            environment_name: z.string(),
            rabbitmq_vhost: z.string().default("/magento"),
            rabbitmq_user: z.string().default("magento"),
            personal_access_token: z.string().optional(),
        });
        const params = PrepareSchema.parse(args);
        console.error(`🚀 Preparing Magento 2 ${params.environment_name} environment on cluster ${params.cluster_id}`);
        const createdResources = {
            database: null,
            redis_cache: null,
            redis_session: null,
            redis_fpc: null,
            rabbitmq: null,
            search: null,
        };
        try {
            console.error(`  [1/6] Creating MySQL database...`);
            const dbResult = await this.handleMysqlCreateDatabase({
                cluster_id: params.cluster_id,
                server_character: params.db_server,
                description: `Magento 2 ${params.environment_name}`,
                personal_access_token: params.personal_access_token,
            });
            const dbData = dbResult.content[0].text;
            const dbMatch = dbData.match(/Database: (\S+)\nUsername: (\S+)\nPassword: (\S+)/);
            if (dbMatch) {
                createdResources.database = {
                    name: dbMatch[1],
                    username: dbMatch[2],
                    password: dbMatch[3],
                };
            }
            console.error(`    ✅ Database created: ${createdResources.database?.name}`);
            console.error(`  [2/6] Creating Redis cache instance...`);
            const cacheResult = await this.handleRedisCreateCacheInstance({
                cluster_id: params.cluster_id,
                server_character: params.cache_server,
                description: `Magento 2 ${params.environment_name} - Default Cache`,
                personal_access_token: params.personal_access_token,
            });
            const cachePort = cacheResult.content[0].text.match(/Port: (\d+)/)?.[1];
            createdResources.redis_cache = { port: cachePort };
            console.error(`    ✅ Cache instance created on port ${cachePort}`);
            console.error(`  [3/6] Creating Redis session instance...`);
            const sessionResult = await this.handleRedisCreateSessionInstance({
                cluster_id: params.cluster_id,
                server_character: params.cache_server,
                description: `Magento 2 ${params.environment_name} - Sessions`,
                personal_access_token: params.personal_access_token,
            });
            const sessionPort = sessionResult.content[0].text.match(/Port: (\d+)/)?.[1];
            createdResources.redis_session = { port: sessionPort };
            console.error(`    ✅ Session instance created on port ${sessionPort}`);
            console.error(`  [4/6] Creating Redis FPC instance...`);
            const fpcResult = await this.handleRedisCreateFpcInstance({
                cluster_id: params.cluster_id,
                server_character: params.cache_server,
                description: `Magento 2 ${params.environment_name} - Full Page Cache`,
                personal_access_token: params.personal_access_token,
            });
            const fpcPort = fpcResult.content[0].text.match(/Port: (\d+)/)?.[1];
            createdResources.redis_fpc = { port: fpcPort };
            console.error(`    ✅ FPC instance created on port ${fpcPort}`);
            console.error(`  [5/6] Setting up RabbitMQ...`);
            const rabbitmqResult = await this.handleRabbitmqSetupMagento({
                cluster_id: params.cluster_id,
                server_character: params.queue_server,
                vhost_name: params.rabbitmq_vhost,
                username: params.rabbitmq_user,
                personal_access_token: params.personal_access_token,
            });
            const rmqText = rabbitmqResult.content[0].text;
            const rmqMatch = rmqText.match(/Username: (\S+)\s+Password: (\S+)/);
            const rmqHostMatch = rmqText.match(/host' => '(\S+)'/);
            if (rmqMatch && rmqHostMatch) {
                createdResources.rabbitmq = {
                    username: rmqMatch[1],
                    password: rmqMatch[2],
                    vhost: params.rabbitmq_vhost,
                    host: rmqHostMatch[1],
                };
            }
            console.error(`    ✅ RabbitMQ vhost and user created`);
            console.error(`  [6/6] Creating ${params.search_engine} instance...`);
            const searchResult = params.search_engine === "elasticsearch"
                ? await this.handleElasticsearchCreateInstance({
                    cluster_id: params.cluster_id,
                    server_character: params.search_server,
                    heap_size_mb: params.search_heap_mb,
                    description: `Magento 2 ${params.environment_name} - Catalog Search`,
                    personal_access_token: params.personal_access_token,
                })
                : await this.handleOpensearchCreateInstance({
                    cluster_id: params.cluster_id,
                    server_character: params.search_server,
                    heap_size_mb: params.search_heap_mb,
                    description: `Magento 2 ${params.environment_name} - Catalog Search`,
                    personal_access_token: params.personal_access_token,
                });
            const searchPort = searchResult.content[0].text.match(/Port: (\d+)/)?.[1];
            createdResources.search = { port: searchPort, engine: params.search_engine };
            console.error(`    ✅ ${params.search_engine} instance created on port ${searchPort}`);
            console.error(`\n🎉 Magento 2 ${params.environment_name} environment ready!`);
            const searchEngineKey = params.search_engine === "elasticsearch" ? "elasticsearch7" : "opensearch";
            const output = `🎉 Magento 2 ${params.environment_name} Environment Prepared Successfully!

═══════════════════════════════════════════════════════════════════

📊 CREATED RESOURCES:

MySQL Database:
  Database: ${createdResources.database?.name}
  Username: ${createdResources.database?.username}
  Password: ${createdResources.database?.password}

Redis Instances:
  Default Cache:    Port ${createdResources.redis_cache?.port}
  Session Storage:  Port ${createdResources.redis_session?.port}
  Full-Page Cache:  Port ${createdResources.redis_fpc?.port}

RabbitMQ:
  Vhost:    ${createdResources.rabbitmq?.vhost}
  Username: ${createdResources.rabbitmq?.username}
  Password: ${createdResources.rabbitmq?.password}
  Host:     ${createdResources.rabbitmq?.host}

${params.search_engine === "elasticsearch" ? "Elasticsearch" : "OpenSearch"}:
  Port: ${createdResources.search?.port}
  Heap: ${params.search_heap_mb}MB

═══════════════════════════════════════════════════════════════════

📝 COMPLETE MAGENTO 2 CONFIGURATION (app/etc/env.php):

<?php
return [
    'db' => [
        'table_prefix' => '',
        'connection' => [
            'default' => [
                'host' => '${params.db_server}',
                'dbname' => '${createdResources.database?.name}',
                'username' => '${createdResources.database?.username}',
                'password' => '${createdResources.database?.password}',
                'model' => 'mysql4',
                'engine' => 'innodb',
                'initStatements' => 'SET NAMES utf8;',
                'active' => '1'
            ]
        ]
    ],
    'cache' => [
        'frontend' => [
            'default' => [
                'backend' => 'Cm_Cache_Backend_Redis',
                'backend_options' => [
                    'server' => '127.0.0.1',
                    'port' => '${createdResources.redis_cache?.port}',
                    'database' => '0',
                    'compress_data' => '1'
                ]
            ],
            'page_cache' => [
                'backend' => 'Cm_Cache_Backend_Redis',
                'backend_options' => [
                    'server' => '127.0.0.1',
                    'port' => '${createdResources.redis_fpc?.port}',
                    'database' => '0',
                    'compress_data' => '0'
                ]
            ]
        ]
    ],
    'session' => [
        'save' => 'redis',
        'redis' => [
            'host' => '127.0.0.1',
            'port' => '${createdResources.redis_session?.port}',
            'timeout' => '2.5',
            'database' => '0',
            'compression_threshold' => '2048',
            'compression_library' => 'gzip',
            'log_level' => '4',
            'max_concurrency' => '6',
            'break_after_frontend' => '5',
            'break_after_adminhtml' => '30',
            'disable_locking' => '0'
        ]
    ],
    'queue' => [
        'amqp' => [
            'host' => '${createdResources.rabbitmq?.host}',
            'port' => '5672',
            'user' => '${createdResources.rabbitmq?.username}',
            'password' => '${createdResources.rabbitmq?.password}',
            'virtualhost' => '${createdResources.rabbitmq?.vhost}'
        ]
    ],
    'system' => [
        'default' => [
            'catalog' => [
                'search' => [
                    'engine' => '${searchEngineKey}',
                    '${searchEngineKey}_server_hostname' => '127.0.0.1',
                    '${searchEngineKey}_server_port' => '${createdResources.search?.port}',
                    '${searchEngineKey}_index_prefix' => 'magento2',
                    '${searchEngineKey}_enable_auth' => '0',
                    '${searchEngineKey}_server_timeout' => '15'
                ]
            ]
        ]
    ]
];

═══════════════════════════════════════════════════════════════════

✨ Next Steps:
1. Copy the configuration above into app/etc/env.php
2. Run: bin/magento setup:upgrade
3. Run: bin/magento setup:di:compile
4. Run: bin/magento cache:flush
5. Run: bin/magento indexer:reindex

Your Magento 2 ${params.environment_name} environment is ready! 🚀`;
            return {
                content: [
                    {
                        type: "text",
                        text: output,
                    },
                ],
            };
        }
        catch (error) {
            const errorInfo = extractApiErrorInfo(error);
            console.error(`❌ Failed to prepare Magento 2 environment:`, error);
            console.error("⚠️ Resources created before failure:");
            if (createdResources.database)
                console.error(`  - Database: ${createdResources.database.name}`);
            if (createdResources.redis_cache)
                console.error(`  - Redis Cache: port ${createdResources.redis_cache.port}`);
            if (createdResources.redis_session)
                console.error(`  - Redis Session: port ${createdResources.redis_session.port}`);
            if (createdResources.redis_fpc)
                console.error(`  - Redis FPC: port ${createdResources.redis_fpc.port}`);
            if (createdResources.rabbitmq)
                console.error(`  - RabbitMQ: ${createdResources.rabbitmq.vhost}`);
            if (createdResources.search)
                console.error(`  - Search: port ${createdResources.search.port}`);
            throw new McpError(ErrorCode.InternalError, `Failed to prepare Magento 2 environment: ${errorInfo.message || "Unknown error"}. Some resources may have been created - use individual status tools to check.`);
        }
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("ClusterControl MCP Server running on stdio");
    }
}
const server = new ClusterControlMCPServer();
server.run().catch((error) => {
    console.error("Fatal error in MCP server:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map