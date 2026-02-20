import {
  Counter,
  Histogram,
  Gauge,
  Registry,
  collectDefaultMetrics,
} from "prom-client";
import type { Request, Response, NextFunction } from "express";

export const register = new Registry();

register.setDefaultLabels({
  service: "zoomies-backend",
  env: process.env.NODE_ENV || "development",
});

collectDefaultMetrics({ register });

/* ---------------------------------- */
/* HTTP METRICS */
/* ---------------------------------- */

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

export const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpErrorsTotal = new Counter({
  name: "http_errors_total",
  help: "Total HTTP errors",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

export const inFlightRequests = new Gauge({
  name: "http_requests_in_flight",
  help: "Current active HTTP requests",
  registers: [register],
});

/* ---------------------------------- */
/* SYSTEM METRICS */
/* ---------------------------------- */

export const memoryUsage = new Gauge({
  name: "node_memory_usage_bytes",
  help: "Node.js memory usage",
  labelNames: ["type"],
  registers: [register],
});

export const eventLoopLag = new Gauge({
  name: "node_event_loop_lag_seconds",
  help: "Event loop lag",
  registers: [register],
});

export const processUptime = new Gauge({
  name: "node_process_uptime_seconds",
  help: "Process uptime",
  registers: [register],
});

/* ---------------------------------- */
/* AUTH & SECURITY */
/* ---------------------------------- */

export const authFailures = new Counter({
  name: "auth_failures_total",
  help: "Total authentication failures",
  registers: [register],
});

export const unauthorizedAccess = new Counter({
  name: "unauthorized_access_total",
  help: "Unauthorized access attempts",
  registers: [register],
});

/* ---------------------------------- */
/* BUSINESS METRICS (CUSTOMIZE) */
/* ---------------------------------- */

export const activeUsers = new Gauge({
  name: "active_users",
  help: "Currently active users",
  registers: [register],
});

export const ridesCreated = new Counter({
  name: "rides_created_total",
  help: "Total rides created",
  registers: [register],
});

/* ---------------------------------- */
/* MIDDLEWARE */
/* ---------------------------------- */

function resolveRoute(req: Request): string {
  if (req.route?.path) {
    return `${req.baseUrl}${req.route.path}`;
  }
  return req.path || "unknown";
}

export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const start = process.hrtime();
  inFlightRequests.inc();

  res.on("finish", () => {
    const diff = process.hrtime(start);
    const duration = diff[0] + diff[1] / 1e9;

    const labels = {
      method: req.method,
      route: resolveRoute(req),
      status_code: res.statusCode.toString(),
    };

    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, duration);

    if (res.statusCode >= 400) {
      httpErrorsTotal.inc(labels);
    }

    inFlightRequests.dec();
  });

  next();
}

/* ---------------------------------- */
/* SYSTEM SAMPLING */
/* ---------------------------------- */

setInterval(() => {
  const mem = process.memoryUsage();

  memoryUsage.set({ type: "rss" }, mem.rss);
  memoryUsage.set({ type: "heapTotal" }, mem.heapTotal);
  memoryUsage.set({ type: "heapUsed" }, mem.heapUsed);
  memoryUsage.set({ type: "external" }, mem.external);

  processUptime.set(process.uptime());

  const start = process.hrtime();
  setImmediate(() => {
    const delta = process.hrtime(start);
    const lag = delta[0] + delta[1] / 1e9;
    eventLoopLag.set(lag);
  });
}, 5000);

/* ---------------------------------- */
/* HANDLER */
/* ---------------------------------- */

export async function metricsHandler(req: Request, res: Response) {
  res.setHeader("Content-Type", register.contentType);
  res.end(await register.metrics());
}