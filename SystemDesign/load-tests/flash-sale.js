import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom Metrics
const successCounter = new Counter('reservations_success');
const failureCounter = new Counter('reservations_failed');
const duplicateCounter = new Counter('duplicate_requests_fired');
const errorRate = new Rate('error_rate');
const latencyTrend = new Trend('reservation_latency');

export const options = {
  scenarios: {
    flash_sale: {
      executor: 'shared-iterations',
      // If VUS is not passed, default to local dev profile (1000)
      vus: __ENV.VUS ? parseInt(__ENV.VUS) : 1000,
      iterations: __ENV.VUS ? parseInt(__ENV.VUS) : 1000,
      maxDuration: '30s',
    },
  },
  thresholds: {
    // We expect a high failure rate in terms of 422 Out of Stock, but 5xx errors should be 0.
    'http_req_failed': ['rate<0.01'], 
    'reservation_latency': ['p(95)<500'], // 95% of requests under 500ms
  }
};

export default function () {
  const url = `${__ENV.API_URL || 'http://localhost:3000'}/api/reservations`;
  const token = __ENV.TOKEN;
  const productId = __ENV.PRODUCT_ID;

  if (!token || !productId) {
    console.error('Missing TOKEN or PRODUCT_ID environment variables');
    return;
  }

  // 1. Generate unique Idempotency Key for this "User's" checkout intent
  const idempotencyKey = uuidv4();

  const payload = JSON.stringify({
    productId: productId,
    quantity: 1
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey,
    },
  };

  // 2. Fire Primary Reservation Request
  let res = http.post(url, payload, params);
  latencyTrend.add(res.timings.duration);

  // 3. Simulate Network Retries / Duplicates (20% chance)
  // We fire the exact same request with the SAME idempotency key.
  // The system must NOT reserve a second unit.
  if (Math.random() < 0.2) {
    duplicateCounter.add(1);
    let dupRes = http.post(url, payload, params);
    
    // Duplicate responses should ideally return the cached 201, or a 409 conflict, never a 500.
    check(dupRes, {
      'duplicate handled safely': (r) => [201, 200, 409, 422].includes(r.status),
    });
  }

  // 4. Validate Response & Track Metrics
  if (res.status === 201) {
    successCounter.add(1);
    errorRate.add(0);
  } else if (res.status === 422) {
    // 422 Out of Stock is an expected business failure, not a system error
    failureCounter.add(1);
    errorRate.add(0);
  } else {
    // 5xx or unhandled status
    failureCounter.add(1);
    errorRate.add(1);
  }

  check(res, {
    'status is 201 or 422': (r) => r.status === 201 || r.status === 422,
  });
}
