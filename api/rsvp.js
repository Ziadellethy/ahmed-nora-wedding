// RSVP endpoint backed by Upstash Redis (Vercel KV env vars injected by the store).
// POST {name, companions} -> stores an RSVP entry.
// GET with header "Authorization: Bearer <RSVP_ADMIN_SECRET>" -> lists all entries.
export default async function handler(req, res) {
  const base = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!base || !token) {
    res.status(500).json({ error: 'store not configured' });
    return;
  }
  const headers = { Authorization: 'Bearer ' + token };

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const name = String(body.name || '').trim().slice(0, 100);
      let companions = parseInt(body.companions, 10);
      if (isNaN(companions) || companions < 0 || companions > 5) companions = 0;
      if (name.length < 5) {
        res.status(400).json({ error: 'invalid name' });
        return;
      }
      const entry = JSON.stringify({ name, companions, ts: new Date().toISOString() });
      const r = await fetch(base + '/rpush/rsvps/' + encodeURIComponent(entry), { method: 'POST', headers });
      if (!r.ok) throw new Error('store error ' + r.status);
      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'failed to save' });
    }
    return;
  }

  if (req.method === 'GET') {
    const secret = process.env.RSVP_ADMIN_SECRET || '';
    const auth = req.headers.authorization || '';
    if (!secret || auth !== 'Bearer ' + secret) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const r = await fetch(base + '/lrange/rsvps/0/-1', { method: 'POST', headers });
    const data = await r.json();
    const entries = (data.result || []).map(function (s) { try { return JSON.parse(s); } catch (e) { return { raw: s }; } });
    res.status(200).json({ count: entries.length, entries });
    return;
  }

  res.status(405).json({ error: 'method not allowed' });
}
