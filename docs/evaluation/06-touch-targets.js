// 5b. Static count of touch-target sizes declared for interactive elements.
// Usage: OUT=<dir> node 06-touch-targets.js
// For every <Pressable>/<TextInput>/<Switch>/<Touchable*> in mobile/src/**/*.tsx
// the style names referenced as styles.X in its opening tag are resolved in
// the same file's StyleSheet.create, and height/minHeight/width/minWidth
// (numeric literals only) are read. A target counts as >= 44 when its
// declared height or minHeight is >= 44 AND (no width declared, or width or
// minWidth >= 44). hitSlop is recorded. Heuristic: sizes coming from children,
// padding, dynamic values or shared components are reported as "undeclared".
const fs = require('fs');
const path = require('path');
const { REPO, save } = require('./common');

const SRC = path.join(REPO, 'mobile', 'src');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.tsx')) files.push(p);
  }
})(SRC);

function openingTag(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0 && src[i - 1] !== '=') return src.slice(start, i + 1);
  }
  return src.slice(start);
}

function styleBlock(src, name) {
  const re = new RegExp(`\\n\\s*${name}\\s*:\\s*\\{`, 'g');
  const sheet = src.lastIndexOf('StyleSheet.create');
  if (sheet < 0) return null;
  re.lastIndex = sheet;
  const m = re.exec(src);
  if (!m) return null;
  let depth = 0;
  for (let i = m.index + m[0].length - 1; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(m.index, i + 1);
  }
  return null;
}

const num = (block, prop) => {
  const m = new RegExp(`\\b${prop}\\s*:\\s*(\\d+(?:\\.\\d+)?)\\b`).exec(block || '');
  return m ? Number(m[1]) : null;
};

const items = [];
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const re = /<(Pressable|TextInput|Switch|TouchableOpacity|TouchableHighlight)\b/g;
  let m;
  while ((m = re.exec(src))) {
    const tag = openingTag(src, m.index);
    const names = [...new Set([...tag.matchAll(/styles\.(\w+)/g)].map(x => x[1]))];
    const size = { height: null, minHeight: null, width: null, minWidth: null };
    for (const n of names) {
      const b = styleBlock(src, n);
      for (const k of Object.keys(size)) {
        const v = num(b, k);
        if (v != null) size[k] = Math.max(size[k] ?? 0, v);
      }
    }
    const h = Math.max(size.height ?? 0, size.minHeight ?? 0) || null;
    const w = Math.max(size.width ?? 0, size.minWidth ?? 0) || null;
    const hasWidthDecl = size.width != null || size.minWidth != null;
    let verdict;
    if (h == null) verdict = 'undeclared';
    else if (h >= 44 && (!hasWidthDecl || w >= 44)) verdict = '>=44';
    else verdict = '<44';
    items.push({
      file: path.relative(REPO, file).replace(/\\/g, '/'),
      line: src.slice(0, m.index).split('\n').length,
      element: m[1],
      styles: names,
      ...size,
      hitSlop: /hitSlop/.test(tag),
      verdict,
    });
  }
}
const count = v => items.filter(i => i.verdict === v).length;
const summary = { total: items.length, ge44: count('>=44'), lt44: count('<44'), undeclared: count('undeclared'), withHitSlop: items.filter(i => i.hitSlop).length };
console.log(summary);
for (const i of items.filter(x => x.verdict !== '>=44')) console.log(i.verdict, i.file + ':' + i.line, i.element, i.styles.join(','), JSON.stringify({ h: i.height, mh: i.minHeight, w: i.width, mw: i.minWidth, hitSlop: i.hitSlop }));
console.log('saved', save('touch-targets.json', { date: new Date().toISOString(), summary, items }));
