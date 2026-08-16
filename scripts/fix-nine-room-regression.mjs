import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'scripts/app-shell-regression.test.mjs';
let source = readFileSync(path, 'utf8');
source = source.replace("assert.equal((homeHubSource.match(/className=\"home-room-app home-room-app--/g) || []).length, 8);", "assert.equal((homeHubSource.match(/className=\"home-room-app home-room-app--/g) || []).length, 9);");
source = source.replace("test('all eight home room icons share one pointed cat-ear frame'", "test('all nine home room icons share one pointed cat-ear frame'");
source = source.replace("assert.equal((homeHubSource.match(/<HomeCatFrame \\/>/g) || []).length, 8);", "assert.equal((homeHubSource.match(/<HomeCatFrame \\/>/g) || []).length, 9);");
writeFileSync(path, source, 'utf8');
unlinkSync('scripts/fix-nine-room-regression.mjs');
unlinkSync('.github/workflows/fix-nine-room-regression.yml');
