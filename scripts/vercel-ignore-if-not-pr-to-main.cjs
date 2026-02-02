#!/usr/bin/env node

// Vercel "Ignored Build Step" script.
// Skip builds unless the deployment is a pull request targeting the `main` branch.

const prId = process.env.VERCEL_GIT_PULL_REQUEST_ID;
const targetBranch = process.env.VERCEL_GIT_PULL_REQUEST_TARGET_BRANCH || "";
const commitRef = process.env.VERCEL_GIT_COMMIT_REF || ""; // branch for non-PR deploys

const isPr = Boolean(prId);

const isMainLike = (branch) =>
  branch === "main" ||
  branch === "origin/main" ||
  branch.endsWith("/main");

const isPrToMain = isPr && isMainLike(targetBranch);
const isDirectMainPush = !isPr && isMainLike(commitRef);

if (isPrToMain || isDirectMainPush) {
  // Non-zero exit code tells Vercel NOT to ignore the build.
  console.log("Building: deployment is a PR to main or a direct push to main.");
  process.exit(1);
}

// Exit code 0 with a message tells Vercel to skip the build.
console.log("Skipping build: deployment is neither a PR to main nor a direct push to main.");
process.exit(0);
