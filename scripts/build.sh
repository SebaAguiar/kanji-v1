#!/usr/bin/env bash
set -euo pipefail

echo "==> Building all packages..."
pnpm build
echo "==> Build completed successfully!"
