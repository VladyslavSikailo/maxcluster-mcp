export interface ServerMapping {
    clusterId: string;
    serverCharacter: string;
    description?: string;
}
export interface ServerMappings {
    [serverName: string]: ServerMapping;
}
export declare const SERVER_MAPPINGS: ServerMappings;
export declare function normalizeServerName(name: string): string;
export declare function findServerMapping(serverName: string): ServerMapping | null;
export declare function getAvailableServers(): Array<{
    name: string;
    mapping: ServerMapping;
}>;
//# sourceMappingURL=server-mappings.d.ts.map