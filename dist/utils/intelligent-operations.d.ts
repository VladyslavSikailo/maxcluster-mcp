import type { ServerMapping } from "../config/server-mappings.js";
export interface IntelligentServerRequest {
    serverName: string;
    operation: "nginx_restart" | "nginx_reload" | "php_restart" | "php_reload" | "apache_restart" | "apache_reload" | "apache_start";
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
export declare function parseServerRequest(input: string): IntelligentServerRequest;
export declare function resolveServerOperation(request: IntelligentServerRequest): ResolvedServerOperation;
export declare function generateConfirmationMessage(resolved: ResolvedServerOperation): string;
export declare function extractServerName(input: string): string;
export declare function validateResolvedOperation(resolved: ResolvedServerOperation): void;
//# sourceMappingURL=intelligent-operations.d.ts.map