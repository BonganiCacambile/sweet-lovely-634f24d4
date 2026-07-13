// k6 hardened burst load script for Sweet & Lovely.
//
// Runs staged concurrent traffic against public storefront routes to validate
// SSR performance and stability under real-world peak conditions.
//
// Usage:
//   BASE_URL=https://project--<id>-dev.lovable.app k6 run tests/load/burst.k6.js
//
// Install k6: https://k6.io/docs/get-started/installation/
//
// Point BASE_URL at a staging deployment — never at production without a
// coordinated load-test window. Paystack is left in test mode; no real
// charges are attempted here (checkout submit path is deliberately excluded).

import http from "k6/http";
import { check, sleep, group } from "k6";

const BASE_URL = __ENV.BASE_URL || "https://project--370ab703-de25-437c-9b38-7c4628e1e6a8-dev.lovable.app";

export const options = {
  scenarios: {
    // Ramping burst: 0 → 100 → 200 → 500 concurrent VUs over 8 minutes.
    burst: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 100 },
        { duration: "2m", target: 200 },
        { duration: "2m", target: 500 },
        { duration: "2m", target: 500 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],           // <1% error rate
    http_req_duration: ["p(95)<3000"],        // p95 under 3s
    "http_req_duration{route:home}": ["p(95)<2000"],
    "http_req_duration{route:menu}": ["p(95)<1500"],
  },
};

const ROUTES = [
  { path: "/", tag: "home" },
  { path: "/menu/full-menu", tag: "menu" },
  { path: "/cart", tag: "cart" },
  { path: "/contact", tag: "contact" },
  { path: "/locations", tag: "locations" },
  { path: "/auth", tag: "auth" },
];

export default function () {
  const route = ROUTES[Math.floor(Math.random() * ROUTES.length)];
  group(`GET ${route.path}`, () => {
    const res = http.get(`${BASE_URL}${route.path}`, {
      tags: { route: route.tag },
      headers: { "User-Agent": "k6-burst-test/1.0 (+sweet-n-lovely)" },
    });
    check(res, {
      "status is 200": (r) => r.status === 200,
      "no SSR fallback": (r) => !r.body || !r.body.includes("This page didn't load"),
    });
  });
  sleep(Math.random() * 2);
}