import { readFileSync, writeFileSync } from 'fs';

const path = 'dist/sw.js';
const content = readFileSync(path, 'utf8');
const updated = content.replace(/summer-slam-[\w]+/, `summer-slam-${Date.now()}`);
writeFileSync(path, updated);
