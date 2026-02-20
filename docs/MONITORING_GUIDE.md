# 🔍 Monitoring Guide - Grafana & Prometheus

This guide explains how to set up and use the monitoring stack for Zoomies Backend to track performance metrics, request rates, error rates, and system health.

## 📊 Overview

The monitoring stack consists of:

- **Prometheus**: Metrics collection and time-series database
- **Grafana**: Visualization and dashboards
- **Backend Metrics**: Custom Express.js middleware exposing Prometheus metrics

## 🚀 Quick Start

### 1. Start the Monitoring Stack

From the `monitoring` directory:

```bash
cd monitoring
docker compose up -d
```

This starts:

- Prometheus on [http://localhost:9090](http://localhost:9090)
- Grafana on [http://localhost:3001](http://localhost:3001)

### 2. Access Grafana

**Login credentials:**

- URL: <http://localhost:3001>
- Username: `admin`
- Password: `admin`

On first login, you can optionally change the password or skip it for local development.

### 3. View the Zoomies Dashboard

Navigate to:

- **Dashboards** → **Zoomies Backend Overview**

Or directly access: <http://localhost:3001/d/zoomies-backend/zoomies-backend-overview>

## 📈 Available Metrics

### HTTP Metrics

- **Request Rate**: Total requests per second
- **Error Rate**: 5xx errors per second  
- **Request Duration**: P50, P95, P99 latencies
- **Requests by Endpoint**: Breakdown by route
- **Status Code Distribution**: 2xx, 4xx, 5xx counts

### System Metrics

- **Memory Usage**: Heap used/total
- **CPU Usage**: Process CPU percentage
- **Event Loop Lag**: Node.js event loop latency

### Business Metrics

- **Active Users**: Current active sessions
- **Total Users**: User count over time
- **Active Rides**: Current ongoing rides

## 🔧 Configuration

### Backend Setup

Ensure your `.env` file has the monitoring token:

```env
# Monitoring
METRICS_BEARER_TOKEN=b16bce31fcb7e3efe0b31d672652083381f14275008e368345bfb03b3c54c2d19406586d385890ba2fc3400421a235069da1cd0fcb8fe2e9ed8b030ebc1da92c
```

### Metrics Endpoint

The backend exposes metrics at:

```
GET /api/admin/metrics
Authorization: Bearer <METRICS_BEARER_TOKEN>
```

**Permissions Required:** Admin role + valid monitoring token

### Prometheus Configuration

Located at `monitoring/prometheus/prometheus.yml`:

```yaml
scrape_configs:
  - job_name: "zoomies-backend"
    metrics_path: /api/admin/metrics
    bearer_token_file: /etc/prometheus/metrics_token
    static_configs:
      - targets: ["host.docker.internal:5000"]
```

**Key settings:**

- **Target**: `host.docker.internal:5000` (backend from Docker's perspective)
- **Scrape interval**: 15 seconds (global default)
- **Token auth**: Loaded securely from file

## 🎨 Grafana Dashboard Panels

### 1. HTTP Request Rate

Shows requests per second over time. Useful for:

- Traffic patterns
- Peak load times
- Sudden spikes or drops

### 2. Error Rate (5xx)

Tracks server errors. Monitor for:

- Service health issues
- Database connection problems
- Unhandled exceptions

### 3. Request Duration (Latency)

P95/P99 latencies help identify:

- Slow endpoints
- Performance degradation
- Database query issues

### 4. Requests by Endpoint

Top endpoints by volume:

- Identify hotspots
- Optimize high-traffic routes
- Plan caching strategies

### 5. Memory & CPU Usage

System resource monitoring:

- Memory leaks
- CPU bottlenecks
- Scaling triggers

## 🔐 Security

### Change Default Credentials

**Grafana:**

1. Login at <http://localhost:3001>
2. Go to **Profile** (avatar icon)
3. Change password in Account settings

**Generate New Metrics Token:**

```bash
# Generate a secure random token (Linux/Mac)
openssl rand -hex 64

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Update in:

1. `zoomies-backend/.env` → `METRICS_BEARER_TOKEN`
2. `monitoring/secrets/metrics_token`

Then restart services:

```bash
cd monitoring
docker compose restart

cd ../
npm run dev  # restart backend
```

## 🧪 Testing Metrics

### Manual Test

```bash
# Load the token
TOKEN=$(cat monitoring/secrets/metrics_token)

# Fetch metrics
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/admin/metrics
```

Expected output: Prometheus text format metrics

### Verify Prometheus Scraping

1. Open <http://localhost:9090/targets>
2. Find `zoomies-backend` job
3. Status should be **UP** (green)

### Query Metrics in Prometheus

Navigate to <http://localhost:9090/graph> and try queries:

```promql
# Request rate
rate(http_requests_total[5m])

# P95 latency in milliseconds
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) * 1000

# Error rate
rate(http_requests_total{status_code=~"5.."}[5m])

# Memory usage
nodejs_heap_size_used_bytes / 1024 / 1024
```

## 🎯 Admin Dashboard Integration

The Zoomies admin panel has a monitoring page at `/admin/monitoring` that embeds:

- Grafana dashboard (embedded iframe)
- Prometheus link
- Quick access to metrics endpoint info

Access requires **ADMIN** role.

## 📦 Docker Services

### Start Services

```bash
cd monitoring
docker compose up -d
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f prometheus
docker compose logs -f grafana
```

### Stop Services

```bash
docker compose down
```

### Reset Grafana (clear settings/data)

```bash
docker compose down -v  # removes volumes
docker compose up -d
```

## 🛠️ Troubleshooting

### Prometheus Not Scraping

**Issue:** Target shows DOWN on <http://localhost:9090/targets>

**Solutions:**

1. Check backend is running on port 5000
2. Verify `METRICS_BEARER_TOKEN` matches in both places
3. Test metrics endpoint manually (see Testing section)
4. Check backend logs for auth errors

### Grafana Dashboard Empty

**Possible causes:**

1. **No data in Prometheus** → Check scraping is working
2. **Time range issue** → Adjust time picker (top right)
3. **Datasource not connected** → Go to Configuration → Data Sources

### Permission Denied in Admin Panel

**Error:** "Restricted - Monitoring dashboards are available to admins only"

**Solution:**

1. Ensure user has `ADMIN` role in database
2. Check session is valid
3. Clear cookies and re-login

### Metrics Endpoint 401 Unauthorized

**Causes:**

- Token mismatch
- Missing Authorization header
- Token not set in backend `.env`

**Fix:**

```bash
# Verify token in backend
cat .env | grep METRICS_BEARER_TOKEN

# Verify token in Prometheus config
cat monitoring/secrets/metrics_token

# They must match exactly
```

## 🔥 Production Deployment

### Security Checklist

- [ ] Change Grafana admin password
- [ ] Generate new metrics bearer token
- [ ] Use TLS/HTTPS for Grafana
- [ ] Restrict network access (firewall/VPC)
- [ ] Set up alerting rules
- [ ] Configure alert notifications (email/Slack)

### Recommended Setup

- Deploy Prometheus/Grafana on separate VMs or containers
- Use managed services (AWS CloudWatch, Grafana Cloud, etc.)
- Set up retention policies for metrics
- Enable authentication for Prometheus (basic auth/OAuth)
- Use reverse proxy (Nginx/Traefik) with SSL

### Environment Variables for Production

Add to `zoomies-web/.env.production`:

```env
NEXT_PUBLIC_GRAFANA_URL=https://grafana.yourdomain.com
NEXT_PUBLIC_PROMETHEUS_URL=https://prometheus.yourdomain.com
```

## 📚 Advanced Usage

### Custom Metrics

Add custom metrics in your backend code:

```typescript
import { register, Counter, Histogram } from 'prom-client';

// Create a counter
const myCounter = new Counter({
  name: 'my_custom_metric_total',
  help: 'Description of my metric',
  labelNames: ['label1', 'label2']
});

// Increment it
myCounter.inc({ label1: 'value1', label2: 'value2' });
```

Metrics will automatically be exposed at `/api/admin/metrics`.

### Create Custom Dashboards

1. In Grafana, click **+** → **Create Dashboard**
2. Add panels with PromQL queries
3. Save dashboard
4. Export as JSON
5. Place in `monitoring/grafana/dashboards/`
6. Restart Grafana to auto-load it

### Alerting Rules

Create `monitoring/prometheus/alerts.yml`:

```yaml
groups:
  - name: zoomies_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors/sec"
```

Add to `prometheus.yml`:

```yaml
rule_files:
  - /etc/prometheus/alerts.yml
```

## 🎓 Learn More

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Tutorials](https://grafana.com/tutorials/)
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Node.js Metrics Best Practices](https://github.com/siimon/prom-client)

## 🆘 Support

For issues or questions:

1. Check this guide first
2. View backend logs: `npm run dev` output
3. Check Docker logs: `docker compose logs`
4. Inspect Prometheus targets: <http://localhost:9090/targets>

---

**Happy Monitoring! 🚀📊**
