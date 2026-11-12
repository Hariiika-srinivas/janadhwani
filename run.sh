#!/usr/bin/env bash
set -e

echo "=========================================================="
echo " Starting JanaDhwani Platform - Kalyana Karnataka Solvathon"
echo "=========================================================="

if [ -f ".venv/bin/python" ]; then
    PYTHON_CMD=".venv/bin/python"
elif command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
else
    PYTHON_CMD="python"
fi

$PYTHON_CMD run.py
