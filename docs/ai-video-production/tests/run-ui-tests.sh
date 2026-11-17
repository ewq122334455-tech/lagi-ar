#!/bin/bash
# Free local UI tests for the AI fitting (mock Decart SDK, mocked Worker, real Chromium). NOTHING PAID happens.
# Adds two TEST clothing products, builds the mock site, runs the tests, then removes the test products again.
#   PW_MODULE=$(npm root -g)/playwright/index.mjs bash docs/ai-video-production/tests/run-ui-tests.sh
cd "$(dirname "$0")/../../.." || exit 1
OUT="${TEST_OUT:-/tmp/lagi-ui-test}"; mkdir -p "$OUT"
cleanup() { pkill -f "vite preview --outDir $OUT/dist" 2>/dev/null; rm -rf public/products/zz-test-top public/products/zz-test-set; git checkout -- public/products/manifest.json 2>/dev/null; }
trap cleanup EXIT
node scripts/add-clothing.mjs docs/ai-video-production/tests/fixtures/test-top.json >/dev/null || exit 1
node scripts/add-clothing.mjs docs/ai-video-production/tests/fixtures/test-set.json >/dev/null || exit 1
RT_MOCK=1 npx vite build --outDir dist --emptyOutDir >/dev/null 2>&1 && node scripts/build-images.mjs >/dev/null 2>&1 || { echo "build failed"; exit 1; }
rm -rf "$OUT/dist"; mv dist "$OUT/dist"
(npx vite preview --outDir "$OUT/dist" --port 4195 --strictPort >"$OUT/preview.log" 2>&1 &)
sleep 4
node docs/ai-video-production/tests/level1-ui.mjs 2>&1 | grep -E "^(PASS|FAIL)" | cut -c1-260
node docs/ai-video-production/tests/clothing-ui.mjs 2>&1 | grep -E "^(PASS|FAIL)" | cut -c1-260
