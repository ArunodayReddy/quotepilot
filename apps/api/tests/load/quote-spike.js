/**
 * QuotePilot quote-spike load test (k6).
 *
 * Scenario: ramp to 200 concurrent users submitting quotes, hold for 2
 * minutes, ramp down. Each VU submits a quote (masked sample profile) and
 * polls until the job completes, mimicking the real web client.
 *
 * HOW TO RUN (against the in-memory dev stack):
 *
 *   # 1. Boot the API with relaxed rate limits (one IP = all VUs):
 *   RATE_LIMIT_GLOBAL_PER_MIN=100000 RATE_LIMIT_QUOTE_PER_MIN=100000 \
 *     npm run dev --workspace apps/api
 *
 *   # 2. In another shell:
 *   k6 run tests/load/quote-spike.js
 *
 *   # Target a deployed API instead:
 *   k6 run -e API_URL=https://quotepilot-api.onrender.com tests/load/quote-spike.js
 *
 * WHAT THE NUMBERS MEAN:
 *  - http_req_failed < 1%: no 5xx/429s under spike load.
 *  - quote_submit p(95) < 2s: the 202 enqueue path stays fast (it's the
 *    polling GETs that wait on carriers, by design).
 *  - quote_complete p(95) < 12s: full fan-out (6 simulated carriers, 8s
 *    per-carrier timeout ceiling) finishes inside the UI's poll window.
 *  - cache_hits: with 200 VUs reusing a handful of profiles, repeat
 *    submissions return 200 + cached:true in ~10ms — the cache is the
 *    spike absorber.
 *
 * Do NOT point this at a third-party service. It hammers /api/quote hard.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";

const API_URL = __ENV.API_URL || "http://localhost:3001";

// A few profile variants so the cache gets both hits and misses.
const ZIPS = ["02139", "76201", "94102", "30301", "60601"];

function quoteBody(zip) {
  return JSON.stringify({
    contact: { email: "loadtest@example.com", phone: "555-010-0199", state: "MA", zip },
    drivers: [
      {
        firstName: "Load",
        lastName: "Test",
        age: 35,
        gender: "prefer_not_to_say",
        yearsLicensed: 17,
        accidentsLast5Years: 0,
        violationsLast3Years: 0,
      },
    ],
    vehicles: [
      {
        year: 2022,
        make: "Toyota",
        model: "Camry",
        ownership: "owned",
        usage: "commute",
        annualMileage: 12000,
        garagedZip: zip,
      },
    ],
    coverage: {
      bodilyInjuryPerPerson: 100000,
      bodilyInjuryPerAccident: 300000,
      propertyDamage: 100000,
      uninsuredMotoristPerPerson: 100000,
      uninsuredMotoristPerAccident: 300000,
      medicalPayments: 5000,
      collisionDeductible: 500,
      comprehensiveDeductible: 500,
      rentalReimbursement: false,
      roadsideAssistance: true,
    },
  });
}

const submitTrend = new Trend("quote_submit", true);
const completeTrend = new Trend("quote_complete", true);
const cacheHits = new Counter("cache_hits");
const failed = new Rate("failed_requests");

export const options = {
  stages: [
    { duration: "30s", target: 50 },
    { duration: "30s", target: 200 },
    { duration: "2m", target: 200 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    quote_submit: ["p(95)<2000"],
    quote_complete: ["p(95)<12000"],
  },
};

export default function () {
  const zip = ZIPS[__VU % ZIPS.length];
  const params = { headers: { "Content-Type": "application/json" } };

  const started = Date.now();
  const post = http.post(`${API_URL}/api/quote`, quoteBody(zip), params);
  submitTrend.add(post.timings.duration);

  const okSubmit = check(post, {
    "submit accepted (200 cached / 202 queued)": (r) => r.status === 200 || r.status === 202,
  });
  if (!okSubmit) {
    failed.add(1);
    sleep(1);
    return;
  }
  failed.add(0);

  let body;
  try {
    body = post.json();
  } catch {
    failed.add(1);
    return;
  }
  if (body.cached === true) {
    cacheHits.add(1);
    completeTrend.add(Date.now() - started);
    check(body, { "cached job is complete": (b) => b.status === "complete" });
    sleep(0.5);
    return;
  }

  // Poll like the web client until the job completes (or 20s).
  const jobId = body.jobId;
  const deadline = Date.now() + 20000;
  let done = false;
  while (Date.now() < deadline) {
    const poll = http.get(`${API_URL}/api/quotes/${jobId}`);
    if (poll.status !== 200) break;
    let job;
    try {
      job = poll.json();
    } catch {
      break;
    }
    if (job.status === "complete") {
      done = true;
      check(job, { "job completed with results": (j) => j.results && j.results.length > 0 });
      break;
    }
    sleep(0.5);
  }
  completeTrend.add(Date.now() - started);
  if (!done) failed.add(1);
  sleep(0.5);
}
