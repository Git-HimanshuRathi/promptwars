#!/usr/bin/env node
// Rewrites workspace package.json exports from src/*.ts → dist/*.js
// so Node.js can import compiled output at runtime (local dev uses tsx which
// handles .ts source directly and doesn't need this patched).
const fs = require('fs');
for (const dir of ['packages/shared', 'packages/ai']) {
  const p = dir + '/package.json';
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.main = './dist/index.js';
  if (j.exports) {
    for (const [k, v] of Object.entries(j.exports)) {
      if (typeof v === 'string')
        j.exports[k] = v.replace('./src/', './dist/').replace(/\.ts$/, '.js');
    }
  }
  delete j.types;
  fs.writeFileSync(p, JSON.stringify(j, null, 2));
}
console.log('patched workspace exports → dist/');
