/**
 * Change-Block Diff Engine
 *
 * Produces a word-level diff that:
 *  - Preserves rich-text formatting (bold, italic, links, headings, lists)
 *  - Groups contiguous replaced words into a single "change-block" rendered as
 *    old phrase (struck) immediately followed by new phrase (highlighted), no
 *    separating space — so the eye reads "replaced" as one move.
 *  - Treats block-level tags (<p>, <br>, <li>, <h1>…) as barriers that pass
 *    through unchanged and break change-block grouping.
 *
 * The unit of comparison is the WORD. Inline formatting tags wrap each word
 * independently (so a bold phrase becomes <b>word1</b><b>word2</b>), which lets
 * LCS align words while rendering reproduces the original formatting.
 */

// ---------------------------------------------------------------------------
// Inline tag handling
// ---------------------------------------------------------------------------
const INLINE_TAGS = new Set([
  "b", "i", "strong", "em", "a", "span", "u", "s", "del", "ins", "mark",
  "sub", "sup", "small", "big", "code", "font", "q", "cite", "abbr", "time",
]);

const SELF_CLOSING = new Set(["br", "img", "hr", "input", "wbr"]);

const BLOCK_TAGS = new Set([
  "p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "ul", "ol",
  "blockquote", "pre", "table", "tr", "td", "th", "thead", "tbody", "tfoot",
  "section", "article", "header", "footer", "main", "aside", "figure",
  "figcaption", "dl", "dt", "dd", "address", "fieldset", "legend", "video",
  "audio", "iframe", "canvas", "details", "summary", "form",
]);

function tagNameOf(tagStr) {
  const m = tagStr.match(/^<\/?([a-zA-Z0-9]+)/);
  return m ? m[1].toLowerCase() : "";
}

function closeTagsFor(openTags) {
  return openTags
    .map((t) => {
      const name = tagNameOf(t);
      return name ? `</${name}>` : "";
    })
    .reverse()
    .join("");
}

// ---------------------------------------------------------------------------
// Tokenize HTML into a flat stream of word and block tokens.
// Each word token carries its own inline formatting (html field) and the
// whitespace that preceded it (leadingSpace), so it can be rendered
// independently while reproducing the original formatting.
// ---------------------------------------------------------------------------
function tokenizeHtml(html) {
  const tokens = [];
  const openTags = [];
  let i = 0;
  let pendingSpace = "";
  let buf = "";

  const flushWord = () => {
    if (!buf) return;
    tokens.push({
      kind: "word",
      text: buf,
      html: openTags.join("") + buf + closeTagsFor(openTags),
      leadingSpace: pendingSpace,
    });
    pendingSpace = "";
    buf = "";
  };

  while (i < html.length) {
    const ch = html[i];

    if (ch === "<") {
      const end = html.indexOf(">", i);
      if (end === -1) {
        buf += html.slice(i);
        break;
      }
      const tag = html.slice(i, end + 1);
      const name = tagNameOf(tag);
      const isClosing = tag[1] === "/";
      const isSelfClosing = /\/>$/.test(tag) || SELF_CLOSING.has(name);

      if (BLOCK_TAGS.has(name)) {
        // Block tags break words and pass through unchanged.
        flushWord();
        // Attach accumulated space to the block token so it renders between blocks.
        tokens.push({ kind: "block", html: tag, leadingSpace: pendingSpace });
        pendingSpace = "";
      } else if (INLINE_TAGS.has(name) && !isSelfClosing) {
        // Inline tags attach to words — track state, don't break words.
        flushWord();
        if (isClosing) {
          // Only pop if matching — tolerate unbalanced tags.
          const idx = openTags
            .map((t) => tagNameOf(t))
            .lastIndexOf(name);
          if (idx !== -1) openTags.splice(idx, 1);
        } else {
          openTags.push(tag);
        }
      } else {
        // Unknown / self-closing inline (br, img…) — pass through attached to
        // the current word buffer so it renders inline.
        flushWord();
        // Attach to the next word as leading content, or emit as a block-like token.
        if (pendingSpace === "" && tokens.length > 0 && tokens[tokens.length - 1].kind === "word") {
          // attach to previous word's html
          tokens[tokens.length - 1].html += tag;
        } else {
          pendingSpace += tag;
        }
      }
      i = end + 1;
    } else if (/\s/.test(ch)) {
      flushWord();
      pendingSpace += ch;
      i++;
    } else {
      buf += ch;
      i++;
    }
  }
  flushWord();

  return tokens;
}

// ---------------------------------------------------------------------------
// LCS over word-token texts.
// ---------------------------------------------------------------------------
function computeWordLCS(oldWords, newWords) {
  const m = oldWords.length;
  const n = newWords.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1].text === newWords[j - 1].text) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

function backtrackLCS(oldWords, newWords, dp) {
  const result = [];
  let i = oldWords.length;
  let j = newWords.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1].text === newWords[j - 1].text) {
      result.unshift({ type: "unchanged", oi: i - 1, ni: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "added", ni: j - 1 });
      j--;
    } else {
      result.unshift({ type: "removed", oi: i - 1 });
      i--;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Memoization cache (per content pair).
// ---------------------------------------------------------------------------
const diffCache = new Map();
const CACHE_LIMIT = 200;

function cacheKey(oldHtml, newHtml) {
  return `${oldHtml}||${newHtml}`;
}

// ---------------------------------------------------------------------------
// Main: compute the change-block diff.
// Returns an array of render segments:
//   { type: "unchanged", html }
//   { type: "changed", oldHtml, newHtml }   // old→new phrase replacement, no space
//   { type: "block", html }                 // block-level tag, pass-through
//   { type: "space", html }                 // standalone whitespace
// ---------------------------------------------------------------------------
export function computeChangeBlockDiff(oldHtml, newHtml) {
  if (!oldHtml && !newHtml) return [];
  if (!oldHtml) return [{ type: "unchanged", html: newHtml || "" }];
  if (!newHtml) return [{ type: "removed-block", html: oldHtml || "" }];

  const key = cacheKey(oldHtml, newHtml);
  if (diffCache.has(key)) return diffCache.get(key);

  const oldTokens = tokenizeHtml(oldHtml);
  const newTokens = tokenizeHtml(newHtml);

  const oldWords = oldTokens.filter((t) => t.kind === "word");
  const newWords = newTokens.filter((t) => t.kind === "word");

  const dp = computeWordLCS(oldWords, newWords);
  const rawDiff = backtrackLCS(oldWords, newWords, dp);

  // Group consecutive removed+added into change-blocks. Block tokens break groups.
  // We walk both flat token streams with cursors, emitting block tokens as we go.
  const segments = [];
  let oi = 0; // cursor in oldTokens
  let ni = 0; // cursor in newTokens

  // Helper: advance a cursor until it reaches the word at targetWordIndex (in
  // that side's word array), emitting block tokens encountered. Returns the
  // accumulated block html and the leadingSpace of the reached word.
  const advanceToWord = (tokens, cursor, wordList, targetWordIdx, emit) => {
    let blockHtml = "";
    let leading = "";
    while (cursor < tokens.length) {
      const t = tokens[cursor];
      if (t.kind === "word") {
        if (wordList[targetWordIdx] === t) {
          leading = t.leadingSpace;
          return { cursor: cursor + 1, blockHtml, leading };
        }
        // a word we're skipping (shouldn't happen if cursors are consistent)
        cursor++;
      } else {
        // block token — emit it
        if (t.leadingSpace) emit({ type: "space", html: t.leadingSpace });
        emit({ type: "block", html: t.html });
        cursor++;
      }
    }
    return { cursor, blockHtml, leading };
  };

  // We process the rawDiff, grouping consecutive removed/added into change-blocks.
  let k = 0;
  while (k < rawDiff.length) {
    const entry = rawDiff[k];

    if (entry.type === "unchanged") {
      // Advance both cursors to this word, emitting blocks from the OLD side
      // (they match the new side for unchanged regions).
      const oldRes = advanceToWord(oldTokens, oi, oldWords, entry.oi, (seg) => segments.push(seg));
      oi = oldRes.cursor;
      // Advance new cursor too, but suppress its block tokens (already emitted from old).
      // We still need to move ni past the matching word.
      while (ni < newTokens.length && newTokens[ni] !== newWords[entry.ni]) {
        ni++; // skip blocks silently
      }
      ni = ni < newTokens.length ? ni + 1 : ni;

      if (oldRes.leading) segments.push({ type: "space", html: oldRes.leading });
      segments.push({ type: "unchanged", html: oldWords[entry.oi].html });
      k++;
    } else {
      // Collect a change-block: consecutive removed/added entries (until an
      // unchanged entry or end). Block tokens inside break the block.
      const oldIdxs = [];
      const newIdxs = [];
      while (k < rawDiff.length && rawDiff[k].type !== "unchanged") {
        if (rawDiff[k].type === "removed") oldIdxs.push(rawDiff[k].oi);
        else newIdxs.push(rawDiff[k].ni);
        k++;
      }

      // Emit blocks + leading space for the old phrase.
      let oldLeading = "";
      const oldPhraseHtml = [];
      for (const wi of oldIdxs) {
        const res = advanceToWord(oldTokens, oi, oldWords, wi, (seg) => segments.push(seg));
        oi = res.cursor;
        if (oldPhraseHtml.length === 0) oldLeading = res.leading;
        oldPhraseHtml.push(oldWords[wi].html);
      }
      // Emit blocks for the new phrase (suppress leading space — no space between old→new).
      const newPhraseHtml = [];
      for (const wi of newIdxs) {
        const res = advanceToWord(newTokens, ni, newWords, wi, () => {});
        ni = res.cursor;
        newPhraseHtml.push(newWords[wi].html);
      }

      if (oldLeading) segments.push({ type: "space", html: oldLeading });

      if (oldPhraseHtml.length && newPhraseHtml.length) {
        segments.push({
          type: "changed",
          oldHtml: oldPhraseHtml.join(""),
          newHtml: newPhraseHtml.join(""),
        });
      } else if (oldPhraseHtml.length) {
        segments.push({ type: "removed", html: oldPhraseHtml.join("") });
      } else if (newPhraseHtml.length) {
        segments.push({ type: "added", html: newPhraseHtml.join("") });
      }
    }
  }

  // Emit any trailing block tokens from either side.
  while (oi < oldTokens.length) {
    const t = oldTokens[oi];
    if (t.kind === "block") {
      if (t.leadingSpace) segments.push({ type: "space", html: t.leadingSpace });
      segments.push({ type: "block", html: t.html });
    }
    oi++;
  }
  while (ni < newTokens.length) {
    const t = newTokens[ni];
    if (t.kind === "block") {
      // Avoid duplicating if already emitted from old trailing.
      ni++;
    } else {
      ni++;
    }
  }

  // Coalesce consecutive segments of the same type for cleaner rendering.
  const coalesced = [];
  for (const seg of segments) {
    const last = coalesced[coalesced.length - 1];
    if (last && last.type === seg.type && (seg.type === "unchanged" || seg.type === "space" || seg.type === "block")) {
      last.html += seg.html;
    } else {
      coalesced.push({ ...seg });
    }
  }

  if (diffCache.size >= CACHE_LIMIT) {
    // Evict oldest entry (Map preserves insertion order).
    const firstKey = diffCache.keys().next().value;
    diffCache.delete(firstKey);
  }
  diffCache.set(key, coalesced);
  return coalesced;
}

export { tokenizeHtml };