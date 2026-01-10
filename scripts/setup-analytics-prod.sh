#!/bin/bash
# Setup analytics service on production server (cod-prod)
# Run this script ON the production server after git pull

set -e

echo "=== Analytics Production Setup ==="

# 1. Check if podman is installed
if ! command -v podman &> /dev/null; then
    echo "Installing podman..."
    sudo apt-get update
    sudo apt-get install -y podman
fi

# 2. Create data directory
echo "Creating ClickHouse data directory..."
mkdir -p ~/clickhouse-data

# 3. Generate secrets if not set
CLICKHOUSE_PASSWORD=${CLICKHOUSE_PASSWORD:-$(openssl rand -hex 16)}
API_KEY=${ANALYTICS_STATS_API_KEY:-$(openssl rand -hex 32)}

echo ""
echo "Generated credentials (save these!):"
echo "  CLICKHOUSE_PASSWORD=$CLICKHOUSE_PASSWORD"
echo "  ANALYTICS_STATS_API_KEY=$API_KEY"
echo ""

# 4. Start ClickHouse with podman
echo "Starting ClickHouse container..."
podman stop clickhouse 2>/dev/null || true
podman rm clickhouse 2>/dev/null || true

podman run -d \
    --name clickhouse \
    --restart=always \
    -p 127.0.0.1:8123:8123 \
    -p 127.0.0.1:9000:9000 \
    -v ~/clickhouse-data:/var/lib/clickhouse:Z \
    -e CLICKHOUSE_DB=analytics \
    -e CLICKHOUSE_USER=analytics \
    -e CLICKHOUSE_PASSWORD="$CLICKHOUSE_PASSWORD" \
    docker.io/clickhouse/clickhouse-server:latest

echo "Waiting for ClickHouse to start..."
sleep 10

# 5. Verify ClickHouse is running
if curl -s http://localhost:8123/ping | grep -q "Ok"; then
    echo "✓ ClickHouse is running"
else
    echo "✗ ClickHouse failed to start"
    podman logs clickhouse
    exit 1
fi

# 6. Create .env file
cd ~/apps/cod/apps/analytics
cat > .env << EOF
# ClickHouse connection
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_DATABASE=analytics
CLICKHOUSE_USERNAME=analytics
CLICKHOUSE_PASSWORD=$CLICKHOUSE_PASSWORD

# Ingestion settings
ANALYTICS_BATCH_SIZE=1000
ANALYTICS_FLUSH_INTERVAL_MS=5000
ANALYTICS_MAX_QUEUE_SIZE=10000

# Retention settings
ANALYTICS_RAW_RETENTION_DAYS=90
ANALYTICS_ROLLUP_RETENTION_YEARS=2

# Server settings
ANALYTICS_PORT=1489
ANALYTICS_ALLOWED_ORIGINS=https://click-or-die.ru,https://www.click-or-die.ru

# API key for stats endpoints
ANALYTICS_STATS_API_KEY=$API_KEY
EOF

echo "✓ Created .env file"

# 7. Build minified analytics.js
echo "Building minified analytics script..."
npm run build:analytics

# 8. Run migrations
echo "Running ClickHouse migrations..."
npm run migrate

# 9. Setup nginx
echo ""
echo "=== Nginx Setup ==="
if [ ! -f /etc/nginx/sites-available/analytics.click-or-die.ru ]; then
    echo "Copying nginx config..."
    sudo cp ~/apps/cod/apps/analytics/nginx/analytics.conf /etc/nginx/sites-available/analytics.click-or-die.ru
    
    # Check if rate limit zone already defined
    if ! grep -q "limit_req_zone.*analytics_events" /etc/nginx/nginx.conf; then
        echo "⚠️  Add rate limit zone to /etc/nginx/nginx.conf in http block:"
        echo '    limit_req_zone $binary_remote_addr zone=analytics_events:10m rate=10r/s;'
    fi
    
    sudo ln -sf /etc/nginx/sites-available/analytics.click-or-die.ru /etc/nginx/sites-enabled/
    echo "✓ Nginx config installed"
else
    echo "Nginx config already exists"
fi

# 10. SSL certificate
echo ""
echo "=== SSL Setup ==="
if [ ! -f /etc/letsencrypt/live/analytics.click-or-die.ru/fullchain.pem ]; then
    echo "Obtaining SSL certificate..."
    sudo certbot certonly --nginx -d analytics.click-or-die.ru --non-interactive --agree-tos -m admin@click-or-die.ru
else
    echo "SSL certificate already exists"
fi

# 11. Test nginx config
echo "Testing nginx configuration..."
sudo nginx -t

# 12. Reload nginx
sudo systemctl reload nginx
echo "✓ Nginx reloaded"

# 13. Start/restart PM2
echo ""
echo "=== PM2 Setup ==="
cd ~/apps/cod
pm2 start ecosystem.config.js --only analytics 2>/dev/null || pm2 restart analytics
pm2 save
echo "✓ Analytics service running"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Verification:"
echo "  curl http://localhost:1489/health"
echo "  curl https://analytics.click-or-die.ru/health"
echo ""
echo "Stats API (requires auth):"
echo "  curl -H 'Authorization: Bearer $API_KEY' 'https://analytics.click-or-die.ru/v1/stats/total?from=2025-01-01&to=2025-01-31'"
echo ""
echo "PM2 commands:"
echo "  pm2 logs analytics"
echo "  pm2 restart analytics"
echo "  pm2 monit"
echo ""
