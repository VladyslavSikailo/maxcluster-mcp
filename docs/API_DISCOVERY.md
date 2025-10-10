# MaxCluster API Discovery - Service Management Endpoints

**Discovery Date**: 2025-10-10
**Source**: cluster-control Laravel application analysis
**API Version**: v1
**Base URL**: `https://api.maxcluster.de/v1`

## 🔍 Discovery Summary

Analyzed the cluster-control Laravel CLI application to identify all available API endpoints for MySQL, Redis, RabbitMQ, Elasticsearch, and OpenSearch services. All endpoints follow the pattern:

```
/v1/clusters/{cluster_id}/servers/{server_id}/managed/{service}/{resource|actions}
```

---

## 🗄️ MySQL/MariaDB Endpoints

### Status & Info
```
GET /v1/clusters/{cluster_id}/servers/{server_id}/managed/mysql
```
**Returns**:
- Version (MySQL vs MariaDB auto-detected)
- Service state (running, stopped)
- Ports
- List of databases with usernames

**Command**: `mysql:status`

### Service Control
```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/mysql/actions/restart
```
**Action**: Restart MySQL service

**Command**: `mysql:restart`

### Database Management
```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/mysql/databases
```
**Parameters**:
- `description` (optional): Database description

**Returns**:
- `name`: Database name (auto-generated)
- `username`: Database user (auto-generated)
- `password`: User password (auto-generated)
- `description`: Database description

**Command**: `mysql:new`

```
DELETE /v1/clusters/{cluster_id}/servers/{server_id}/managed/mysql/databases/{database_id}
```
**Action**: Delete database

**Command**: `mysql:delete`

### Notes
- Database creation automatically generates random database name, username, and password
- MySQL vs MariaDB is auto-detected by version (10.x = MariaDB)
- Each database gets its own dedicated user with full permissions

---

## 🔴 Redis Endpoints

### Status & Info
```
GET /v1/clusters/{cluster_id}/servers/{server_id}/managed/redis
```
**Returns**:
- Installation status
- Current version
- Instance limit (max 24 instances)
- Per-instance details:
  - Description
  - State (running, stopped)
  - Port
  - Optimization type (cache, session, fullpagecache, custom)
  - Memory size

**Command**: `redis:status`

```
GET /v1/clusters/{cluster_id}/servers/{server_id}/managed/redis/versions
```
**Returns**: List of available Redis versions

### Service Control
```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/redis/install
```
**Action**: Install Redis on server

**Command**: `redis:install`

```
DELETE /v1/clusters/{cluster_id}/servers/{server_id}/managed/redis/uninstall
```
**Action**: Uninstall Redis from server

**Command**: `redis:uninstall`

```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/redis/upgrade
```
**Action**: Upgrade Redis version

**Command**: `redis:upgrade`

### Instance Management
```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/redis/instances
```
**Parameters** (varies by optimization type):
- For cache: Optimized for cache workload
- For session: Optimized for session storage
- For fullpagecache: Optimized for full-page caching
- For custom: Custom configuration

**Commands**:
- `redis:new:cache`
- `redis:new:session`
- `redis:new:fullpagecache`
- `redis:new:custom`

```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/redis/instances/{port}/actions/start
```
**Action**: Start Redis instance

**Command**: `redis:start`

```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/redis/instances/{port}/actions/stop
```
**Action**: Stop Redis instance

**Command**: `redis:stop`

```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/redis/instances/{port}/actions/clear_data
```
**Action**: Flush all data from Redis instance (FLUSHALL)

**Command**: `redis:flush`

```
DELETE /v1/clusters/{cluster_id}/servers/{server_id}/managed/redis/instances/{port}
```
**Action**: Delete Redis instance

**Command**: `redis:delete`

### Notes
- Redis supports up to 24 instances per server
- Each instance runs on a different port
- Instances can be optimized for different workloads (cache, session, FPC)
- Instances are identified by port number

---

## 🐰 RabbitMQ Endpoints

### Status & Info
```
GET /v1/clusters/{cluster_id}/servers/{server_id}/managed/rabbitmq
```
**Returns**:
- Instance state (running, stopped)
- Ports (filters out internal ports: 4369, 25672, 5671, 61613, 61614, 1883, 8883)
- Virtual hosts list
- Users list with tags

**Command**: `rabbitmq:status`

### Service Control
```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/rabbitmq/install
```
**Action**: Install RabbitMQ on server

**Command**: `rabbitmq:install`

```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/rabbitmq/actions/start
```
**Action**: Start RabbitMQ service

**Command**: `rabbitmq:start`

```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/rabbitmq/actions/stop
```
**Action**: Stop RabbitMQ service

**Command**: `rabbitmq:stop`

### Virtual Host Management
```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/rabbitmq/vhosts
```
**Parameters**:
- `name` (required): Vhost name (regex: `/^\/? ([a-z0-9_\-\/\.])+$/i`)
- `users` (optional): Array of usernames to grant full access

**Action**: Create virtual host

**Command**: `rabbitmq:vhost:new`

```
DELETE /v1/clusters/{cluster_id}/servers/{server_id}/managed/rabbitmq/vhosts/{vhost_name}
```
**Action**: Delete virtual host

**Command**: `rabbitmq:vhost:delete`

### User Management
```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/rabbitmq/users
```
**Parameters**: (Need to analyze NewUserCommand.php for exact parameters)

**Action**: Create RabbitMQ user

**Command**: `rabbitmq:user:new`

```
DELETE /v1/clusters/{cluster_id}/servers/{server_id}/managed/rabbitmq/users/{username}
```
**Action**: Delete RabbitMQ user

**Command**: `rabbitmq:user:delete`

### Notes
- Vhost creation can automatically grant permissions to specified users
- Users have tags (e.g., administrator, monitoring)
- Vhost names support slashes and special characters

---

## 🔍 Elasticsearch Endpoints

### Status & Info
```
GET /v1/clusters/{cluster_id}/servers/{server_id}/managed/elasticsearch
```
**Returns**:
- Current version
- Available versions
- Upgradeable versions
- Instance limit and current count
- Per-instance details:
  - Description
  - State
  - Port
  - API state
  - Heap size
  - Auto snapshots (enabled/disabled)

**Command**: `elasticsearch:status`

```
GET /v1/clusters/{cluster_id}/servers/{server_id}/managed/elasticsearch/versions
```
**Returns**: Available and upgradeable Elasticsearch versions

```
GET /v1/clusters/{cluster_id}/servers/{server_id}/managed/elasticsearch/plugins
```
**Returns**: List of plugins with installation status (pre-installed, installed, not installed)

### Service Control
```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/elasticsearch/install
```
**Action**: Install Elasticsearch on server

**Command**: `elasticsearch:install`

```
DELETE /v1/clusters/{cluster_id}/servers/{server_id}/managed/elasticsearch/uninstall
```
**Action**: Uninstall Elasticsearch from server

**Command**: `elasticsearch:uninstall`

```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/elasticsearch/upgrade
```
**Action**: Upgrade Elasticsearch version

**Command**: `elasticsearch:upgrade`

### Instance Management
```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/elasticsearch/instances
```
**Action**: Create new Elasticsearch instance

**Command**: `elasticsearch:new`

```
DELETE /v1/clusters/{cluster_id}/servers/{server_id}/managed/elasticsearch/instances/{instance_id}
```
**Action**: Delete Elasticsearch instance

**Command**: `elasticsearch:delete`

```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/elasticsearch/instances/{instance_id}/actions/start
```
**Action**: Start Elasticsearch instance

**Command**: `elasticsearch:start`

```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/elasticsearch/instances/{instance_id}/actions/stop
```
**Action**: Stop Elasticsearch instance

**Command**: `elasticsearch:stop`

```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/elasticsearch/instances/{instance_id}/actions/restart
```
**Action**: Restart Elasticsearch instance

**Command**: `elasticsearch:restart`

```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/elasticsearch/instances/{instance_id}/actions/heapsize
```
**Action**: Set maximum heap size for instance

**Command**: `elasticsearch:heapsize`

### Plugin Management
```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/elasticsearch/plugins/{plugin_name}/install
```
**Action**: Install Elasticsearch plugin

**Command**: `elasticsearch:plugin:install`

```
DELETE /v1/clusters/{cluster_id}/servers/{server_id}/managed/elasticsearch/plugins/{plugin_name}
```
**Action**: Uninstall Elasticsearch plugin

**Command**: `elasticsearch:plugin:uninstall`

### Snapshot Management
```
GET /v1/clusters/{cluster_id}/servers/{server_id}/managed/elasticsearch/snapshots
```
**Action**: List existing snapshots

**Command**: `elasticsearch:snapshot:list`

```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/elasticsearch/snapshots
```
**Action**: Create snapshot

**Command**: `elasticsearch:snapshot:new`

```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/elasticsearch/snapshots/{snapshot_id}/restore
```
**Action**: Restore snapshot

**Command**: `elasticsearch:snapshot:restore`

---

## 🔍 OpenSearch Endpoints

OpenSearch endpoints follow the same pattern as Elasticsearch, replacing `elasticsearch` with `opensearch`:

### Status & Info
```
GET /v1/clusters/{cluster_id}/servers/{server_id}/managed/opensearch
GET /v1/clusters/{cluster_id}/servers/{server_id}/managed/opensearch/versions
GET /v1/clusters/{cluster_id}/servers/{server_id}/managed/opensearch/plugins
```

### Service Control
```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/opensearch/install
DELETE /v1/clusters/{cluster_id}/servers/{server_id}/managed/opensearch/uninstall
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/opensearch/upgrade
```

### Instance Management
```
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/opensearch/instances
DELETE /v1/clusters/{cluster_id}/servers/{server_id}/managed/opensearch/instances/{instance_id}
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/opensearch/instances/{instance_id}/actions/start
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/opensearch/instances/{instance_id}/actions/stop
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/opensearch/instances/{instance_id}/actions/restart
POST /v1/clusters/{cluster_id}/servers/{server_id}/managed/opensearch/instances/{instance_id}/actions/heapsize
```

### Plugin & Snapshot Management
Same as Elasticsearch, with `opensearch` replacing `elasticsearch` in paths.

**Commands**: Same as Elasticsearch with `opensearch:` prefix

---

## 🚨 Key Findings for Magento 2 Implementation

### ✅ AVAILABLE Operations

#### MySQL/MariaDB
- ✅ Status check
- ✅ Restart service
- ✅ Create database (auto-generates credentials)
- ✅ Delete database
- ❌ Import SQL dump (NOT FOUND - will need workaround)
- ❌ Manual user creation (handled automatically)

#### Redis
- ✅ Status check
- ✅ Install/uninstall Redis
- ✅ Create optimized instances (cache, session, FPC)
- ✅ Start/stop instances
- ✅ Flush all data (clear_data action)
- ✅ Delete instance
- ❌ Get INFO output (need to use status endpoint)
- ❌ Direct configuration (instances are pre-optimized)

#### RabbitMQ
- ✅ Status check
- ✅ Install RabbitMQ
- ✅ Start/stop service
- ✅ Create/delete virtual hosts
- ✅ Create/delete users
- ✅ Grant permissions (via vhost users parameter)
- ❌ List/purge queues (NOT FOUND in CLI)
- ❌ List exchanges (NOT FOUND in CLI)

#### Elasticsearch/OpenSearch
- ✅ Status check
- ✅ Install/uninstall
- ✅ Create/delete instances
- ✅ Start/stop/restart instances
- ✅ Plugin management
- ✅ Snapshot/restore
- ✅ Heap size configuration
- ❌ Direct index management (via HTTP API)
- ❌ Cluster health (via status endpoint)

---

## 📋 Implementation Strategy

###  Priority 1: Core Service Management
Implement status and restart for all services as these are critical for health checks and troubleshooting.

### Priority 2: Resource Creation
Implement database, Redis instance, RabbitMQ vhost/user creation for Magento setup.

### Priority 3: Data Management
Implement Redis flush, database delete for demo reset workflows.

### Priority 4: Advanced Features
Implement Elasticsearch/OpenSearch instance management, snapshots, plugins.

---

## ⚠️ Limitations & Workarounds

### Missing Endpoints

1. **MySQL Import Dump**: No direct API endpoint
   - **Workaround**: Provide connection details, let user import manually or via SSH
   - **Alternative**: Document manual import process

2. **RabbitMQ Queue Management**: No list/purge queue endpoints
   - **Workaround**: Use RabbitMQ Management HTTP API directly
   - **Alternative**: Access via RabbitMQ web UI

3. **Elasticsearch Index Management**: No direct index CRUD
   - **Workaround**: Use Elasticsearch HTTP API directly after instance creation
   - **Alternative**: Let Magento manage indices

4. **Redis Direct Configuration**: Instances are pre-optimized
   - **Workaround**: Use instance types (cache, session, FPC)
   - **Alternative**: Accept MaxCluster's optimizations

---

## 🎯 Recommended MCP Tools

Based on discovered endpoints, implement these tools:

### MySQL Tools (5 tools)
1. `mysql_status` - GET /managed/mysql
2. `mysql_restart` - POST /managed/mysql/actions/restart
3. `mysql_create_database` - POST /managed/mysql/databases
4. `mysql_delete_database` - DELETE /managed/mysql/databases/{id}
5. `mysql_list_databases` - Extracted from status endpoint

### Redis Tools (7 tools)
1. `redis_status` - GET /managed/redis
2. `redis_create_cache_instance` - POST /managed/redis/instances (cache)
3. `redis_create_session_instance` - POST /managed/redis/instances (session)
4. `redis_create_fpc_instance` - POST /managed/redis/instances (fullpagecache)
5. `redis_start_instance` - POST /managed/redis/instances/{port}/actions/start
6. `redis_stop_instance` - POST /managed/redis/instances/{port}/actions/stop
7. `redis_flush_instance` - POST /managed/redis/instances/{port}/actions/clear_data

### RabbitMQ Tools (5 tools)
1. `rabbitmq_status` - GET /managed/rabbitmq
2. `rabbitmq_start` - POST /managed/rabbitmq/actions/start
3. `rabbitmq_stop` - POST /managed/rabbitmq/actions/stop
4. `rabbitmq_create_vhost` - POST /managed/rabbitmq/vhosts
5. `rabbitmq_create_user` - POST /managed/rabbitmq/users

### Elasticsearch Tools (5 tools)
1. `elasticsearch_status` - GET /managed/elasticsearch
2. `elasticsearch_create_instance` - POST /managed/elasticsearch/instances
3. `elasticsearch_start` - POST /managed/elasticsearch/instances/{id}/actions/start
4. `elasticsearch_stop` - POST /managed/elasticsearch/instances/{id}/actions/stop
5. `elasticsearch_restart` - POST /managed/elasticsearch/instances/{id}/actions/restart

### OpenSearch Tools (5 tools)
Same as Elasticsearch, with opensearch prefix

---

## 📝 Next Steps

1. ✅ **Stage 1 Complete**: API endpoints discovered and documented
2. ⏭️ **Stage 2**: Implement MySQL management tools
3. ⏭️ **Stage 3**: Implement Redis management tools
4. ⏭️ **Stage 4**: Implement RabbitMQ management tools
5. ⏭️ **Stage 5**: Implement Elasticsearch/OpenSearch tools
6. ⏭️ **Stage 6**: Create Magento 2 orchestration workflows

---

**Status**: ✅ Discovery Complete
**Ready for Implementation**: YES
**Blocker Issues**: None - all critical endpoints available
