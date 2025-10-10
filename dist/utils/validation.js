import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { VALIDATION_PATTERNS, ERROR_MESSAGES, VALID_SERVER_CHARACTERS, } from "./constants.js";
export function validateAndParseClusterId(clusterId) {
    if (!clusterId || typeof clusterId !== "string") {
        throw new McpError(ErrorCode.InvalidParams, `${ERROR_MESSAGES.INVALID_CLUSTER_ID}, got: ${clusterId}`);
    }
    const match = clusterId.match(VALIDATION_PATTERNS.CLUSTER_ID);
    if (!match) {
        throw new McpError(ErrorCode.InvalidParams, `${ERROR_MESSAGES.INVALID_CLUSTER_ID}, got: ${clusterId}`);
    }
    const numericId = parseInt(match[1], 10);
    if (isNaN(numericId) || numericId <= 0) {
        throw new McpError(ErrorCode.InvalidParams, `${ERROR_MESSAGES.INVALID_CLUSTER_ID}, got: ${clusterId}`);
    }
    return numericId;
}
export function validatePersonalAccessToken(token) {
    if (!token || typeof token !== "string") {
        throw new McpError(ErrorCode.InvalidParams, ERROR_MESSAGES.INVALID_PAT);
    }
    if (!VALIDATION_PATTERNS.PERSONAL_ACCESS_TOKEN.test(token)) {
        throw new McpError(ErrorCode.InvalidParams, ERROR_MESSAGES.INVALID_PAT);
    }
}
export function validateServerCharacter(serverCharacter) {
    if (!serverCharacter || typeof serverCharacter !== "string") {
        throw new McpError(ErrorCode.InvalidParams, `${ERROR_MESSAGES.INVALID_SERVER_CHARACTER}, got: ${serverCharacter}`);
    }
    const normalizedCharacter = serverCharacter.toLowerCase();
    if (!VALID_SERVER_CHARACTERS.includes(normalizedCharacter)) {
        throw new McpError(ErrorCode.InvalidParams, `${ERROR_MESSAGES.INVALID_SERVER_CHARACTER}. Valid characters: ${VALID_SERVER_CHARACTERS.join(", ")}, got: ${serverCharacter}`);
    }
    return normalizedCharacter;
}
export function validateRequiredString(value, fieldName) {
    if (!value || typeof value !== "string" || value.trim().length === 0) {
        throw new McpError(ErrorCode.InvalidParams, `${fieldName} is required and must be a non-empty string`);
    }
    return value.trim();
}
export function validateClusterOperationParams(params) {
    const clusterId = validateAndParseClusterId(validateRequiredString(params.cluster_id, "cluster_id"));
    const serverCharacter = validateServerCharacter(validateRequiredString(params.server_character, "server_character"));
    const personalAccessToken = validateRequiredString(params.personal_access_token, "personal_access_token");
    validatePersonalAccessToken(personalAccessToken);
    return {
        clusterId,
        serverCharacter,
        personalAccessToken,
    };
}
export function validateClusterOperationParamsOptionalPat(params) {
    const clusterId = validateAndParseClusterId(validateRequiredString(params.cluster_id, "cluster_id"));
    const serverCharacter = validateServerCharacter(validateRequiredString(params.server_character, "server_character"));
    return {
        clusterId,
        serverCharacter,
    };
}
export function extractApiErrorInfo(error) {
    if (error &&
        typeof error === "object" &&
        "isAxiosError" in error &&
        error.isAxiosError) {
        const axiosError = error;
        return {
            isApiError: true,
            status: axiosError.response?.status,
            statusText: axiosError.response?.statusText,
            message: axiosError.response?.data?.message || axiosError.message,
        };
    }
    return {
        isApiError: false,
        message: error instanceof Error ? error.message : String(error),
    };
}
//# sourceMappingURL=validation.js.map