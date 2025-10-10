# Changelog

All notable changes to the MaxCluster MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-10-10

### 🎉 Major Release: Complete Magento 2 Infrastructure Automation

This release transforms the MaxCluster MCP Server from basic web server control into a comprehensive Magento 2 infrastructure automation platform.

### Added

#### Magento 2 Orchestration Tools (2 tools)
- **`magento_environment_check`** - Comprehensive health check across all services
- **`magento_prepare_environment`** - One-command complete Magento 2 infrastructure setup

#### MySQL/MariaDB Management (5 tools)
- `mysql_status` - Database service status and database listing
- `mysql_restart` - Restart MySQL/MariaDB service
- `mysql_create_database` - Create database with auto-generated secure credentials
- `mysql_list_databases` - List all databases with users and descriptions
- `mysql_delete_database` - Delete database

#### Redis Cache Management (7 tools)
- `redis_status` - Status of all Redis instances
- `redis_create_cache_instance` - Create cache-optimized instance (Magento default cache)
- `redis_create_session_instance` - Create session-optimized instance (Magento sessions)
- `redis_create_fpc_instance` - Create full-page-cache instance (Magento FPC)
- `redis_start_instance` - Start Redis instance by port
- `redis_stop_instance` - Stop Redis instance by port
- `redis_flush_instance` - Flush all keys from instance

#### RabbitMQ Queue Management (6 tools)
- `rabbitmq_status` - Service status with vhosts and users
- `rabbitmq_start` - Start RabbitMQ service
- `rabbitmq_stop` - Stop RabbitMQ service
- `rabbitmq_create_vhost` - Create virtual host
- `rabbitmq_create_user` - Create user with auto-generated password
- `rabbitmq_setup_magento` - Complete Magento setup (vhost + user + permissions)

#### Elasticsearch Management (5 tools)
- `elasticsearch_status` - Instance status and configuration
- `elasticsearch_create_instance` - Create Elasticsearch instance
- `elasticsearch_start_instance` - Start instance by port
- `elasticsearch_stop_instance` - Stop instance by port
- `elasticsearch_restart_instance` - Restart instance by port

#### OpenSearch Management (5 tools)
- `opensearch_status` - Instance status and configuration
- `opensearch_create_instance` - Create OpenSearch instance
- `opensearch_start_instance` - Start instance by port
- `opensearch_stop_instance` - Stop instance by port
- `opensearch_restart_instance` - Restart instance by port

### Enhanced

- All tools now return Magento 2-ready configuration snippets
- Auto-generated credentials for enhanced security
- Comprehensive error handling with recovery guidance
- Detailed logging for troubleshooting

### Documentation

- Complete implementation plan with 6 stages
- API discovery documentation
- Individual service implementation guides
- Magento 2 complete setup guide
- Production-ready examples

### Changed

- Updated package name to `maxcluster-mcp-server`
- Version bumped to 2.0.0 (major release)
- Repository moved to run-as-root organization

---

## [1.0.0] - 2025-07-02

### Initial Release

#### Added

- NGINX management (restart, reload)
- Apache management (start, restart, reload, status)
- PHP-FPM management (restart, reload, status, version control)
- Intelligent server operations with natural language
- Server information retrieval
- Personal Access Token authentication
- Comprehensive error handling

#### Features

- MCP protocol compliance
- TypeScript implementation
- Zod schema validation
- Axios HTTP client
- Multiple server character support

---

## Legend

- 🎉 Major feature or release
- ✨ New feature
- 🔧 Enhancement
- 🐛 Bug fix
- 📚 Documentation
- 🔒 Security
- ⚡ Performance
- 💥 Breaking change
