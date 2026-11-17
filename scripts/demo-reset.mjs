// Resets the running site to a clean demo state: erases every account, booking and
// email, then recreates the demo account with a few tickets.
//
//   npm run demo:reset                 (site running with npm run dev, port 5173)
//   PORT=8787 npm run demo:reset       (site running with npm start)
const port = process.env.PORT ?? 5173;
const base = `http://localhost:${port}`;
try {
  const res = await fetch(`${base}/api/demo/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
  console.log(`Demo data reset on ${base}.`);
  console.log(`Demo account: ${data.demoEmail} (use "Continue With Demo Account" on the sign-in page).`);
} catch (err) {
  console.error(`Could not reset ${base}: ${err.message}`);
  console.error('Is the site running? Start it with "npm run dev", or pass PORT for a production server.');
  process.exit(1);
}
