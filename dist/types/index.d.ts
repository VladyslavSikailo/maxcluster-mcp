export interface MaxClusterServer {
    id: number;
    name: string;
    character: {
        name: string;
    };
    status: string;
    ip_address?: string;
    created_at: string;
    updated_at: string;
}
export interface MaxClusterCluster {
    id: number;
    name: string;
    status: string;
    created_at: string;
    updated_at: string;
}
export interface ApiResponse<T = any> {
    data: T;
    meta?: {
        current_page: number;
        per_page: number;
        total: number;
        total_pages: number;
    };
}
export interface ApiErrorResponse {
    message: string;
    errors?: Record<string, string[]>;
    code?: string;
}
export interface ClusterControlConfig {
    clusterId: number;
    serverId: number;
    serverCharacter: string;
    personalAccessToken: string;
}
export interface ApiClientConfig {
    baseURL: string;
    timeout: number;
    headers: Record<string, string>;
}
export interface BaseClusterParams {
    cluster_id: string;
    server_character: string;
    personal_access_token?: string;
}
export interface NginxRestartParams extends BaseClusterParams {
}
export interface NginxReloadParams extends BaseClusterParams {
}
export interface PhpRestartParams extends BaseClusterParams {
}
export interface ToolResponse {
    content: Array<{
        type: "text";
        text: string;
    }>;
}
export interface ServiceOperationResult {
    success: boolean;
    message: string;
    service: "nginx" | "php";
    action: "restart" | "reload";
    cluster_id: string;
    server_character: string;
    timestamp: string;
}
export interface ServiceOperationError {
    success: false;
    error: string;
    service: "nginx" | "php";
    action: "restart" | "reload";
    cluster_id?: string;
    server_character?: string;
    timestamp: string;
}
export type ServerCharacterType = "srv-a" | "srv-b" | "srv-c" | "srv-d" | "srv-e" | "srv-f" | "srv-g" | "srv-h" | "db-a" | "db-b" | "db-c" | "db-d" | "db-e" | "db-f" | "db-g" | "db-h" | "cache-a" | "cache-b" | "cache-c" | "cache-d" | "search-a" | "search-b" | "search-c" | "search-d" | "queue-a" | "queue-b" | "queue-c" | "queue-d" | "storage-a" | "storage-b" | "storage-c" | "storage-d";
export type ServiceType = "nginx" | "php";
export type ActionType = "restart" | "reload" | "start" | "stop" | "status";
export declare enum HttpStatusCode {
    OK = 200,
    CREATED = 201,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    TOO_MANY_REQUESTS = 429,
    INTERNAL_SERVER_ERROR = 500
}
export interface ApiEndpoints {
    nginxRestart: (clusterId: number, serverId: number) => string;
    nginxReload: (clusterId: number, serverId: number) => string;
    phpRestart: (clusterId: number, serverId: number) => string;
    serversList: (clusterId: number) => string;
}
export interface LogEntry {
    timestamp: string;
    level: "info" | "warn" | "error" | "debug";
    message: string;
    context?: Record<string, any>;
}
export interface ValidationResult<T = any> {
    isValid: boolean;
    data?: T;
    errors?: string[];
}
export interface ClusterValidationResult {
    clusterId: number;
    serverCharacter: ServerCharacterType;
    personalAccessToken: string;
}
export interface ServerInfo {
    id: number;
    character: string;
    fullName: string;
    status: string;
    services: string[];
}
export interface EnvironmentConfig {
    nodeEnv: "development" | "production" | "test";
    apiBaseUrl: string;
    requestTimeout: number;
    logLevel: "debug" | "info" | "warn" | "error";
}
//# sourceMappingURL=index.d.ts.map