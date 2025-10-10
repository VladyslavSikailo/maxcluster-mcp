import { type ServerCharacter } from "./constants.js";
export declare function validateAndParseClusterId(clusterId: string): number;
export declare function validatePersonalAccessToken(token: string): void;
export declare function validateServerCharacter(serverCharacter: string): ServerCharacter;
export declare function validateRequiredString(value: unknown, fieldName: string): string;
export declare function validateClusterOperationParams(params: {
    cluster_id: unknown;
    server_character: unknown;
    personal_access_token: unknown;
}): {
    clusterId: number;
    serverCharacter: ServerCharacter;
    personalAccessToken: string;
};
export declare function validateClusterOperationParamsOptionalPat(params: {
    cluster_id: unknown;
    server_character: unknown;
    personal_access_token?: unknown;
}): {
    clusterId: number;
    serverCharacter: ServerCharacter;
};
export declare function extractApiErrorInfo(error: unknown): {
    isApiError: boolean;
    status?: number;
    statusText?: string;
    message?: string;
};
//# sourceMappingURL=validation.d.ts.map