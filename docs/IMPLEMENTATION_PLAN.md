# Magento 2 Cluster Control MCP - Implementation Plan

## 🎯 Project Goal
Extend the existing ClusterControl MCP server to support complete Magento 2 demo instance provisioning across all required infrastructure services.

## 📊 Current State Analysis

### ✅ Already Implemented
- **Web Server**: NGINX (restart, reload, status)
- **Web Server**: Apache (start, restart, reload, status)
- **PHP-FPM**: Comprehensive management (restart, reload, status, version management)
- **Authentication**: Personal Access Token system
- **Architecture**: Clean TypeScript implementation with MCP protocol compliance

### ❌ Missing Components for Magento 2
- **Database**: MySQL/MariaDB service management
- **Cache**: Redis service management
- **Queue**: RabbitMQ service management
- **Search**: Elasticsearch/OpenSearch service management
- **Orchestration**: High-level Magento 2 setup workflows

---

## 🏗️ Implementation Stages

## Stage 1: Discovery & API Analysis
**Goal**: Map available MaxCluster API endpoints for database, cache, queue, and search services
**Success Criteria**: Documented API endpoints and capabilities for each service
**Status**: Not Started

### Tasks
1. Extract and analyze cluster-control phar file structure
2. Identify Laravel commands for MySQL/MariaDB operations
3. Identify Laravel commands for Redis operations
4. Identify Laravel commands for RabbitMQ operations
5. Identify Laravel commands for Elasticsearch/OpenSearch operations
6. Document API endpoint patterns for each service
7. Create API capabilities matrix (what's supported vs. what's needed)

### Expected API Patterns
Based on existing implementation, expected endpoints:
- `/v1/clusters/{id}/servers/{id}/managed/mysql/*`
- `/v1/clusters/{id}/servers/{id}/managed/redis/*`
- `/v1/clusters/{id}/servers/{id}/managed/rabbitmq/*`
- `/v1/clusters/{id}/servers/{id}/managed/elasticsearch/*`

### Deliverables
- `MYSQL_API_ENDPOINTS.md` - Documented MySQL API operations
- `REDIS_API_ENDPOINTS.md` - Documented Redis API operations
- `RABBITMQ_API_ENDPOINTS.md` - Documented RabbitMQ API operations
- `ELASTICSEARCH_API_ENDPOINTS.md` - Documented Elasticsearch API operations

---

## Stage 2: MySQL/MariaDB Management Tools
**Goal**: Implement complete database management for Magento 2
**Success Criteria**: Can manage databases, users, and service lifecycle
**Status**: Not Started

### Tools to Implement

#### 1. `mysql_status`
- **Endpoint**: `GET /managed/mysql`
- **Purpose**: Get MySQL version, status, connection info
- **Returns**: Version, running state, uptime, max_connections, current connections
- **Priority**: HIGH

#### 2. `mysql_restart`
- **Endpoint**: `POST /managed/mysql/actions/restart`
- **Purpose**: Restart MySQL service
- **Warning**: Will drop all active connections
- **Priority**: HIGH

#### 3. `mysql_reload`
- **Endpoint**: `POST /managed/mysql/actions/reload`
- **Purpose**: Reload MySQL configuration (FLUSH PRIVILEGES)
- **Priority**: MEDIUM

#### 4. `mysql_create_database`
- **Endpoint**: `POST /managed/mysql/databases`
- **Purpose**: Create database + user + grant privileges (all-in-one)
- **Parameters**: database_name, username, password, permissions (optional)
- **Returns**: Database created, user created, connection string
- **Priority**: CRITICAL

#### 5. `mysql_list_databases`
- **Endpoint**: `GET /managed/mysql/databases`
- **Purpose**: List all databases
- **Returns**: Array of database names with sizes
- **Priority**: MEDIUM

#### 6. `mysql_drop_database`
- **Endpoint**: `DELETE /managed/mysql/databases/{name}`
- **Purpose**: Delete database
- **Warning**: DESTRUCTIVE operation, require confirmation
- **Priority**: MEDIUM

#### 7. `mysql_import_dump`
- **Endpoint**: `POST /managed/mysql/databases/{name}/import`
- **Purpose**: Import SQL dump file (for demo data)
- **Parameters**: database_name, dump_file_path or dump_content
- **Priority**: HIGH (for demo setup)

### Architecture Updates
- Add `DatabaseOperationSchema` extending `ClusterOperationSchema`
- Add `handleMysql*` method group
- Add MySQL endpoint constants to `constants.ts`
- Add database-specific error handling

### Testing Requirements
- Test database creation with various character sets (utf8mb4)
- Test user creation with different permission levels
- Test import with large SQL dumps
- Test connection validation

---

## Stage 3: Redis Cache Management Tools
**Goal**: Implement Redis management for Magento 2 caching
**Success Criteria**: Can control Redis service and manage cache operations
**Status**: Not Started

### Tools to Implement

#### 1. `redis_status`
- **Endpoint**: `GET /managed/redis`
- **Purpose**: Get Redis version, memory usage, key statistics
- **Returns**: Version, uptime, memory_used, keys_count, connected_clients
- **Priority**: HIGH

#### 2. `redis_restart`
- **Endpoint**: `POST /managed/redis/actions/restart`
- **Purpose**: Restart Redis service
- **Warning**: Will clear cache if persistence disabled
- **Priority**: HIGH

#### 3. `redis_flush_all`
- **Endpoint**: `POST /managed/redis/actions/flush`
- **Purpose**: Flush all Redis caches
- **Parameters**: database (optional, default all databases)
- **Priority**: HIGH (for demo reset)

#### 4. `redis_info`
- **Endpoint**: `GET /managed/redis/info`
- **Purpose**: Get detailed Redis INFO output
- **Returns**: Comprehensive Redis statistics
- **Priority**: MEDIUM

#### 5. `redis_config_set`
- **Endpoint**: `POST /managed/redis/config`
- **Purpose**: Set Redis configuration (maxmemory, eviction policy)
- **Parameters**: config_key, config_value
- **Priority**: MEDIUM

### Magento 2 Redis Configuration
Typical Magento 2 uses Redis for:
- **Default cache**: Database 0
- **Page cache**: Database 1
- **Session storage**: Database 2

Should support configuration of multiple Redis instances or databases.

### Architecture Updates
- Add `RedisOperationSchema`
- Add `handleRedis*` method group
- Add Redis endpoint constants
- Add cache-specific error handling

---

## Stage 4: RabbitMQ Queue Management Tools
**Goal**: Implement RabbitMQ management for Magento 2 async operations
**Success Criteria**: Can manage vhosts, users, queues, and service lifecycle
**Status**: Not Started

### Tools to Implement

#### 1. `rabbitmq_status`
- **Endpoint**: `GET /managed/rabbitmq`
- **Purpose**: Get RabbitMQ version, node health, queue counts
- **Returns**: Version, node_status, total_queues, total_messages
- **Priority**: HIGH

#### 2. `rabbitmq_restart`
- **Endpoint**: `POST /managed/rabbitmq/actions/restart`
- **Purpose**: Restart RabbitMQ service
- **Priority**: HIGH

#### 3. `rabbitmq_setup_magento`
- **Endpoint**: Composite operation (multiple API calls)
- **Purpose**: Create vhost + user + permissions for Magento
- **Parameters**: vhost_name, username, password
- **Operations**:
  1. Create vhost
  2. Create user
  3. Set permissions (configure, write, read all)
- **Returns**: Connection URL (amqp://username:password@host:5672/vhost)
- **Priority**: CRITICAL

#### 4. `rabbitmq_list_queues`
- **Endpoint**: `GET /managed/rabbitmq/queues`
- **Purpose**: List all queues with message counts
- **Returns**: Array of queues with statistics
- **Priority**: MEDIUM

#### 5. `rabbitmq_purge_queue`
- **Endpoint**: `POST /managed/rabbitmq/queues/{name}/purge`
- **Purpose**: Remove all messages from queue
- **Priority**: MEDIUM

#### 6. `rabbitmq_delete_queue`
- **Endpoint**: `DELETE /managed/rabbitmq/queues/{name}`
- **Purpose**: Delete queue
- **Priority**: LOW

### Architecture Updates
- Add `RabbitmqOperationSchema`
- Add `handleRabbitmq*` method group
- Add RabbitMQ endpoint constants
- Add queue-specific error handling
- Add multi-step transaction support (for setup_magento)

---

## Stage 5: Elasticsearch/OpenSearch Management Tools
**Goal**: Implement search engine management for Magento 2 catalog
**Success Criteria**: Can manage indices, check cluster health, control service
**Status**: Not Started

### Tools to Implement

#### 1. `elasticsearch_status`
- **Endpoint**: `GET /managed/elasticsearch`
- **Purpose**: Get cluster health, version, node count
- **Returns**: Version, cluster_status (green/yellow/red), nodes, indices_count
- **Priority**: HIGH

#### 2. `elasticsearch_restart`
- **Endpoint**: `POST /managed/elasticsearch/actions/restart`
- **Purpose**: Restart Elasticsearch service
- **Priority**: HIGH

#### 3. `elasticsearch_cluster_health`
- **Endpoint**: `GET /managed/elasticsearch/cluster/health`
- **Purpose**: Detailed cluster health check
- **Returns**: Status, node count, shard allocation, disk usage
- **Priority**: MEDIUM

#### 4. `elasticsearch_list_indices`
- **Endpoint**: `GET /managed/elasticsearch/indices`
- **Purpose**: List all indices with sizes and document counts
- **Returns**: Array of indices with statistics
- **Priority**: MEDIUM

#### 5. `elasticsearch_delete_index`
- **Endpoint**: `DELETE /managed/elasticsearch/indices/{name}`
- **Purpose**: Delete index (for demo reset)
- **Parameters**: index_name or pattern (e.g., "magento2_*")
- **Priority**: MEDIUM

#### 6. `elasticsearch_create_index`
- **Endpoint**: `POST /managed/elasticsearch/indices`
- **Purpose**: Create index with mappings
- **Parameters**: index_name, settings, mappings (optional)
- **Priority**: LOW (Magento creates indices automatically)

### Magento 2 Index Patterns
Typical Magento 2 indices:
- `magento2_product_*`
- `magento2_category_*`
- `magento2_cms_*`

### Architecture Updates
- Add `ElasticsearchOperationSchema`
- Add `handleElasticsearch*` method group
- Add Elasticsearch endpoint constants
- Add cluster health monitoring
- Support both Elasticsearch and OpenSearch

---

## Stage 6: High-Level Magento 2 Orchestration Tools
**Goal**: Provide simplified workflows for common Magento 2 operations
**Success Criteria**: Can setup complete Magento 2 environment with one command
**Status**: Not Started

### Orchestration Tools to Implement

#### 1. `magento_environment_check`
- **Purpose**: Verify all services are ready for Magento 2
- **Operations**:
  1. Check MySQL status and version (≥8.0 or MariaDB ≥10.4)
  2. Check Redis status
  3. Check RabbitMQ status
  4. Check Elasticsearch status (version 7.x or 8.x)
  5. Check PHP version (≥8.1)
  6. Check NGINX/Apache status
- **Returns**: Health report with pass/fail for each service
- **Priority**: HIGH

#### 2. `magento_prepare_environment`
- **Purpose**: One-shot setup of all services for Magento 2
- **Parameters**:
  - database_name
  - database_user
  - database_password
  - rabbitmq_vhost
  - rabbitmq_user
  - rabbitmq_password
- **Operations** (in order):
  1. Create MySQL database + user + grant
  2. Configure Redis (set eviction policy)
  3. Setup RabbitMQ vhost + user + permissions
  4. Verify Elasticsearch cluster health
  5. Ensure PHP-FPM is running
  6. Ensure NGINX/Apache is running
- **Returns**: Connection details for all services
- **Error Handling**: Rollback on failure (delete created resources)
- **Priority**: CRITICAL

#### 3. `magento_reset_demo`
- **Purpose**: Clean slate for demo environment
- **Operations**:
  1. Drop and recreate database
  2. Flush all Redis caches
  3. Purge all RabbitMQ queues
  4. Delete all Magento indices from Elasticsearch
- **Warning**: DESTRUCTIVE operation
- **Priority**: HIGH

#### 4. `magento_get_connection_info`
- **Purpose**: Get all connection strings/details for Magento configuration
- **Returns**:
  - MySQL connection: host, port, database, user, password
  - Redis connection: host, port, databases (0, 1, 2)
  - RabbitMQ connection: AMQP URL
  - Elasticsearch connection: host, port, protocol
- **Priority**: MEDIUM

### Orchestration Architecture
- Create `OrchestrationService` class
- Implement transaction/rollback support
- Add progress reporting for long operations
- Add dry-run mode (validate without executing)
- Add dependency resolution (ensure correct service order)

### Error Recovery Strategy
- Track all operations performed
- On failure, rollback in reverse order
- Provide detailed error context
- Suggest next steps for recovery

---

## 🔧 Technical Implementation Details

### Code Organization

```
mcp-server/src/
├── index.ts                          # Main MCP server (existing)
├── types/
│   ├── index.ts                      # Core types (existing)
│   ├── database.ts                   # NEW: MySQL types
│   ├── redis.ts                      # NEW: Redis types
│   ├── rabbitmq.ts                   # NEW: RabbitMQ types
│   └── elasticsearch.ts              # NEW: Elasticsearch types
├── utils/
│   ├── constants.ts                  # Configuration constants (existing)
│   ├── validation.ts                 # Input validation (existing)
│   ├── intelligent-operations.ts     # NLP parsing (existing)
│   ├── service-health.ts             # NEW: Service health checks
│   └── orchestration.ts              # NEW: Multi-service workflows
├── services/                         # NEW: Service-specific handlers
│   ├── mysql-service.ts              # MySQL/MariaDB operations
│   ├── redis-service.ts              # Redis operations
│   ├── rabbitmq-service.ts           # RabbitMQ operations
│   ├── elasticsearch-service.ts      # Elasticsearch operations
│   └── magento-orchestrator.ts       # High-level Magento workflows
└── config/
    └── server-mappings.ts            # Server mappings (existing)
```

### Schema Definitions

```typescript
// Database operations
const DatabaseOperationSchema = ClusterOperationSchema.extend({
  database_name: z.string().regex(/^[a-zA-Z0-9_]+$/),
  username: z.string().regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8),
});

// Redis operations
const RedisOperationSchema = ClusterOperationSchema.extend({
  database: z.number().min(0).max(15).optional(),
});

// RabbitMQ operations
const RabbitmqOperationSchema = ClusterOperationSchema.extend({
  vhost: z.string(),
  username: z.string(),
  password: z.string().min(8),
});

// Elasticsearch operations
const ElasticsearchOperationSchema = ClusterOperationSchema.extend({
  index_name: z.string().optional(),
});

// Magento orchestration
const MagentoSetupSchema = ClusterOperationSchema.extend({
  database_name: z.string(),
  database_user: z.string(),
  database_password: z.string(),
  rabbitmq_vhost: z.string().default('/magento'),
  rabbitmq_user: z.string(),
  rabbitmq_password: z.string(),
});
```

### Constants to Add

```typescript
export const DATABASE_ENDPOINTS = {
  STATUS: (clusterId: number, serverId: number) =>
    `/v1/clusters/${clusterId}/servers/${serverId}/managed/mysql`,
  RESTART: (clusterId: number, serverId: number) =>
    `/v1/clusters/${clusterId}/servers/${serverId}/managed/mysql/actions/restart`,
  DATABASES: (clusterId: number, serverId: number) =>
    `/v1/clusters/${clusterId}/servers/${serverId}/managed/mysql/databases`,
  // ... more endpoints
};

export const MAGENTO_REQUIREMENTS = {
  PHP_MIN_VERSION: '8.1',
  MYSQL_MIN_VERSION: '8.0',
  MARIADB_MIN_VERSION: '10.4',
  ELASTICSEARCH_VERSIONS: ['7.17', '8.4', '8.5', '8.7'],
  OPENSEARCH_VERSIONS: ['1.2', '2.4', '2.5'],
};
```

---

## 📚 Documentation Plan

### New Documentation Files

1. **MYSQL_OPERATIONS.md**
   - Database service management
   - User and permission management
   - Backup and restore procedures
   - Troubleshooting common issues

2. **REDIS_OPERATIONS.md**
   - Cache service management
   - Memory optimization
   - Eviction policies for Magento
   - Performance monitoring

3. **RABBITMQ_OPERATIONS.md**
   - Queue service management
   - Vhost and user setup
   - Queue monitoring and purging
   - Magento queue consumers

4. **ELASTICSEARCH_OPERATIONS.md**
   - Search service management
   - Index lifecycle management
   - Cluster health monitoring
   - Magento reindexing support

5. **MAGENTO2_SETUP_GUIDE.md**
   - Complete step-by-step setup
   - Service configuration examples
   - Environment variables
   - Troubleshooting guide
   - Performance tuning recommendations

6. **API_REFERENCE.md**
   - Complete tool listing
   - Parameter documentation
   - Example requests and responses
   - Error codes and messages

### Updated Documentation Files

1. **README.md**
   - Update tool listing with new services
   - Add Magento 2 quick start section
   - Update examples
   - Add service compatibility matrix

2. **PROJECT_SUMMARY.md**
   - Update architecture diagrams
   - Document new components
   - Update success metrics

---

## 🧪 Testing Strategy

### Discovery Phase Testing
- Verify phar extraction works
- Confirm API endpoint patterns
- Test authentication with each service endpoint

### Unit Testing (per service)
- Test each tool handler independently
- Mock API responses
- Verify error handling
- Validate input schemas

### Integration Testing
- Test service startup sequences
- Test orchestration workflows
- Test rollback mechanisms
- Test multi-service dependencies

### End-to-End Testing
- Test complete Magento 2 setup
- Test demo reset workflow
- Test error recovery
- Test with actual MaxCluster API

### Validation Checklist
- [ ] All services can be started/stopped
- [ ] Database creation works with Magento requirements
- [ ] Redis cache operations work
- [ ] RabbitMQ vhost/user creation works
- [ ] Elasticsearch indices can be managed
- [ ] Complete Magento 2 environment can be provisioned
- [ ] Error handling provides clear messages
- [ ] Rollback works on failures
- [ ] Documentation matches implementation

---

## 🎯 Success Criteria

### Functional Requirements
- ✅ Can start/stop/restart all Magento 2 required services
- ✅ Can create and configure MySQL database for Magento 2
- ✅ Can configure Redis for Magento caching
- ✅ Can setup RabbitMQ with proper vhost and permissions
- ✅ Can manage Elasticsearch indices
- ✅ Can provision complete Magento 2 environment with single command
- ✅ Can reset environment to clean state

### Technical Requirements
- ✅ All tools follow existing MCP patterns
- ✅ Comprehensive error handling
- ✅ Input validation for all parameters
- ✅ Type-safe TypeScript implementation
- ✅ Zero breaking changes to existing tools
- ✅ Performance: Most operations complete in <5 seconds
- ✅ Security: No credential leakage in logs or errors

### Documentation Requirements
- ✅ Complete API reference for all tools
- ✅ Step-by-step Magento 2 setup guide
- ✅ Service-specific operation guides
- ✅ Troubleshooting guides
- ✅ Examples for common scenarios

### User Experience Requirements
- ✅ Clear, actionable error messages
- ✅ Progress indicators for long operations
- ✅ Confirmation for destructive operations
- ✅ Connection strings provided after setup
- ✅ Health check reports easy to understand

---

## 🚨 Risks and Mitigations

### Risk 1: MaxCluster API Limitations
**Risk**: API may not expose all required operations
**Impact**: Cannot implement some tools
**Mitigation**:
- Discover API capabilities first (Stage 1)
- Document limitations clearly
- Provide alternative approaches where possible

### Risk 2: Service Dependencies
**Risk**: Services must start in specific order
**Impact**: Orchestration failures
**Mitigation**:
- Implement dependency resolution
- Add retry logic with exponential backoff
- Provide clear error messages about dependencies

### Risk 3: Credential Security
**Risk**: Passwords and tokens in API calls
**Impact**: Security vulnerability
**Mitigation**:
- Use HTTPS exclusively
- Never log credentials
- Support credential management best practices
- Validate credential strength

### Risk 4: Breaking Changes
**Risk**: Updates break existing tools
**Impact**: Users lose functionality
**Mitigation**:
- Comprehensive testing before releases
- Version compatibility matrix
- Deprecation warnings, not removals
- Keep existing tools working

### Risk 5: Complex Orchestration
**Risk**: Multi-service setup too complex
**Impact**: Hard to debug failures
**Mitigation**:
- Detailed logging at each step
- Atomic operations where possible
- Rollback support
- Dry-run mode for validation

---

## 📅 Estimated Timeline

### Stage 1: Discovery (2-3 days)
- Phar analysis: 1 day
- API endpoint mapping: 1 day
- Documentation: 1 day

### Stage 2: MySQL Tools (3-4 days)
- Implementation: 2 days
- Testing: 1 day
- Documentation: 1 day

### Stage 3: Redis Tools (2-3 days)
- Implementation: 1.5 days
- Testing: 0.5 days
- Documentation: 1 day

### Stage 4: RabbitMQ Tools (3-4 days)
- Implementation: 2 days
- Testing: 1 day
- Documentation: 1 day

### Stage 5: Elasticsearch Tools (2-3 days)
- Implementation: 1.5 days
- Testing: 0.5 days
- Documentation: 1 day

### Stage 6: Orchestration (4-5 days)
- Implementation: 2 days
- Testing: 2 days
- Documentation: 1 day

### Total: ~16-22 days
Buffer: Add 20% for unexpected issues = **20-27 days total**

---

## 🎓 Learning from Existing Code

### Patterns to Maintain
- ✅ Zod schemas for validation
- ✅ `setupClusterConfig` for auth
- ✅ `getServerId` for server resolution
- ✅ `executeServiceAction` for common operations
- ✅ `extractApiErrorInfo` for error handling
- ✅ Consistent error messages from constants

### Patterns to Improve
- 🔄 Reduce code duplication in handlers
- 🔄 Extract common service patterns
- 🔄 Add service factory pattern
- 🔄 Improve error context in failures
- 🔄 Add retry logic for transient failures

### New Patterns to Add
- ✨ Transaction/rollback support
- ✨ Health check utilities
- ✨ Service dependency resolution
- ✨ Progress reporting for long operations
- ✨ Dry-run mode for validation

---

## 📝 Notes and Considerations

### Magento 2 Specific Requirements
- PHP memory limit: 2GB+ recommended
- MySQL: utf8mb4 charset, innodb engine
- Redis: maxmemory-policy allkeys-lru
- Elasticsearch: Single-node setup OK for demo
- RabbitMQ: Default exchange sufficient

### MaxCluster Architecture
- Server types: srv-*, db-*, cache-*, search-*, queue-*
- Cluster hierarchy: Cluster → Server → Service
- API base: https://api.maxcluster.de/v1
- Authentication: Bearer token (PAT)

### Future Enhancements (Out of Scope for MVP)
- Varnish cache management
- SSL certificate management
- Backup scheduling
- Performance monitoring
- Auto-scaling configuration
- Multi-region support

---

## ✅ Definition of Done

A stage is complete when:
1. All tools are implemented and tested
2. Error handling covers all failure scenarios
3. Documentation is complete and reviewed
4. Manual testing passes with real API
5. Code reviewed and approved
6. No breaking changes to existing functionality
7. Performance is acceptable (<5s for most operations)
8. Security review passed (no credential leakage)

The entire project is complete when:
1. All 6 stages are done
2. End-to-end Magento 2 setup works
3. All documentation is published
4. Examples are tested and working
5. README is updated
6. Project is ready for production use

---

**Next Step**: Begin Stage 1 - Discovery & API Analysis by extracting and analyzing the cluster-control phar file.
