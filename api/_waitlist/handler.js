// Product waitlist + anonymous page-view beacon for the Forma studio site.
//
// Folded into /api/comments (vercel.json rewrites /api/waitlist here with
// ?fn=waitlist) because a Hobby deployment is capped at 12 serverless
// functions. Storage is the same Supabase project as comments, reached only
// through SECURITY DEFINER RPCs (see migration forma_waitlist).
//
// GET  /api/waitlist?product=landed                 -> { count }
// POST /api/waitlist { product, email, stage?, note?, honeypot? }
//      -> 201 { ok: true, created, count }
// POST /api/waitlist { action: "view", product }    -> 204   (one per IP per 10 min)
//
// Never stores raw IPs — only the salted hash the caller passes in.

const PRODUCTS = new Set(['landed']);
const STAGES = new Set(['on', 'tapering', 'stopped', 'considering']);
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[a-z]{2,24}$/i;
const LINK_RE = /https?:|\bwww\.|\bhttp\b/i;
const NOTE_MAX = 300;
const JOINS_PER_WINDOW = 5;

export async function handleWaitlist(req, res, ctx) {
  const { rpc, storageConfigured, underCap, ipHash, queryOf, parseBody } = ctx;

  if (req.method === 'GET') {
    const product = cleanProduct(queryOf(req).product);
    if (!product) return res.status(400).json({ error: 'bad_product' });
    if (!storageConfigured()) return res.status(200).json({ count: 0 });
    return res.status(200).json({ count: await count(rpc, product) });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const body = parseBody(req);
  const product = cleanProduct(body.product);
  if (!product) return res.status(400).json({ error: 'bad_product' });

  if (body.action === 'view') {
    if (!storageConfigured()) return res.status(204).end();
    // underCap counts hits per (kind, ip, 10-minute bucket); cap 1 = first view only.
    if (await underCap(ipHash, `view:${product}`, 1)) {
      try {
        await rpc('waitlist_event', { p_product: product, p_kind: 'view', p_ip_hash: ipHash });
      } catch (e) {
        console.error('waitlist view beacon failed:', e);
      }
    }
    return res.status(204).end();
  }
  if (body.action != null && body.action !== 'join') return res.status(400).json({ error: 'bad_action' });

  if (typeof body.honeypot === 'string' && body.honeypot.trim() !== '') return res.status(400).json({ error: 'rejected' });
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'bad_email' });
  const stage = typeof body.stage === 'string' && STAGES.has(body.stage.trim()) ? body.stage.trim() : null;
  let note = typeof body.note === 'string' ? body.note.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX) : '';
  if (note && LINK_RE.test(note)) return res.status(400).json({ error: 'links_not_allowed' });

  if (!storageConfigured()) return res.status(503).json({ error: 'storage_unavailable' });
  if (!(await underCap(ipHash, `join:${product}`, JOINS_PER_WINDOW))) return res.status(429).json({ error: 'rate_limited' });

  const rows = await rpc('waitlist_join', {
    p_product: product,
    p_email: email,
    p_stage: stage,
    p_note: note || null,
    p_ip_hash: ipHash,
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  const created = Boolean(row && row.created);
  return res.status(201).json({ ok: true, created, count: await count(rpc, product) });
}

async function count(rpc, product) {
  try {
    const n = await rpc('waitlist_count', { p_product: product });
    return Number(n) || 0;
  } catch (e) {
    console.error('waitlist_count failed:', e);
    return 0;
  }
}

function cleanProduct(v) {
  if (typeof v !== 'string') return null;
  const p = v.trim().toLowerCase();
  return PRODUCTS.has(p) ? p : null;
}
