// Lightweight local p95 measurement for the availability read path: cached (same
// query repeated → Redis hit) vs uncached (unique dates each time → DB compute).
// NOT a substitute for a real load test in a deployed env (no ECS autoscaling here).
const BASE = process.env.BASE ?? 'http://localhost:4000/api/v1';
const propertyId = process.argv[2];
if (!propertyId) throw new Error('usage: node availability-p95.mjs <propertyId>');

function pct(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function run(label, urlFor, n) {
  const times = [];
  // warm one first so the connection pool is up
  await fetch(urlFor(0));
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    const res = await fetch(urlFor(i));
    await res.text();
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  console.log(
    `${label.padEnd(10)} n=${n}  p50=${pct(times, 50).toFixed(1)}ms  p95=${pct(times, 95).toFixed(1)}ms  max=${times[times.length - 1].toFixed(1)}ms`,
  );
}

const N = 300;
// Cached: identical query every time → served from Redis after the first.
await run(
  'cached',
  () => `${BASE}/availability?propertyId=${propertyId}&checkIn=2028-01-10&checkOut=2028-01-12&adults=2&children=0`,
  N,
);
// Uncached: a unique check-in each iteration → cache miss → DB compute each time.
await run(
  'uncached',
  (i) => {
    const day = String((i % 27) + 1).padStart(2, '0');
    const day2 = String((i % 27) + 2).padStart(2, '0');
    return `${BASE}/availability?propertyId=${propertyId}&checkIn=2029-03-${day}&checkOut=2029-03-${day2}&adults=2&children=0`;
  },
  N,
);
