/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Baked in at build time so the running app can show which deployed
  // commit it actually is - Vercel sets VERCEL_GIT_COMMIT_SHA during
  // `next build` automatically, no manual configuration needed per
  // deploy. Real problem this solves: a tester with a stale browser tab
  // has no way to tell "am I actually running the code that was just
  // shipped" from the UI alone - a claim result that doesn't match what
  // the latest fix should produce looks identical to a real bug either
  // way, and repeatedly turned out to be the former across this app's
  // testing history.
  env: { NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA || 'local' },
}
module.exports = nextConfig
