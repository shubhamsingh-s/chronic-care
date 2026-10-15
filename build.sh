#!/usr/bin/env bash
# Exit on error
set -o errexit

# Install python dependencies
pip install --upgrade pip
pip install -r requirements.txt

echo "Build complete."
