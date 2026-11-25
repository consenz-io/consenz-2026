import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanDisplayName } from '../../src/lib/displayName.js';
import { detectLanguage } from '../../src/lib/languageUtils.js';
import { computeDropPosition } from '../../src/components/document/utils/dropPosition.js';
import { computeChangeBlockDiff } from '../../src/components/document/changeBlockDiff.js';
import {
  needsTranslationHighlight,
  pageNeedsTranslation,
} from '../../src/components/document/translateHighlight.js';

/**
 * Pure content helpers used all over the document page. They are cheap to
 * test here and expensive to debug in the browser.
 */

test('display name: an email prefix stored as a name becomes readable', () => {
  assert.equal(cleanDisplayName('aharon.porath+2', 'aharon.porath+2@gmail.com'), 'Aharon Porath');
  assert.equal(cleanDisplayName('john_doe', 'john_doe@example.com'), 'John Doe');
});

test('display name: a real name is left untouched', () => {
  assert.equal(cleanDisplayName('Dana Levi', 'dana@example.com'), 'Dana Levi');
  assert.equal(cleanDisplayName('SomeOther', 'dana@example.com'), 'SomeOther');
});

test('language detection covers the three supported scripts', () => {
  assert.equal(detectLanguage('שלום לכולם'), 'he');
  assert.equal(detectLanguage('مرحبا بالجميع'), 'ar');
  assert.equal(detectLanguage('Hello everyone'), 'en');
  assert.equal(detectLanguage(''), 'en');
});

test('drop position: between two neighbours lands in the middle', () => {
  assert.equal(computeDropPosition(1, 2), 1.5);
  assert.equal(computeDropPosition(3, null), 3.5);
  assert.equal(computeDropPosition(null, 4), 3.5);
  assert.equal(computeDropPosition(null, null), -1);
});

test('change diff: identical content produces no change block', () => {
  const segments = computeChangeBlockDiff('<p>same words here</p>', '<p>same words here</p>');
  assert.equal(segments.some((s) => s.type === 'changed'), false);
});

test('change diff: a replaced word becomes one change block', () => {
  const segments = computeChangeBlockDiff('<p>we support this clause</p>', '<p>we reject this clause</p>');
  const changed = segments.filter((s) => s.type === 'changed');
  assert.equal(changed.length, 1);
  assert.match(changed[0].oldHtml, /support/);
  assert.match(changed[0].newHtml, /reject/);
});

test('change diff: empty sides are handled', () => {
  assert.deepEqual(computeChangeBlockDiff('', ''), []);
  assert.deepEqual(computeChangeBlockDiff(null, '<p>new</p>'), [{ type: 'unchanged', html: '<p>new</p>' }]);
  assert.deepEqual(computeChangeBlockDiff('<p>old</p>', null), [{ type: 'removed-block', html: '<p>old</p>' }]);
});

test('translate highlight: only when the document language differs from the UI', () => {
  assert.equal(needsTranslationHighlight({ originalLanguage: 'he', title: 'x' }, 'en'), true);
  assert.equal(needsTranslationHighlight({ originalLanguage: 'he', title: 'x' }, 'he'), false);
  assert.equal(needsTranslationHighlight({ title: 'שלום' }, 'en'), true);
  assert.equal(needsTranslationHighlight(null, 'en'), false);
});

test('page translation: a foreign comment is enough to offer translate-all', () => {
  const englishDocument = { document: { originalLanguage: 'en', title: 'Charter' }, topics: [], sections: [], suggestions: [] };
  assert.equal(pageNeedsTranslation({ ...englishDocument, comments: [] }, 'en'), false);
  assert.equal(pageNeedsTranslation({ ...englishDocument, comments: [{ content: 'תגובה בעברית' }] }, 'en'), true);
});