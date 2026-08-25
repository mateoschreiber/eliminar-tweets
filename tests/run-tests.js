// SPDX-License-Identifier: MIT
// Copyright (c) 2026 x-post-cleaner contributors
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/x-post-cleaner.js', 'utf8');
const context = {
  window: { __xPostCleanerState: null },
  location: { hostname: 'example.test', pathname: '/', origin: 'https://example.test' },
  console: { log() {}, warn() {}, error() {}, table() {} },
  document: {}, MutationObserver: class {}, setTimeout, clearTimeout, URL,
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(source, context);
const { parseLikeCount, parseOwnedStatusUrl } = context.window.__xPostCleanerInternals;
const decision = (label) => {
  const parsed = parseLikeCount(label);
  return !parsed.known ? 'skip' : parsed.value < 20 ? 'candidate' : 'keep';
};

assert.equal(decision('Like'), 'candidate'); // zero
assert.equal(decision('1 Likes'), 'candidate');
assert.equal(decision('19 Likes'), 'candidate');
assert.equal(decision('20 Likes'), 'keep');
assert.equal(decision('21 Likes'), 'keep');
assert.equal(decision('127 Likes'), 'keep');
assert.equal(decision('many likes'), 'skip');
assert.equal(parseLikeCount('1.2K Likes').value, 1200);
const owned = parseOwnedStatusUrl('https://x.com/Owner/status/123?x=1', 'owner');
assert.equal(owned.id, '123');
assert.equal(owned.url, 'https://x.com/Owner/status/123');
assert.equal(parseOwnedStatusUrl('https://x.com/someone-else/status/123', 'owner'), null);
assert.match(source, /if \(CONFIG\.DRY_RUN\)[\s\S]*?return true;[\s\S]*?await deleteArticle/, 'dry run must return before deletion');
assert.match(source, /MAX_POSTS_TO_DELETE: 20/, 'the newest-eligible cap must default to 20');
assert.match(source, /CONFIG\.MAX_POSTS_TO_DELETE > 1000/, 'the cap must reject values above 1000');
assert.match(source, /state\.counts\.candidates < CONFIG\.MAX_POSTS_TO_DELETE/, 'the loop must stop at the candidate cap');
assert.match(source, /querySelectorAll\(CONFIRM\).*find\(isVisibleAndEnabled\)/s, 'a visible stable confirmation control must be clicked automatically');
assert.match(source, /\[role="dialog"\].*\[aria-modal="true"\].*confirmationSheet/s, 'localized confirmation fallback must stay scoped to a modal');
assert.match(source, /closest\(ARTICLE\) === article/, 'direct controls/status links must exclude nested tweet articles');
assert.match(source, /state\.processedIds\.has\(status\.id\)/, 'duplicate IDs must be ignored');
assert.match(source, /window\.stopXCleaner/, 'emergency stop API must exist');
console.log('All dependency-free safety fixtures passed.');
