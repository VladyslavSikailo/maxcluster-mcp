// Server character constants based on MaxCluster server naming conventions
export const VALID_SERVER_CHARACTERS = [
  "srv-a",
  "srv-b",
  "srv-c",
  "srv-d",
  "srv-e",
  "srv-f",
  "srv-g",
  "srv-h",
  "db-a",
  "db-b",
  "db-c",
  "db-d",
  "db-e",
  "db-f",
  "db-g",
  "db-h",
  "cache-a",
  "cache-b",
  "cache-c",
  "cache-d",
  "search-a",
  "search-b",
  "search-c",
  "search-d",
  "queue-a",
  "queue-b",
  "queue-c",
  "queue-d",
  "storage-a",
  "storage-b",
  "storage-c",
  "storage-d",
] as const;

// API configuration
export const API_CONFIG = {
  BASE_URL: "https://app.maxcluster.de/api/v1/",
  TIMEOUT: 30000,
  USER_AGENT: "clustercontrol-mcp-server/1.0.0",
} as const;

// Regular expressions for validation
export const VALIDATION_PATTERNS = {
  CLUSTER_ID: /^c-(\d+)$/i,
  PERSONAL_ACCESS_TOKEN: /^(\d+\|[a-z0-9]{40,})$/i,
  SERVER_CHARACTER: /^(srv|db|cache|search|queue|storage)-[a-h]$/,
} as const;

// Error messages
export const ERROR_MESSAGES = {
  INVALID_CLUSTER_ID: "Invalid cluster ID format. Expected format: C-1234",
  INVALID_PAT: "Invalid Personal Access Token format",
  INVALID_SERVER_CHARACTER: "Invalid server character format",
  AUTHENTICATION_FAILED:
    "Authentication failed. Please check your Personal Access Token.",
  SERVER_NOT_FOUND: "Server not found in the specified cluster",
  CLUSTER_NOT_FOUND: "Cluster not found or access denied",
  API_REQUEST_FAILED: "API request failed",
} as const;

// API endpoints
export const API_ENDPOINTS = {
  CLUSTERS_LIST: () => `clusters`,
  NGINX_RESTART: (clusterId: number, serverId: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/nginx/actions/restart`,
  NGINX_RELOAD: (clusterId: number, serverId: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/nginx/actions/reload`,
  PHP_RESTART: (clusterId: number, serverId: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/php/actions/restart`,
  SERVERS_LIST: (clusterId: number) => `clusters/${clusterId}/servers`,
  SERVER_INFO: (clusterId: number, serverId: number) =>
    `clusters/${clusterId}/servers/${serverId}`,
  SERVER_VOLUMES: (clusterId: number) =>
    `clusters/${clusterId}/volumes/actions/size`,

  // MySQL/MariaDB endpoints
  MYSQL_STATUS: (clusterId: number, serverId: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/mysql`,
  MYSQL_RESTART: (clusterId: number, serverId: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/mysql/actions/restart`,
  MYSQL_DATABASES: (clusterId: number, serverId: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/mysql/databases`,
  MYSQL_DATABASE: (clusterId: number, serverId: number, databaseId: string) =>
    `clusters/${clusterId}/servers/${serverId}/managed/mysql/databases/${databaseId}`,

  // Redis endpoints
  REDIS_STATUS: (clusterId: number, serverId: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/redis`,
  REDIS_INSTANCES: (clusterId: number, serverId: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/redis/instances`,
  REDIS_INSTANCE_START: (clusterId: number, serverId: number, port: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/redis/instances/${port}/actions/start`,
  REDIS_INSTANCE_STOP: (clusterId: number, serverId: number, port: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/redis/instances/${port}/actions/stop`,
  REDIS_INSTANCE_FLUSH: (clusterId: number, serverId: number, port: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/redis/instances/${port}/actions/clear_data`,
  REDIS_INSTANCE_DELETE: (clusterId: number, serverId: number, port: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/redis/instances/${port}`,

  // RabbitMQ endpoints
  RABBITMQ_STATUS: (clusterId: number, serverId: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/rabbitmq`,
  RABBITMQ_START: (clusterId: number, serverId: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/rabbitmq/actions/start`,
  RABBITMQ_STOP: (clusterId: number, serverId: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/rabbitmq/actions/stop`,
  RABBITMQ_VHOSTS: (clusterId: number, serverId: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/rabbitmq/vhosts`,
  RABBITMQ_USERS: (clusterId: number, serverId: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/rabbitmq/users`,

  // Elasticsearch endpoints
  ELASTICSEARCH_STATUS: (clusterId: number, serverId: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/elasticsearch`,
  ELASTICSEARCH_INSTANCES: (clusterId: number, serverId: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/elasticsearch/instances`,
  ELASTICSEARCH_INSTANCE_START: (clusterId: number, serverId: number, port: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/elasticsearch/instances/${port}/actions/start`,
  ELASTICSEARCH_INSTANCE_STOP: (clusterId: number, serverId: number, port: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/elasticsearch/instances/${port}/actions/stop`,
  ELASTICSEARCH_INSTANCE_RESTART: (clusterId: number, serverId: number, port: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/elasticsearch/instances/${port}/actions/restart`,

  // OpenSearch endpoints
  OPENSEARCH_STATUS: (clusterId: number, serverId: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/opensearch`,
  OPENSEARCH_INSTANCES: (clusterId: number, serverId: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/opensearch/instances`,
  OPENSEARCH_INSTANCE_START: (clusterId: number, serverId: number, port: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/opensearch/instances/${port}/actions/start`,
  OPENSEARCH_INSTANCE_STOP: (clusterId: number, serverId: number, port: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/opensearch/instances/${port}/actions/stop`,
  OPENSEARCH_INSTANCE_RESTART: (clusterId: number, serverId: number, port: number) =>
    `clusters/${clusterId}/servers/${serverId}/managed/opensearch/instances/${port}/actions/restart`,
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Service names for better error messages and logging
export const SERVICES = {
  NGINX: "NGINX",
  PHP: "PHP-FPM",
  APACHE: "Apache",
  MYSQL: "MySQL/MariaDB",
  REDIS: "Redis",
  RABBITMQ: "RabbitMQ",
  ELASTICSEARCH: "Elasticsearch",
  OPENSEARCH: "OpenSearch",
} as const;

// Action types
export const ACTIONS = {
  RESTART: "restart",
  RELOAD: "reload",
  START: "start",
  STOP: "stop",
  STATUS: "status",
} as const;

export type ServerCharacter = (typeof VALID_SERVER_CHARACTERS)[number];
export type ServiceName = keyof typeof SERVICES;
export type ActionType = keyof typeof ACTIONS;
