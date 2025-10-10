# MaxCluster MCP - Usage Examples

## Quick Start: Magento 2 Demo Environment

### One-Command Setup

```
magento_prepare_environment
  --cluster_id="C-1234"
  --web_server="srv-a"
  --db_server="db-a"
  --cache_server="cache-a"
  --queue_server="queue-a"
  --search_server="search-a"
  --search_engine="elasticsearch"
  --environment_name="Demo"
```

**Result**: Complete infrastructure + ready-to-use Magento 2 configuration in ~60 seconds

---

## Scenario 1: New Magento 2 Production Environment

### Step 1: Check Environment

```
magento_environment_check
  --cluster_id="C-5678"
  --web_server="srv-a"
  --db_server="db-a"
  --cache_server="cache-a"
  --queue_server="queue-a"
  --search_server="search-a"
  --search_engine="opensearch"
```

### Step 2: Prepare Infrastructure

```
magento_prepare_environment
  --cluster_id="C-5678"
  --web_server="srv-a"
  --db_server="db-a"
  --cache_server="cache-a"
  --queue_server="queue-a"
  --search_server="search-a"
  --search_engine="opensearch"
  --search_heap_mb=4096
  --environment_name="Production"
  --rabbitmq_vhost="/magento-prod"
  --rabbitmq_user="magento-prod"
```

### Step 3: Configure Magento

Copy the returned configuration into `app/etc/env.php`

### Step 4: Install Magento

```bash
bin/magento setup:upgrade
bin/magento setup:di:compile
bin/magento deploy:mode:set production
bin/magento cache:flush
bin/magento indexer:reindex
```

---

## Scenario 2: Individual Service Management

### Create Database

```
mysql_create_database C-1234 db-a
  --description="Custom Magento Store"
```

### Create Redis Instances Separately

```
redis_create_cache_instance C-1234 cache-a
  --description="Store Cache"

redis_create_session_instance C-1234 cache-a
  --description="Customer Sessions"

redis_create_fpc_instance C-1234 cache-a
  --description="Full Page Cache"
```

### Setup RabbitMQ

```
rabbitmq_setup_magento C-1234 queue-a
  --vhost_name="/my-store"
  --username="mystore-queue"
```

### Create Search Engine

```
elasticsearch_create_instance C-1234 search-a
  --heap_size_mb=2048
  --description="Product Catalog Search"
```

---

## Scenario 3: Troubleshooting & Maintenance

### Check Service Status

```
mysql_status C-1234 db-a
redis_status C-1234 cache-a
rabbitmq_status C-1234 queue-a
elasticsearch_status C-1234 search-a
php_status C-1234 srv-a
```

### Restart Services

```
nginx_reload C-1234 srv-a
php_reload C-1234 srv-a
elasticsearch_restart_instance C-1234 search-a --port=9200
```

### Clear Caches

```
redis_flush_instance C-1234 cache-a --port=6379  # Default cache
redis_flush_instance C-1234 cache-a --port=6381  # FPC
```

---

## Scenario 4: Natural Language Operations

Use the `intelligent_server_operation` tool for human-friendly commands:

```
intelligent_server_operation
  --server_request="restart nginx on production"

intelligent_server_operation
  --server_request="reload php on staging server"
```

---

## Scenario 5: Multi-Environment Setup

### Staging Environment

```
magento_prepare_environment
  --cluster_id="C-1234"
  --web_server="srv-b"
  --db_server="db-a"
  --cache_server="cache-a"
  --queue_server="queue-a"
  --search_server="search-a"
  --search_engine="elasticsearch"
  --environment_name="Staging"
  --rabbitmq_vhost="/magento-staging"
  --rabbitmq_user="magento-staging"
```

### Development Environment

```
magento_prepare_environment
  --cluster_id="C-1234"
  --web_server="srv-c"
  --db_server="db-a"
  --cache_server="cache-a"
  --queue_server="queue-a"
  --search_server="search-a"
  --search_engine="elasticsearch"
  --search_heap_mb=1024
  --environment_name="Development"
  --rabbitmq_vhost="/magento-dev"
  --rabbitmq_user="magento-dev"
```

---

## Tips & Best Practices

### Server Selection

- Use `db-*` servers for MySQL
- Use `cache-*` servers for Redis
- Use `queue-*` servers for RabbitMQ
- Use `search-*` servers for Elasticsearch/OpenSearch
- Use `srv-*` servers for web servers and PHP

### Heap Size Guidelines

**Elasticsearch/OpenSearch**:
- Small catalogs (<10k products): 1024MB
- Medium catalogs (10k-50k): 2048MB
- Large catalogs (50k+): 4096MB+

**Redis**:
- Managed automatically by instance type
- Cache: 1GB
- Session: 512MB
- FPC: 1GB

### Save Credentials

All passwords are auto-generated and **shown only once**. Save them immediately:

```bash
# Save output to file
magento_prepare_environment [...] > magento-config.txt
```

### Environment Naming

Use clear names that appear in resource descriptions:
- "Production"
- "Staging"
- "Development"
- "Demo"
- "QA"
