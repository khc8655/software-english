#!/bin/bash
# Build script - combines JS files into index.html for production
# Usage: ./build.sh

set -e

echo "Building..."

# For now, we don't minify since it's client-side fetch
# In production, you might want to inline the JS

echo "Build complete!"
echo ""
echo "Files:"
ls -la *.html *.json js/ 2>/dev/null || true
