import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import {
  VALIDATION_PATTERNS,
  ERROR_MESSAGES,
  VALID_SERVER_CHARACTERS,
  type ServerCharacter,
} from "./constants.js";

/**
 * Validates and parses a cluster ID string
 * @param clusterId - The cluster ID string (e.g., "C-1234")
 * @returns The numeric cluster ID
 * @throws McpError if the format is invalid
 */
export function validateAndParseClusterId(clusterId: string): number {
  if (!clusterId || typeof clusterId !== "string") {
    throw new McpError(
      ErrorCode.InvalidParams,
      `${ERROR_MESSAGES.INVALID_CLUSTER_ID}, got: ${clusterId}`,
    );
  }

  const match = clusterId.match(VALIDATION_PATTERNS.CLUSTER_ID);
  if (!match) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `${ERROR_MESSAGES.INVALID_CLUSTER_ID}, got: ${clusterId}`,
    );
  }

  const numericId = parseInt(match[1], 10);
  if (isNaN(numericId) || numericId <= 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `${ERROR_MESSAGES.INVALID_CLUSTER_ID}, got: ${clusterId}`,
    );
  }

  return numericId;
}

/**
 * Validates a Personal Access Token format
 * @param token - The PAT string
 * @throws McpError if the format is invalid
 */
export function validatePersonalAccessToken(token: string): void {
  if (!token || typeof token !== "string") {
    throw new McpError(ErrorCode.InvalidParams, ERROR_MESSAGES.INVALID_PAT);
  }

  if (!VALIDATION_PATTERNS.PERSONAL_ACCESS_TOKEN.test(token)) {
    throw new McpError(ErrorCode.InvalidParams, ERROR_MESSAGES.INVALID_PAT);
  }
}

/**
 * Validates a server character string
 * @param serverCharacter - The server character string (e.g., "srv-a")
 * @returns The validated server character
 * @throws McpError if the format is invalid
 */
export function validateServerCharacter(
  serverCharacter: string,
): ServerCharacter {
  if (!serverCharacter || typeof serverCharacter !== "string") {
    throw new McpError(
      ErrorCode.InvalidParams,
      `${ERROR_MESSAGES.INVALID_SERVER_CHARACTER}, got: ${serverCharacter}`,
    );
  }

  const normalizedCharacter = serverCharacter.toLowerCase();

  if (
    !VALID_SERVER_CHARACTERS.includes(normalizedCharacter as ServerCharacter)
  ) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `${ERROR_MESSAGES.INVALID_SERVER_CHARACTER}. Valid characters: ${VALID_SERVER_CHARACTERS.join(", ")}, got: ${serverCharacter}`,
    );
  }

  return normalizedCharacter as ServerCharacter;
}

/**
 * Validates if a string is not empty and properly formatted
 * @param value - The string to validate
 * @param fieldName - The name of the field for error messages
 * @throws McpError if the string is invalid
 */
export function validateRequiredString(
  value: unknown,
  fieldName: string,
): string {
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `${fieldName} is required and must be a non-empty string`,
    );
  }
  return value.trim();
}

/**
 * Validates all common parameters for cluster operations
 * @param params - Object containing cluster_id, server_character, and personal_access_token
 * @returns Validated parameters
 */
export function validateClusterOperationParams(params: {
  cluster_id: unknown;
  server_character: unknown;
  personal_access_token: unknown;
}): {
  clusterId: number;
  serverCharacter: ServerCharacter;
  personalAccessToken: string;
} {
  const clusterId = validateAndParseClusterId(
    validateRequiredString(params.cluster_id, "cluster_id"),
  );

  const serverCharacter = validateServerCharacter(
    validateRequiredString(params.server_character, "server_character"),
  );

  const personalAccessToken = validateRequiredString(
    params.personal_access_token,
    "personal_access_token",
  );
  validatePersonalAccessToken(personalAccessToken);

  return {
    clusterId,
    serverCharacter,
    personalAccessToken,
  };
}

/**
 * Validates cluster operation parameters with optional PAT
 * @param params - Object containing cluster_id, server_character, and optional personal_access_token
 * @returns Validated parameters without PAT validation
 */
export function validateClusterOperationParamsOptionalPat(params: {
  cluster_id: unknown;
  server_character: unknown;
  personal_access_token?: unknown;
}): {
  clusterId: number;
  serverCharacter: ServerCharacter;
} {
  const clusterId = validateAndParseClusterId(
    validateRequiredString(params.cluster_id, "cluster_id"),
  );

  const serverCharacter = validateServerCharacter(
    validateRequiredString(params.server_character, "server_character"),
  );

  return {
    clusterId,
    serverCharacter,
  };
}

/**
 * Checks if an error is an Axios error and extracts meaningful error information
 * @param error - The error to check
 * @returns Object with error information
 */
export function extractApiErrorInfo(error: unknown): {
  isApiError: boolean;
  status?: number;
  statusText?: string;
  message?: string;
} {
  // Check if it's an axios error
  if (
    error &&
    typeof error === "object" &&
    "isAxiosError" in error &&
    error.isAxiosError
  ) {
    const axiosError = error as any;
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
