#!/bin/bash
# Production-ready cache clearing script for useCallback fix

echo "🧹 Clearing all caches..."

# Clear Vite cache
echo "1. Clearing Vite cache..."
rm -rf node_modules/.vite

# Clear build output
echo "2. Clearing build output..."
rm -rf dist

# Clear npm cache (optional but thorough)
echo "3. Clearing npm cache..."
npm cache clean --force 2>/dev/null || true

# Clear browser cache instructions
echo ""
echo "✅ Build caches cleared!"
echo ""
echo "📋 Next steps:"
echo "   1. Stop your dev server (Ctrl+C)"
echo "   2. Run: npm run dev"
echo "   3. In browser:"
echo "      - Open DevTools (F12)"
echo "      - Right-click refresh button"
echo "      - Select 'Empty Cache and Hard Reload'"
echo "   4. Or use incognito/private window"
echo ""

