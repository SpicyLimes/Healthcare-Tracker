#!/usr/bin/env bash
# Run backend tests in an isolated Docker environment, then clean up completely.
#
# Usage:
#   ./scripts/test-backend.sh              # run all tests
#   ./scripts/test-backend.sh tests/test_calendar.py   # run one file
#   ./scripts/test-backend.sh -k "auth"    # pass any pytest args

set -euo pipefail

COMPOSE="docker compose -f docker-compose.test.yml"
PYTEST_ARGS="${*:-}"

cleanup() {
  echo ""
  echo "--- Tearing down test environment ---"
  $COMPOSE down --rmi all --volumes --remove-orphans 2>/dev/null || true
  docker buildx prune -f 2>/dev/null || true
  echo "--- Done ---"
}
trap cleanup EXIT

echo "--- Building test image (uses cache if unchanged) ---"
$COMPOSE build test

echo "--- Starting test database ---"
$COMPOSE up -d testdb

echo "--- Running tests ---"
$COMPOSE run --rm test pytest -v $PYTEST_ARGS
