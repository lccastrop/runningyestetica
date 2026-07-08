// api/feed.js — proxy del feed RSS de Substack (Vercel serverless function)
// Requiere Node 20+ (fetch nativo, sigue redirects automáticamente)

module.exports = async function handler(req, res) {
  try {
    const upstream = await fetch('https://pacesocial.substack.com/feed');

    if (!upstream.ok) {
      return res
        .status(502)
        .json({ error: 'Feed no disponible: ' + upstream.status });
    }

    const xml = await upstream.text();

    res
      .setHeader('Content-Type', 'application/xml; charset=utf-8')
      .setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
      .status(200)
      .send(xml);

  } catch (err) {
    console.error('[api/feed]', err.message);
    res.status(500).json({ error: err.message });
  }
};
