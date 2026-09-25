#!/usr/bin/env sh
# 7. Code size: git-tracked files and lines per top-level folder of mobile/src
# and server (node_modules is never tracked). Run from the repo root.
# Output: base folder files lines, then the same for source files only
# (.ts/.tsx/.js/.sql/.prisma), which leaves out package-lock.json etc.
for base in mobile/src server; do
  git ls-files "$base" | while read -r f; do
    depth=$(echo "$base" | awk -F/ '{print NF}')
    nf=$(echo "$f" | awk -F/ '{print NF}')
    if [ "$nf" -eq $((depth + 1)) ]; then top="(root)"; else top=$(echo "$f" | cut -d/ -f$((depth + 1))); fi
    case "$f" in *.ts|*.tsx|*.js|*.sql|*.prisma) src=1 ;; *) src=0 ;; esac
    echo "$base $top $src $(wc -l < "$f")"
  done
done | awk '
  { k=$1" "$2; f[k]++; l[k]+=$4; if ($3==1) { sf[k]++; sl[k]+=$4 } T[$1]++; TL[$1]+=$4; if ($3==1) { ST[$1]++; STL[$1]+=$4 } }
  END {
    printf "%-10s %-14s %6s %7s %9s %9s\n", "base", "folder", "files", "lines", "srcFiles", "srcLines"
    for (k in f) { split(k, p, " "); printf "%-10s %-14s %6d %7d %9d %9d\n", p[1], p[2], f[k], l[k], sf[k], sl[k] }
    for (b in T) printf "%-10s %-14s %6d %7d %9d %9d\n", b, "TOTAL", T[b], TL[b], ST[b], STL[b]
  }' | sort
