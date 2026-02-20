# 📊 Zoomies Backend Monitoring

This directory contains the Docker Compose stack for monitoring the Zoomies backend with Prometheus and Grafana.

## 🚀 Quick Start

```bash
# Start the monitoring stack
docker compose up -d

# View logs
docker compose logs -f

# Stop the stack
docker compose down
```

## 🔗 Access URLs

- **Grafana**: <http://localhost:3001> (admin/admin)
- **Prometheus**: <http://localhost:9090>

## 📁 Directory Structure

```
monitoring/
├── docker-compose.yml          # Main compose file
├── grafana/
│   ├── dashboards/
│   │   └── zoomies-overview.json    # Pre-built dashboard
│   └── provisioning/
│       ├── dashboards/
│       │   └── dashboards.yml       # Dashboard auto-loading config
│       └── datasources/
│           └── datasource.yml       # Prometheus datasource config
├── prometheus/
│   └── prometheus.yml          # Prometheus config (scrape targets)
└── secrets/
    └── metrics_token           # Bearer token for /api/admin/metrics
```

## ⚙️ Configuration

### Backend Setup

Ensure the backend has the matching metrics token in `.env`:

```env
METRICS_BEARER_TOKEN=b16bce31fcb7e3efe0b31d672652083381f14275008e368345bfb03b3c54c2d19406586d385890ba2fc3400421a235069da1cd0fcb8fe2e9ed8b030ebc1da92c
```

### Token Security

The token in `secrets/metrics_token` must match `METRICS_BEARER_TOKEN` in the backend.

To generate a new secure token:

```bash
# Linux/Mac
openssl rand -hex 64

# Windows PowerShell
-join ((48..57) + (65..70) * 8 | Get-Random -Count 128 | % {[char]$_})

# Node.js (any platform)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Update both files when changing the token.

## 📊 Available Metrics

The backend exposes Prometheus metrics at:

```
GET http://localhost:5000/api/admin/metrics
Authorization: Bearer <METRICS_BEARER_TOKEN>
```

### Metric Categories

1. **HTTP Metrics**
   - Request rate (`http_requests_total`)
   - Request duration (`http_request_duration_seconds`)
   - Status code distribution

2. **Node.js Metrics**
   - Memory usage (heap, RSS)
   - CPU usage
   - Event loop lag
   - Garbage collection stats

3. **Business Metrics** (if implemented)
   - Active users
   - Active rides
   - Total operations

## 🔧 Troubleshooting

### Prometheus Target DOWN

Check:

1. Backend is running on port 5000
2. Token matches in both places
3. Backend logs for auth errors

```bash
# Test the endpoint manually
curl -H "Authorization: Bearer $(cat secrets/metrics_token)" \
  http://localhost:5000/api/admin/metrics
```

### Grafana Dashboard Empty

1. Go to Prometheus in Grafana: <http://localhost:3001/connections/datasources>
2. Click "Prometheus" → Test connection
3. Check time range in dashboard (top right)
4. Verify Prometheus is scraping: <http://localhost:9090/targets>

### Docker Issues

```bash
# Remove everything and restart fresh
docker compose down -v
docker compose up -d

# Check service health
docker compose ps
docker compose logs prometheus
docker compose logs grafana
```

## 📚 Documentation

For detailed setup, usage, and advanced configuration, see:

📘 **[Full Monitoring Guide](../docs/MONITORING_GUIDE.md)**

## 🔒 Production Considerations

- [ ] Change Grafana admin password
- [ ] Generate new metrics bearer token
- [ ] Set up TLS/HTTPS for Grafana
- [ ] Configure alerting rules
- [ ] Set up alert notifications (email, Slack, etc.)
- [ ] Restrict network access (firewall/VPC)
- [ ] Use persistent volumes for Grafana config
- [ ] Set retention policies for Prometheus data

## 🎯 Admin Panel Integration

The Zoomies web admin panel has a monitoring page at:

<http://localhost:3000/admin/monitoring>

It embeds the Grafana dashboard and provides quick links to all monitoring services.

---

**Need help?** Check the [MONITORING_GUIDE.md](../docs/MONITORING_GUIDE.md) or open an issue!
