#!/usr/bin/env sh
# 4. Automated checks. Run from the repo root (Git Bash).
cd mobile || exit 1
echo "== mobile: jest";            time npx jest --silent 2>&1 | tail -5
echo "== mobile: contrast test";   npx jest __tests__/contrast.test.ts 2>&1 | tail -5
echo "== mobile: tsc --noEmit";    time npx tsc --noEmit; echo "tsc exit=$?"
echo "== mobile: eslint";          npx eslint . -f json -o eslint.tmp.json; \
  node -e "const r=require('./eslint.tmp.json');console.log('errors',r.reduce((a,f)=>a+f.errorCount,0),'warnings',r.reduce((a,f)=>a+f.warningCount,0))"; \
  rm -f eslint.tmp.json
cd ../server || exit 1
echo "== server: node --test";     time npm test 2>&1 | grep -E '^# (tests|pass|fail|duration_ms)'
