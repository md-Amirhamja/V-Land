const MIRRORS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).send('POST only'); return; }
  let body = req.body;
  let type = req.headers['content-type'] || 'application/x-www-form-urlencoded';
  if (Buffer.isBuffer(body)) body = body.toString();
  else if (body && typeof body === 'object') { body = new URLSearchParams(body).toString(); type = 'application/x-www-form-urlencoded'; }
  if (!body) { res.status(400).send('empty request'); return; }
  for (const url of MIRRORS) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 18000);
      const r = await fetch(url, { method: 'POST', body, signal: ctl.signal,
        headers: { 'Content-Type': type, 'User-Agent': 'Mozilla/5.0 (compatible; VLand/1.0)' } });
      clearTimeout(t);
      if (!r.ok) continue;
      const text = await r.text();
      res.setHeader('Content-Type', 'application/json');
      res.status(200).send(text);
      return;
    } catch (e) { /* try next mirror */ }
  }
  res.status(502).send('all Overpass mirrors failed');
}
