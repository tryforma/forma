// Anonymous comments for the Forma studio site (paths, Lounge wall, home).
//
// Storage is Supabase, reached through PostgREST RPC endpoints with plain
// fetch (no supabase-js). Direct table access is blocked; every operation is a
// SECURITY DEFINER function the anon key may execute. Requests are rate-limited
// by a salted hash of the client IP (failing open if the counter is
// unavailable), CORS is open and every response is JSON. No accounts: a
// comment is a name (optional), a text and a page key. Raw IPs are never sent
// to storage; only sha256(ip|salt).
//
// GET  /api/comments?page=/paths/founders/&limit=50&cursor=<ms>
//      -> { comments: [{id, page, name, text, parentId, likes, createdAt}], next }
//         newest-first, replies included (client nests by parentId)
// POST /api/comments  { page, name?, text, parentId?, honeypot? }
//      -> { comment: {...} }           (201)
// POST /api/comments  { action: "like", id }
//      -> { id, likes, liked }         (200)
//
// Env (Vercel): SUPABASE_URL, SUPABASE_ANON_KEY   (required; without them GET
//               returns an empty list and POST answers 503 storage_unavailable)
//               COMMENTS_IP_SALT                  (optional; salts the IP hash)
//
// RPCs: comments_list(p_page, p_limit, p_cursor)          -> rows, newest first, hidden filtered
//       comments_rate_hit(p_key, p_limit, p_window_seconds) -> boolean (true = allowed)
//       comments_post(p_page, p_name, p_text, p_parent, p_ip_hash, p_hidden) -> row (raises parent_not_found)
//       comments_like(p_id, p_ip_hash)                      -> {id, likes, liked} (raises not_found)

import crypto from 'crypto';
// /api/world (rewritten here in vercel.json) shares this function because a
// Hobby deployment is capped at 12 serverless functions and we are at the cap.
import { handleWorld } from './_world/board.js';
// /api/waitlist (product waitlists + view beacon) shares it for the same reason.
import { handleWaitlist } from './_waitlist/handler.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const IP_SALT = process.env.COMMENTS_IP_SALT || 'forma-site-comments-v1';

const RATE_WINDOW_SECONDS = 600;
const POSTS_PER_WINDOW = 5;
const LIKES_PER_WINDOW = 60;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const NAME_MAX = 32;
const TEXT_MAX = 800;
const PAGE_MAX = 120;
const PAGE_RE = /^\/[a-z0-9\-/]*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINK_RE = /https?:|\bwww\.|\bhttp\b|\b[a-z0-9-]+\.(?:com|net|org|io|app|co|me|ly|xyz|info|biz|gg|tv|ai|dev|link|site|online|shop)\b/i;

// Comments matching any of these are stored but hidden (not rejected), so a
// slip in an otherwise honest note does not bounce with an error.
const BAD_WORDS = [
  /\bfuck(?:ing|ed|er|s)?\b/i, /\bshit(?:ty|s)?\b/i, /\bbitch(?:es)?\b/i, /\bcunt\b/i, /\basshole\b/i,
  /\bnigg(?:a|er)s?\b/i, /\bfag(?:got)?s?\b/i, /\bretard(?:ed|s)?\b/i, /\btranny\b/i, /\bkike\b/i, /\bspic\b/i, /\bchink\b/i,
  /\bkill (?:yourself|urself)\b/i, /\bkys\b/i, /\bslut\b/i, /\bwhore\b/i, /\brape\b/i, /\bporn\b/i,
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const fn = queryOf(req).fn;
    if (fn === 'waitlist') {
      return await handleWaitlist(req, res, {
        rpc,
        storageConfigured,
        underCap,
        ipHash: hashIp(clientIp(req)),
        queryOf,
        parseBody,
      });
    }
    if (fn === 'world') {
      return await handleWorld(req, res, {
        rpc,
        storageConfigured,
        underCap,
        ipHash: hashIp(clientIp(req)),
        queryOf,
        parseBody,
      });
    }
    if (req.method === 'GET') return await handleList(req, res);
    if (req.method === 'POST') {
      const body = parseBody(req);
      const ipHash = hashIp(clientIp(req));
      if (body.action === 'like') return await handleLike(body, ipHash, res);
      if (body.action != null && body.action !== 'post') return res.status(400).json({ error: 'bad_action' });
      return await handlePost(body, ipHash, res);
    }
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error('comments failed:', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// ---------------------------------------------------------------------------
// GET: list
// ---------------------------------------------------------------------------

async function handleList(req, res) {
  const q = queryOf(req);
  const page = normalizePage(q.page);
  if (!page) return res.status(400).json({ error: 'bad_page' });
  const limit = clampInt(q.limit, 1, MAX_LIMIT, DEFAULT_LIMIT);
  const cursor = q.cursor != null && q.cursor !== '' ? Number(q.cursor) : null;
  if (cursor != null && !Number.isFinite(cursor)) return res.status(400).json({ error: 'bad_cursor' });

  if (!storageConfigured()) {
    console.error('comments: SUPABASE_URL / SUPABASE_ANON_KEY missing; serving empty list');
    return res.status(200).json({ comments: [], next: null });
  }

  const rows = asRows(await rpc('comments_list', {
    p_page: page,
    p_limit: limit + 1,
    p_cursor: cursor != null ? new Date(cursor).toISOString() : null,
  }));
  const hasMore = rows.length > limit;
  const out = rows.slice(0, limit).map(publicComment);
  const next = hasMore && out.length ? Date.parse(out[out.length - 1].createdAt) : null;
  return res.status(200).json({ comments: out, next });
}

// ---------------------------------------------------------------------------
// POST: create
// ---------------------------------------------------------------------------

async function handlePost(body, ipHash, res) {
  if (typeof body.honeypot === 'string' && body.honeypot.trim() !== '') return res.status(400).json({ error: 'rejected' });

  const page = normalizePage(body.page);
  if (!page) return res.status(400).json({ error: 'bad_page' });

  const text = cleanText(body.text, TEXT_MAX);
  if (!text) return res.status(400).json({ error: 'missing_text' });
  if (LINK_RE.test(text)) return res.status(400).json({ error: 'links_not_allowed' });

  let name = cleanLine(body.name, NAME_MAX);
  if (name && LINK_RE.test(name)) return res.status(400).json({ error: 'links_not_allowed' });
  if (!name) name = 'anonymous';

  let parentId = null;
  if (body.parentId != null && body.parentId !== '') {
    if (typeof body.parentId !== 'string' || !UUID_RE.test(body.parentId.trim())) return res.status(400).json({ error: 'bad_parent' });
    parentId = body.parentId.trim().toLowerCase();
  }

  if (!storageConfigured()) return res.status(503).json({ error: 'storage_unavailable' });
  if (!(await underCap(ipHash, 'post', POSTS_PER_WINDOW))) return res.status(429).json({ error: 'rate_limited' });

  const hidden = BAD_WORDS.some((re) => re.test(text) || re.test(name));
  let row;
  try {
    row = asRow(await rpc('comments_post', {
      p_page: page,
      p_name: name,
      p_text: text,
      p_parent: parentId, // the RPC flattens reply-to-reply to the root itself
      p_ip_hash: ipHash,
      p_hidden: hidden,
    }));
  } catch (e) {
    if (rpcRaised(e, 'parent_not_found')) return res.status(404).json({ error: 'parent_not_found' });
    throw e;
  }
  if (!row) throw new Error('comments_post returned no row');
  const out = publicComment(row);
  if (row.hidden === true || hidden) out.hidden = true;
  return res.status(201).json({ comment: out });
}

// ---------------------------------------------------------------------------
// POST: like  { action: "like", id }
// ---------------------------------------------------------------------------

async function handleLike(body, ipHash, res) {
  const id = typeof body.id === 'string' ? body.id.trim().toLowerCase() : '';
  if (!id || !UUID_RE.test(id)) return res.status(400).json({ error: 'bad_id' });
  if (!storageConfigured()) return res.status(503).json({ error: 'storage_unavailable' });
  if (!(await underCap(ipHash, 'like', LIKES_PER_WINDOW))) return res.status(429).json({ error: 'rate_limited' });

  let row;
  try {
    row = asRow(await rpc('comments_like', { p_id: id, p_ip_hash: ipHash }));
  } catch (e) {
    if (rpcRaised(e, 'not_found')) return res.status(404).json({ error: 'not_found' });
    throw e;
  }
  if (!row) return res.status(404).json({ error: 'not_found' });
  return res.status(200).json({ id: String(row.id || id), likes: Number(row.likes) || 0, liked: row.liked === true });
}

// ---------------------------------------------------------------------------
// Rate limiting (fails open, like the other handlers)
// ---------------------------------------------------------------------------

async function underCap(ipHash, kind, cap) {
  try {
    const bucket = Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1000));
    const allowed = await rpc('comments_rate_hit', {
      p_key: `${kind}:${ipHash}:${bucket}`,
      p_limit: cap,
      p_window_seconds: RATE_WINDOW_SECONDS,
    });
    return allowed !== false;
  } catch (e) {
    console.error('rate counter error (failing open):', e);
    return true; // fail open — a counter outage must not break the site
  }
}

// ---------------------------------------------------------------------------
// Supabase RPC over fetch
// ---------------------------------------------------------------------------

function storageConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

async function rpc(fn, params) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  const text = await r.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!r.ok) {
    const msg = data && typeof data === 'object' ? data.message || data.hint || data.details || '' : String(text).slice(0, 200);
    const e = new Error(`rpc ${fn} failed (${r.status}): ${msg}`);
    e.status = r.status;
    e.rpcMessage = String(msg || '');
    throw e;
  }
  return data;
}

// A `raise exception 'code'` inside the function surfaces as a PostgREST error
// whose message is that code.
function rpcRaised(e, code) {
  return Boolean(e && typeof e.rpcMessage === 'string' && e.rpcMessage.includes(code));
}

function asRows(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}
function asRow(data) {
  return asRows(data)[0] || null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

function hashIp(ip) {
  return crypto.createHash('sha256').update(`${ip}|${IP_SALT}`).digest('hex').slice(0, 40);
}

function parseBody(req) {
  const b = req.body;
  if (b && typeof b === 'object') return b;
  if (typeof b === 'string' && b.trim()) {
    try {
      const parsed = JSON.parse(b);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function queryOf(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  try {
    const u = new URL(req.url || '/', 'http://localhost');
    return Object.fromEntries(u.searchParams.entries());
  } catch {
    return {};
  }
}

// Collapses slashes, ensures a trailing slash, drops index.html; null if invalid.
function normalizePage(v) {
  if (typeof v !== 'string') return null;
  let p = v.trim();
  if (!p || p.length > PAGE_MAX) return null;
  p = p.replace(/\/index\.html?$/i, '/').replace(/\/+/g, '/');
  if (!p.endsWith('/')) p += '/';
  if (!PAGE_RE.test(p)) return null;
  return p;
}

function stripHtml(s) {
  return String(s)
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;[^&]*&gt;/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
}

function cleanLine(v, max) {
  if (typeof v !== 'string') return '';
  return stripHtml(v).replace(/\s+/g, ' ').trim().slice(0, max).trim();
}

function cleanText(v, max) {
  if (typeof v !== 'string') return '';
  return stripHtml(v)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
    .trim();
}

function clampInt(v, min, max, dflt) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}

function publicComment(row) {
  const ms = Date.parse(row.created_at);
  return {
    id: String(row.id),
    page: row.page,
    name: row.name || 'anonymous',
    text: row.text || '',
    parentId: row.parent_id ? String(row.parent_id) : null,
    likes: Number(row.likes) || 0,
    createdAt: Number.isFinite(ms) ? new Date(ms).toISOString() : new Date().toISOString(),
  };
}
