#!/usr/bin/env bash
set -euo pipefail

echo "==> Running linter..."
pnpm lint

echo "==> Verifying code formatting..."
pnpm format:check

echo "==> Linting and formatting checks passed!"
