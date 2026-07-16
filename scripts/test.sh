#!/usr/bin/env bash
set -euo pipefail

echo "==> Running test suite in CI mode..."
pnpm test:ci
echo "==> Tests passed successfully!"
