export const SERVER_MAPPINGS = {
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
export function normalizeServerName(name) {
    return name.toLowerCase().trim();
}
export function findServerMapping(serverName) {
    const normalizedName = normalizeServerName(serverName);
    if (SERVER_MAPPINGS[normalizedName]) {
        return SERVER_MAPPINGS[normalizedName];
    }
    const mappingKeys = Object.keys(SERVER_MAPPINGS);
    for (const key of mappingKeys) {
        if (normalizedName === key) {
            return SERVER_MAPPINGS[key];
        }
    }
    for (const key of mappingKeys) {
        const keyWords = key.split(" ");
        const nameWords = normalizedName.split(" ");
        const allWordsPresent = keyWords.every((keyWord) => nameWords.some((nameWord) => nameWord.includes(keyWord)));
        if (allWordsPresent) {
            return SERVER_MAPPINGS[key];
        }
    }
    for (const key of mappingKeys) {
        if (normalizedName.includes(key)) {
            return SERVER_MAPPINGS[key];
        }
    }
    return null;
}
export function getAvailableServers() {
    return Object.entries(SERVER_MAPPINGS).map(([name, mapping]) => ({
        name,
        mapping,
    }));
}
//# sourceMappingURL=server-mappings.js.map