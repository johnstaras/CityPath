#!/bin/bash

# CityPaths — Start All Services
# Usage: ./start.sh

set -e

echo "=== Starting CityPaths ==="

# 1. Start Docker services (DB + API)
echo "[1/2] Starting Docker services (db + api)..."
cd server
docker compose up -d
cd ..

# 2. Wait for API to be healthy
echo "[2/2] Starting Metro bundler..."
cd mobile
npx react-native start
