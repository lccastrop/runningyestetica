// api/feed.js — proxy del feed RSS de Substack (Vercel serverless function)
// Compatible con el runtime ESM del proyecto frontend.

export default async function handler(req, res) {
  try {
    const upstream = await fetch('https://pacesocial.substack.com/feed', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
    });

    if (!upstream.ok) {
      throw new Error('Feed no disponible: ' + upstream.status);
    }

    const xml = await upstream.text();

    if (!/^\s*(<\?xml|<rss|<feed)/i.test(xml)) {
      throw new Error('Feed inválido');
    }

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200);
    res.send(xml);
  } catch (err) {
    console.error('[api/feed]', err instanceof Error ? err.message : err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error inesperado' });
  }
}
