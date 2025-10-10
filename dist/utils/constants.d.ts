export declare const VALID_SERVER_CHARACTERS: readonly ["srv-a", "srv-b", "srv-c", "srv-d", "srv-e", "srv-f", "srv-g", "srv-h", "db-a", "db-b", "db-c", "db-d", "db-e", "db-f", "db-g", "db-h", "cache-a", "cache-b", "cache-c", "cache-d", "search-a", "search-b", "search-c", "search-d", "queue-a", "queue-b", "queue-c", "queue-d", "storage-a", "storage-b", "storage-c", "storage-d"];
export declare const API_CONFIG: {
    readonly BASE_URL: "https://app.maxcluster.de/api/v1/";
    readonly TIMEOUT: 30000;
    readonly USER_AGENT: "clustercontrol-mcp-server/1.0.0";
};
export declare const VALIDATION_PATTERNS: {
    readonly CLUSTER_ID: RegExp;
    readonly PERSONAL_ACCESS_TOKEN: RegExp;
    readonly SERVER_CHARACTER: RegExp;
};
export declare const ERROR_MESSAGES: {
    readonly INVALID_CLUSTER_ID: "Invalid cluster ID format. Expected format: C-1234";
    readonly INVALID_PAT: "Invalid Personal Access Token format";
    readonly INVALID_SERVER_CHARACTER: "Invalid server character format";
    readonly AUTHENTICATION_FAILED: "Authentication failed. Please check your Personal Access Token.";
    readonly SERVER_NOT_FOUND: "Server not found in the specified cluster";
    readonly CLUSTER_NOT_FOUND: "Cluster not found or access denied";
    readonly API_REQUEST_FAILED: "API request failed";
};
export declare const API_ENDPOINTS: {
    readonly CLUSTERS_LIST: () => string;
    readonly NGINX_RESTART: (clusterId: number, serverId: number) => string;
    readonly NGINX_RELOAD: (clusterId: number, serverId: number) => string;
    readonly PHP_RESTART: (clusterId: number, serverId: number) => string;
    readonly SERVERS_LIST: (clusterId: number) => string;
    readonly SERVER_INFO: (clusterId: number, serverId: number) => string;
    readonly SERVER_VOLUMES: (clusterId: number) => string;
    readonly MYSQL_STATUS: (clusterId: number, serverId: number) => string;
    readonly MYSQL_RESTART: (clusterId: number, serverId: number) => string;
    readonly MYSQL_DATABASES: (clusterId: number, serverId: number) => string;
    readonly MYSQL_DATABASE: (clusterId: number, serverId: number, databaseId: string) => string;
    readonly REDIS_STATUS: (clusterId: number, serverId: number) => string;
    readonly REDIS_INSTANCES: (clusterId: number, serverId: number) => string;
    readonly REDIS_INSTANCE_START: (clusterId: number, serverId: number, port: number) => string;
    readonly REDIS_INSTANCE_STOP: (clusterId: number, serverId: number, port: number) => string;
    readonly REDIS_INSTANCE_FLUSH: (clusterId: number, serverId: number, port: number) => string;
    readonly REDIS_INSTANCE_DELETE: (clusterId: number, serverId: number, port: number) => string;
    readonly RABBITMQ_STATUS: (clusterId: number, serverId: number) => string;
    readonly RABBITMQ_START: (clusterId: number, serverId: number) => string;
    readonly RABBITMQ_STOP: (clusterId: number, serverId: number) => string;
    readonly RABBITMQ_VHOSTS: (clusterId: number, serverId: number) => string;
    readonly RABBITMQ_USERS: (clusterId: number, serverId: number) => string;
    readonly ELASTICSEARCH_STATUS: (clusterId: number, serverId: number) => string;
    readonly ELASTICSEARCH_INSTANCES: (clusterId: number, serverId: number) => string;
    readonly ELASTICSEARCH_INSTANCE_START: (clusterId: number, serverId: number, port: number) => string;
    readonly ELASTICSEARCH_INSTANCE_STOP: (clusterId: number, serverId: number, port: number) => string;
    readonly ELASTICSEARCH_INSTANCE_RESTART: (clusterId: number, serverId: number, port: number) => string;
    readonly OPENSEARCH_STATUS: (clusterId: number, serverId: number) => string;
    readonly OPENSEARCH_INSTANCES: (clusterId: number, serverId: number) => string;
    readonly OPENSEARCH_INSTANCE_START: (clusterId: number, serverId: number, port: number) => string;
    readonly OPENSEARCH_INSTANCE_STOP: (clusterId: number, serverId: number, port: number) => string;
    readonly OPENSEARCH_INSTANCE_RESTART: (clusterId: number, serverId: number, port: number) => string;
};
export declare const HTTP_STATUS: {
    readonly OK: 200;
    readonly CREATED: 201;
    readonly BAD_REQUEST: 400;
    readonly UNAUTHORIZED: 401;
    readonly FORBIDDEN: 403;
    readonly NOT_FOUND: 404;
    readonly TOO_MANY_REQUESTS: 429;
    readonly INTERNAL_SERVER_ERROR: 500;
};
export declare const SERVICES: {
    readonly NGINX: "NGINX";
    readonly PHP: "PHP-FPM";
    readonly APACHE: "Apache";
    readonly MYSQL: "MySQL/MariaDB";
    readonly REDIS: "Redis";
    readonly RABBITMQ: "RabbitMQ";
    readonly ELASTICSEARCH: "Elasticsearch";
    readonly OPENSEARCH: "OpenSearch";
};
export declare const ACTIONS: {
    readonly RESTART: "restart";
    readonly RELOAD: "reload";
    readonly START: "start";
    readonly STOP: "stop";
    readonly STATUS: "status";
};
export type ServerCharacter = (typeof VALID_SERVER_CHARACTERS)[number];
export type ServiceName = keyof typeof SERVICES;
export type ActionType = keyof typeof ACTIONS;
//# sourceMappingURL=constants.d.ts.map