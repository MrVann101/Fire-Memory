#!/usr/bin/env bash
# usage: bash scripts/check-owner.sh data|backend|frontend|ai
role=$1
case $role in
  data)     allowed='^(data/|scripts/ingest/|docs/(DATA|HARMONIZATION)\.md|docs/implementation/member-1-|docs-presentation-data/|src/content/)' ;;
  backend)  allowed='^(supabase/|src/app/api/(regions|hotspots|analytics)/|src/lib/(db|analytics)/|tests/analytics/|docs/implementation/member-2-|src/contracts/|src/mocks/)' ;;
  frontend) allowed='^(src/app/(page|layout|globals)\.|src/components/(dashboard|map|calendar|charts|filters|common)/|src/hooks/|src/lib/client/|docs/implementation/member-3-)' ;;
  ai)       allowed='^(src/app/api/(ai|export)/|src/lib/(ai|export)/|src/components/(assistant|export)/|tests/ai/|docs/presentation/|docs/DEMO_SCRIPT\.md|docs/implementation/member-4-)' ;;
  *) echo "usage: $0 data|backend|frontend|ai"; exit 1 ;;
esac
bad=$(git diff --name-only origin/main...HEAD | grep -Ev "$allowed")
if [ -n "$bad" ]; then echo "Files outside your area:"; echo "$bad"; exit 1; fi
echo "OK: only your files changed"
