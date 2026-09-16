// Vision proxy for the Lapis app (rock & crystal identifier).
//
// Lapis has no user accounts, so this endpoint keeps the Gemini key server-side
// and rate-limits by client IP. It sends the photo to Gemini and returns a
// strict JSON identification the app can render directly.
//
// Request (POST, JSON): { "image": "<base64>", "mime": "image/jpeg" }
// Header:               x-lapis-app: lapis_v1_9f3ac   (casual-abuse deterrent)
// Env (Vercel):         GEMINI_API_KEY   (a.k.a. Google AI Studio key)
//                       FIREBASE_SERVICE_ACCOUNT (optional; enables IP rate cap)

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
const MODEL = 'gemini-2.5-flash';
const APP_TOKEN = 'lapis_v1_9f3ac';
const HOURLY_IP_CAP = 40;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_OUTPUT_TOKENS = 2048; // keep base64 body under Vercel's ~4.5MB limit

if (getApps().length === 0) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    } else {
      initializeApp({ projectId: 'forma-3803d' });
    }
  } catch (e) {
    console.error('firebase init failed:', e);
  }
}

const PROMPT = `You are a friendly expert geologist and gemologist. Identify the single most prominent rock, mineral, crystal, gemstone or fossil in the photo.

Respond with ONLY a JSON object, no markdown, matching exactly:
{
  "isRockOrCrystal": boolean,   // false if the photo clearly is not a rock/mineral/crystal/gem/fossil
  "name": string,               // most likely common name, e.g. "Amethyst"
  "category": string,           // one of: Crystal, Mineral, Rock, Gemstone, Fossil
  "aka": string[],              // up to 3 alternate or related names, [] if none
  "confidence": number,         // 0.0-1.0 honest confidence
  "summary": string,            // 1-2 warm sentences a curious beginner enjoys
  "colorHex": string,           // dominant color as #RRGGBB
  "properties": [ { "label": string, "value": string } ],  // 4-6: e.g. Hardness, Luster, Crystal system, Streak, Composition, Transparency
  "meaning": string,            // 1-2 sentences of popular metaphysical/folklore meaning, framed as "believed to" / "in crystal lore"
  "formation": string,          // 1-2 sentences on how/where it forms
  "care": string,               // 1 sentence of practical care
  "valueRange": string,         // rough hobbyist price for a typical specimen, e.g. "$5–$40"
  "funFact": string             // 1 surprising sentence
}
If unsure of the exact species, give the closest family and lower the confidence. Never claim medical, safety, or investment facts. Keep every string concise.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-lapis-app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'server_not_configured' });
  if ((req.headers['x-lapis-app'] || '') !== APP_TOKEN) return res.status(403).json({ error: 'forbidden' });

  const { image, mime } = req.body || {};
  if (!image || typeof image !== 'string') return res.status(400).json({ error: 'missing_image' });
  if (Buffer.byteLength(image, 'base64') > MAX_IMAGE_BYTES) return res.status(413).json({ error: 'image_too_large' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!(await underHourlyCap(ip))) return res.status(429).json({ error: 'rate_limited' });

  try {
    // Gemini 2.5 Flash "thinks" by default and those hidden tokens count against
    // maxOutputTokens; with a small cap the JSON came back truncated and the
    // app showed a connection error (App Review 2.1(a), Sep 16 2026). Thinking
    // is off, the cap is generous, and a truncated/unparseable reply is retried.
    let parsed = null;
    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
      const { text, finishReason, status, errText } = await callGemini(image, mime, attempt === 0 ? 0.3 : 0.1);
      if (status !== 200) {
        console.error('gemini error', status, errText);
        if (attempt === 1) return res.status(502).json({ error: 'upstream' });
        continue;
      }
      parsed = parseIdentification(text);
      if (!parsed) console.error('identify unparseable (attempt ' + (attempt + 1) + ', finish ' + finishReason + '):', String(text).slice(0, 200));
    }
    if (!parsed) return res.status(502).json({ error: 'unparseable' });
    return res.status(200).json(parsed);
  } catch (e) {
    console.error('identify failed:', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export const maxDuration = 60;

async function callGemini(image, mime, temperature) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const gRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mime || 'image/jpeg', data: image } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  if (!gRes.ok) return { status: gRes.status, errText: await gRes.text() };
  const data = await gRes.json();
  const cand = data?.candidates?.[0];
  const text = (cand?.content?.parts || []).map((p) => p.text || '').join('');
  return { status: 200, text, finishReason: cand?.finishReason || '' };
}

// Strict parse first; then the largest {...} block; null if neither is valid JSON.
function parseIdentification(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' ? v : null;
  } catch {}
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const v = JSON.parse(m[0]);
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

async function underHourlyCap(ip) {
  try {
    const hour = new Date().toISOString().slice(0, 13);
    const ref = getFirestore().collection('lapisUsage').doc(`${ip}_${hour}`);
    const snap = await ref.get();
    const count = snap.exists ? snap.data().count || 0 : 0;
    if (count >= HOURLY_IP_CAP) return false;
    await ref.set({ count: FieldValue.increment(1), hour, ip }, { merge: true });
    return true;
  } catch (e) {
    console.error('rate counter error (failing open):', e);
    return true; // fail open — a counter outage must not break the app
  }
}
