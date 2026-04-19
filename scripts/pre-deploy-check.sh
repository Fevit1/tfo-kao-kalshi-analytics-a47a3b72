#!/bin/bash
# KAO — Kalshi Analytics Optimizer
# Pre-deploy security checks — run as CI deploy blockers.
# Any match exits with code 1, blocking the deploy.
# Configure in Vercel build settings: bash scripts/pre-deploy-check.sh

set -e

echo "🔍 KAO Pre-Deploy Security Check Starting..."
FAIL=0

# ─── Check 1: No NEXT_PUBLIC_ API key leaks ──────────────────
echo ""
echo "Check 1: Scanning for NEXT_PUBLIC_ API key leaks..."

PATTERNS=(
  "NEXT_PUBLIC_KALSHI_API_KEY"
  "NEXT_PUBLIC_PERPLEXITY_API_KEY"
  "NEXT_PUBLIC_ANTHROPIC_API_KEY"
)

for pattern in "${PATTERNS[@]}"; do
  # Search src/ and pages/ (if exists), exclude .next/ and node_modules/
  if grep -r "$pattern" src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" --include="*.json" 2>/dev/null | grep -v "//.*$pattern" | grep -q .; then
    echo "❌ DEPLOY BLOCKER: Found '$pattern' in source files."
    echo "   API keys must NEVER use NEXT_PUBLIC_ prefix — they would be exposed to the browser."
    FAIL=1
  else
    echo "✅ $pattern — not found in source (correct)"
  fi
done

# Also check .env files (should not be committed, but check if present)
for env_file in .env .env.local .env.production; do
  if [ -f "$env_file" ]; then
    for pattern in "${PATTERNS[@]}"; do
      if grep -q "$pattern" "$env_file" 2>/dev/null; then
        echo "❌ DEPLOY BLOCKER: Found '$pattern' in $env_file — do not commit env files with API keys."
        FAIL=1
      fi
    done
  fi
done

# ─── Check 2: No dangerouslySetInnerHTML ─────────────────────
echo ""
echo "Check 2: Scanning for dangerouslySetInnerHTML..."

if grep -r "dangerouslySetInnerHTML" src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "^\s*//" | grep -q .; then
  echo "❌ DEPLOY BLOCKER: Found dangerouslySetInnerHTML in source files."
  echo "   All LLM-generated text must be rendered as escaped React strings."
  echo "   All citation URLs must be rendered as validated anchor tags — never raw HTML."
  grep -r "dangerouslySetInnerHTML" src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" 2>/dev/null
  FAIL=1
else
  echo "✅ dangerouslySetInnerHTML — not found (correct)"
fi

# ─── Check 3: .env.local not tracked by git ──────────────────
echo ""
echo "Check 3: Verifying .env.local is not tracked by git..."

if git ls-files --error-unmatch .env.local 2>/dev/null; then
  echo "❌ DEPLOY BLOCKER: .env.local is tracked by git. Remove it immediately:"
  echo "   git rm --cached .env.local && git commit -m 'Remove .env.local from tracking'"
  FAIL=1
else
  echo "✅ .env.local — not tracked by git (correct)"
fi

# ─── Check 4: Verify NEXT_PUBLIC_KALSHI_ENV is set ───────────
echo ""
echo "Check 4: Verifying NEXT_PUBLIC_KALSHI_ENV is set..."

if [ -z "${NEXT_PUBLIC_KALSHI_ENV}" ]; then
  echo "⚠️  WARNING: NEXT_PUBLIC_KALSHI_ENV is not set in the environment."
  echo "   Set this in the Vercel dashboard to 'demo' or 'production'."
  echo "   DemoBanner will not render correctly without this variable."
  # Not a hard fail — Vercel injects at build time
else
  echo "✅ NEXT_PUBLIC_KALSHI_ENV=$NEXT_PUBLIC_KALSHI_ENV"
fi

# ─── Final Result ─────────────────────────────────────────────
echo ""
if [ $FAIL -eq 1 ]; then
  echo "❌ Pre-deploy check FAILED. Fix the issues above before deploying."
  exit 1
else
  echo "✅ All pre-deploy security checks passed. Safe to deploy."
  exit 0
fi