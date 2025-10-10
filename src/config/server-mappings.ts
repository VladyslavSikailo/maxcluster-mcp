/**
 * Server mappings configuration
 * Maps friendly server names to their cluster IDs and server characters
 */

export interface ServerMapping {
  clusterId: string;
  serverCharacter: string;
  description?: string;
}

export interface ServerMappings {
  [serverName: string]: ServerMapping;
}

/**
 * Default server mappings
 * Add your server mappings here following the pattern below
 */
export const SERVER_MAPPINGS: ServerMappings = {
  // PromoCell server configurations based on available clusters
  "promocell staging": {
    clusterId: "C-2873",
    serverCharacter: "srv-a",
    description: "PromoCell - Stage",
  },
  "promocell staging server": {
    clusterId: "C-2873",
    serverCharacter: "srv-a",
    description: "PromoCell - Stage",
  },
  "promocell production": {
    clusterId: "C-2205",
    serverCharacter: "srv-a",
    description: "PromoCell - Production",
  },
  "promocell prod": {
    clusterId: "C-2205",
    serverCharacter: "srv-a",
    description: "PromoCell - Production",
  },
};

/**
 * Normalize server name for lookup
 * Converts to lowercase and handles common variations
 */
export function normalizeServerName(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Find server mapping by name
 * Supports partial matching and common variations
 */
export function findServerMapping(serverName: string): ServerMapping | null {
  const normalizedName = normalizeServerName(serverName);

  // Direct match
  if (SERVER_MAPPINGS[normalizedName]) {
    return SERVER_MAPPINGS[normalizedName];
  }

  // Partial matching - find the best match
  const mappingKeys = Object.keys(SERVER_MAPPINGS);

  // Exact word match
  for (const key of mappingKeys) {
    if (normalizedName === key) {
      return SERVER_MAPPINGS[key];
    }
  }

  // Contains match - check if the input contains all words from a mapping key
  for (const key of mappingKeys) {
    const keyWords = key.split(" ");
    const nameWords = normalizedName.split(" ");

    const allWordsPresent = keyWords.every((keyWord) =>
      nameWords.some((nameWord) => nameWord.includes(keyWord)),
    );

    if (allWordsPresent) {
      return SERVER_MAPPINGS[key];
    }
  }

  // Fuzzy match - check if input contains key words
  for (const key of mappingKeys) {
    if (normalizedName.includes(key)) {
      return SERVER_MAPPINGS[key];
    }
  }

  return null;
}

/**
 * Get all available server mappings for display
 */
export function getAvailableServers(): Array<{
  name: string;
  mapping: ServerMapping;
}> {
  return Object.entries(SERVER_MAPPINGS).map(([name, mapping]) => ({
    name,
    mapping,
  }));
}
