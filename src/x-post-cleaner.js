// SPDX-License-Identifier: MIT
// Copyright (c) 2026 x-post-cleaner contributors
/*
 * X Post Cleaner v1.0.0 — paste this entire file into a Chromium DevTools Snippet
 * while viewing https://x.com/<your-handle> or /<your-handle>/with_replies.
 */

// ── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  HANDLE: '', // Optional, without @. Empty safely detects it from the current profile URL.
  MAX_POSTS_TO_DELETE: 20, // Process at most this many newest eligible posts (1–1000).
  MIN_LIKES_TO_KEEP: 20,
  DRY_RUN: true, // Keep true for the first run. false makes irreversible deletions.
  SPEED_MODE: 'fast', // 'safe', 'fast', or 'turbo'
  MAX_EMPTY_SCROLLS: 20,
  PERSIST_PROGRESS: false,
  LOG_LEVEL: 'normal', // 'minimal', 'normal', or 'verbose'
};
// ────────────────────────────────────────────────────────────────────────────

(async () => {
  'use strict';

  const VERSION = '1.0.0';
  const ARTICLE = 'article[data-testid="tweet"]';
  const LIKE = '[data-testid="like"], [data-testid="unlike"]';
  const CARET = '[data-testid="caret"]';
  const CONFIRM = '[data-testid="confirmationSheetConfirm"]';
  const SPEEDS = {
    safe: { timeout: 5000, settle: 700, scroll: 900 },
    fast: { timeout: 3000, settle: 280, scroll: 350 },
    turbo: { timeout: 1800, settle: 120, scroll: 180 },
  };
  const DELETE_LABELS = new Set([
    'delete', 'delete post', 'borrar', 'borrar post', 'eliminar', 'eliminar post',
  ]);
  const RESERVED_PATHS = new Set(['home', 'explore', 'notifications', 'messages', 'search', 'settings', 'i', 'compose', 'login', 'signup']);

  const state = {
    running: false, stopped: false, handle: null, startedAt: null,
    processedIds: new Set(), counts: { processed: 0, candidates: 0, deleted: 0, kept: 0, skipped: 0, errors: 0 },
  };
  window.__xPostCleanerState = state;
  window.stopXCleaner = () => {
    state.stopped = true;
    console.warn('[X Post Cleaner] Stop requested. The current safe step will finish, then the cleaner will stop.');
  };

  function log(level, message, ...values) {
    const enabled = { minimal: 0, normal: 1, verbose: 2 }[CONFIG.LOG_LEVEL];
    const need = { minimal: 0, normal: 1, verbose: 2 }[level];
    if (need <= enabled) console.log(message, ...values);
  }

  function normalizeHandle(value) {
    return String(value || '').trim().replace(/^@/, '').toLowerCase();
  }

  function resolveHandle() {
    const configured = normalizeHandle(CONFIG.HANDLE);
    if (configured) return configured;
    const parts = location.pathname.split('/').filter(Boolean);
    // Only profile and replies-profile URLs are unambiguous enough to infer an account.
    if ((parts.length === 1 || (parts.length === 2 && parts[1] === 'with_replies')) &&
        /^[A-Za-z0-9_]{1,15}$/.test(parts[0]) && !RESERVED_PATHS.has(parts[0].toLowerCase())) {
      return parts[0].toLowerCase();
    }
    return null;
  }

  function validateConfig() {
    if (!Number.isFinite(CONFIG.MIN_LIKES_TO_KEEP) || !Number.isInteger(CONFIG.MIN_LIKES_TO_KEEP) || CONFIG.MIN_LIKES_TO_KEEP < 0) {
      throw new Error('MIN_LIKES_TO_KEEP must be a non-negative finite integer.');
    }
    if (CONFIG.HANDLE && !/^[A-Za-z0-9_]{1,15}$/.test(normalizeHandle(CONFIG.HANDLE))) {
      throw new Error('HANDLE must be a conservative X username (1–15 letters, digits, or underscores).');
    }
    if (!Number.isFinite(CONFIG.MAX_POSTS_TO_DELETE) || !Number.isInteger(CONFIG.MAX_POSTS_TO_DELETE) ||
        CONFIG.MAX_POSTS_TO_DELETE < 1 || CONFIG.MAX_POSTS_TO_DELETE > 1000) {
      throw new Error('MAX_POSTS_TO_DELETE must be an integer from 1 through 1000.');
    }
    if (!Object.hasOwn(SPEEDS, CONFIG.SPEED_MODE)) throw new Error("SPEED_MODE must be 'safe', 'fast', or 'turbo'.");
    if (!Number.isFinite(CONFIG.MAX_EMPTY_SCROLLS) || !Number.isInteger(CONFIG.MAX_EMPTY_SCROLLS) || CONFIG.MAX_EMPTY_SCROLLS < 1) {
      throw new Error('MAX_EMPTY_SCROLLS must be a positive integer.');
    }
    if (!Object.hasOwn({ minimal: 1, normal: 1, verbose: 1 }, CONFIG.LOG_LEVEL)) throw new Error('LOG_LEVEL must be minimal, normal, or verbose.');
  }

  function parseOwnedStatusUrl(href, handle) {
    try {
      const url = new URL(href, location.origin);
      const match = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)(?:\/)?$/);
      return match && match[1].toLowerCase() === handle ? { id: match[2], url: url.href.split('?')[0] } : null;
    } catch { return null; }
  }

  function getStatusFromArticle(article, handle) {
    // A post's timestamp link is its canonical status link. Requiring <time> avoids
    // treating links in quoted-post cards as the parent post's canonical URL.
    const candidates = [...article.querySelectorAll('a[href*="/status/"]')]
      .filter((anchor) => anchor.closest(ARTICLE) === article && anchor.querySelector('time'));
    const matches = candidates.map((anchor) => parseOwnedStatusUrl(anchor.href, handle)).filter(Boolean);
    // More than one owned canonical timestamp is ambiguous; fail closed.
    return matches.length === 1 ? matches[0] : null;
  }

  function getDirectControl(article, selector) {
    const controls = [...article.querySelectorAll(selector)]
      .filter((element) => element.closest(ARTICLE) === article);
    return controls.length === 1 ? controls[0] : null;
  }

  function parseLikeCount(label, visibleText = '') {
    const raw = String(label || visibleText || '').trim();
    if (!raw) return { known: false, reason: 'empty Like label' };
    const normalized = raw.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
    // X's bare action label means there are zero likes. Do not apply this to any
    // arbitrary label; an unrecognised engagement string must remain unknown.
    if (/^(like|likes|me gusta|gustar)$/.test(normalized)) return { known: true, value: 0 };
    const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(k|mil|m|mn|million|millones|millón)?\b/u);
    if (!match) return { known: false, reason: `unrecognised Like label: ${raw}` };
    const suffix = match[2];
    let numeric = match[1];
    if (!suffix && /[.,]/.test(numeric)) {
      // 1,234 / 1.234 and 12,345 are thousands; a single 1,2 style separator is decimal only with a suffix.
      numeric = /^\d{1,3}([.,]\d{3})+$/.test(numeric) ? numeric.replace(/[.,]/g, '') : numeric.replace(/[.,]/g, '');
    } else numeric = numeric.replace(',', '.');
    const base = Number(numeric);
    if (!Number.isFinite(base)) return { known: false, reason: `invalid Like number: ${raw}` };
    const multipliers = { k: 1000, mil: 1000, m: 1000000, mn: 1000000, million: 1000000, millones: 1000000, millón: 1000000 };
    return { known: true, value: Math.round(base * (multipliers[suffix] || 1)) };
  }

  function getLikeCount(article) {
    const control = getDirectControl(article, LIKE);
    if (!control) return { known: false, reason: 'own Like control not found or ambiguous' };
    return parseLikeCount(control.getAttribute('aria-label'), control.innerText || control.textContent);
  }

  function progressKey() { return `x-post-cleaner:${state.handle}:v${VERSION}`; }
  function loadProgress() {
    if (!CONFIG.PERSIST_PROGRESS) return;
    try { JSON.parse(localStorage.getItem(progressKey()) || '[]').forEach((id) => state.processedIds.add(String(id))); }
    catch { console.warn('[X Post Cleaner] Could not read local progress; continuing without it.'); }
  }
  function saveProgress() {
    if (!CONFIG.PERSIST_PROGRESS) return;
    try { localStorage.setItem(progressKey(), JSON.stringify([...state.processedIds].slice(-5000))); }
    catch { console.warn('[X Post Cleaner] Could not save local progress.'); }
  }

  async function waitFor(find, timeout = SPEEDS[CONFIG.SPEED_MODE].timeout) {
    const immediate = find();
    if (immediate) return immediate;
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => { const value = find(); if (value) finish(value); });
      const timer = setTimeout(() => finish(null), timeout);
      const finish = (value) => { clearTimeout(timer); observer.disconnect(); resolve(value); };
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    });
  }

  function menuDeleteItem() {
    return [...document.querySelectorAll('[role="menuitem"], [role="menuitemradio"]')].find((item) =>
      DELETE_LABELS.has((item.innerText || item.textContent || '').trim().toLocaleLowerCase()));
  }

  function isVisibleAndEnabled(element) {
    if (!element || element.disabled || element.getAttribute('aria-hidden') === 'true') return false;
    return element.getClientRects().length > 0;
  }

  function confirmationDeleteButton() {
    // X commonly provides this stable test ID. Do not require a particular parent:
    // its confirmation-sheet wrapper differs between X UI variants and locales.
    const stableButton = [...document.querySelectorAll(CONFIRM)].find(isVisibleAndEnabled);
    if (stableButton) return stableButton;

    // Safe localized fallback: only accept a visible destructive label inside a
    // visible modal. It will never search the page-wide overflow menu.
    const dialogs = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], [data-testid="confirmationSheet"]')]
      .filter(isVisibleAndEnabled);
    for (const dialog of dialogs) {
      const button = [...dialog.querySelectorAll('button, [role="button"]')].find((element) =>
        isVisibleAndEnabled(element) && DELETE_LABELS.has((element.innerText || element.textContent || '').trim().toLocaleLowerCase()));
      if (button) return button;
    }
    return null;
  }

  async function deleteArticle(article, status) {
    const caret = getDirectControl(article, CARET);
    if (!caret) throw new Error('Post overflow menu not found or ambiguous');
    caret.click();
    const deleteItem = await waitFor(menuDeleteItem);
    if (!deleteItem) throw new Error('Delete menu item did not appear');
    deleteItem.click();
    const confirm = await waitFor(confirmationDeleteButton);
    if (!confirm) throw new Error('Delete confirmation dialog did not appear');
    confirm.click();
    const gone = await waitFor(() => !article.isConnected || ![...document.querySelectorAll(ARTICLE)].some((node) => getStatusFromArticle(node, state.handle)?.id === status.id));
    if (!gone) throw new Error('Deletion could not be verified; not retrying');
  }

  function markProcessed(id) { state.processedIds.add(id); state.counts.processed += 1; saveProgress(); }

  async function inspectArticle(article) {
    const status = getStatusFromArticle(article, state.handle);
    if (!status || state.processedIds.has(status.id)) return false;
    markProcessed(status.id);
    const likes = getLikeCount(article);
    if (!likes.known) {
      state.counts.skipped += 1;
      console.warn(`[SKIPPED] Unable to determine Like count | ${status.url}`, likes.reason);
      return true;
    }
    if (likes.value >= CONFIG.MIN_LIKES_TO_KEEP) {
      state.counts.kept += 1;
      log('normal', `[KEEP] ❤️ ${likes.value} | ${status.url}`);
      return true;
    }
    state.counts.candidates += 1;
    if (CONFIG.DRY_RUN) {
      log('minimal', `[DRY RUN] DELETE ❤️ ${likes.value} | ${status.url}`);
      return true;
    }
    try {
      await deleteArticle(article, status);
      state.counts.deleted += 1;
      console.log(`[DELETED] ❤️ ${likes.value} | ${status.url}`);
    } catch (error) {
      state.counts.errors += 1;
      console.error(`[ERROR] ${error.message} | ${status.url}`);
    }
    return true;
  }

  async function waitForTimelineChange() {
    const before = document.querySelectorAll(ARTICLE).length;
    window.scrollBy({ top: Math.max(window.innerHeight * 0.85, 500), left: 0, behavior: 'auto' });
    await waitFor(() => document.querySelectorAll(ARTICLE).length !== before, SPEEDS[CONFIG.SPEED_MODE].scroll);
  }

  function printSummary() {
    const seconds = ((Date.now() - state.startedAt) / 1000).toFixed(1);
    console.table({
      'total processed': state.counts.processed, 'would delete': state.counts.candidates,
      deleted: state.counts.deleted, preserved: state.counts.kept, skipped: state.counts.skipped,
      errors: state.counts.errors, 'elapsed time': `${seconds}s`,
    });
  }

  // Exposed for dependency-free fixture tests and selector maintenance; never sends data.
  window.__xPostCleanerInternals = Object.freeze({ parseLikeCount, parseOwnedStatusUrl, getStatusFromArticle });

  try {
    if (state.running) throw new Error('Another X Post Cleaner instance is already running. Use stopXCleaner() first.');
    if (location.hostname !== 'x.com' && location.hostname !== 'www.x.com') throw new Error('Open this snippet on x.com first.');
    validateConfig();
    state.handle = resolveHandle();
    if (!state.handle) throw new Error('Could not safely detect an account. Set CONFIG.HANDLE and open that profile or its /with_replies view.');
    state.running = true; state.startedAt = Date.now(); loadProgress();
    console.log(`[X Post Cleaner v${VERSION}] account=@${state.handle}, newest eligible limit=${CONFIG.MAX_POSTS_TO_DELETE}, keep ≥${CONFIG.MIN_LIKES_TO_KEEP} likes, ${CONFIG.DRY_RUN ? 'DRY RUN' : 'LIVE DELETE'}, ${CONFIG.SPEED_MODE}. Stop: stopXCleaner()`);
    if (!CONFIG.DRY_RUN && !window.confirm(`IRREVERSIBLE: delete up to the ${CONFIG.MAX_POSTS_TO_DELETE} newest eligible @${state.handle} posts with fewer than ${CONFIG.MIN_LIKES_TO_KEEP} likes?\n\nClick Cancel to stop.`)) {
      throw new Error('Live deletion was cancelled.');
    }
    const escapeHandler = (event) => { if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) window.stopXCleaner(); };
    document.addEventListener('keydown', escapeHandler);
    let emptyScrolls = 0;
    while (!state.stopped && state.counts.candidates < CONFIG.MAX_POSTS_TO_DELETE && emptyScrolls < CONFIG.MAX_EMPTY_SCROLLS) {
      let found = 0;
      for (const article of [...document.querySelectorAll(ARTICLE)]) {
        if (state.stopped || state.counts.candidates >= CONFIG.MAX_POSTS_TO_DELETE) break;
        try { if (await inspectArticle(article)) found += 1; }
        catch (error) { state.counts.errors += 1; console.error('[ERROR] Safe article inspection failed:', error); }
      }
      emptyScrolls = found ? 0 : emptyScrolls + 1;
      if (!state.stopped && state.counts.candidates < CONFIG.MAX_POSTS_TO_DELETE && emptyScrolls < CONFIG.MAX_EMPTY_SCROLLS) {
        await waitForTimelineChange();
      }
    }
    console.log(state.stopped ? '[X Post Cleaner] Stopped by user.' : state.counts.candidates >= CONFIG.MAX_POSTS_TO_DELETE
      ? `[X Post Cleaner] Reached the configured limit of ${CONFIG.MAX_POSTS_TO_DELETE} newest eligible posts.`
      : `[X Post Cleaner] Finished after ${emptyScrolls} empty scroll cycles.`);
    document.removeEventListener('keydown', escapeHandler);
  } catch (error) {
    console.error(`[X Post Cleaner] Did not start: ${error.message}`);
  } finally {
    state.running = false;
    if (state.startedAt) printSummary();
  }
})();
