import app from '../server';

export default function handler(req: any, res: any) {
  const rawUrl = req.url || '';
  
  // 1. Extract original route from __route parameter passed by vercel.json rewrite
  try {
    const urlObj = new URL(rawUrl, 'http://localhost');
    const routeParam = urlObj.searchParams.get('__route') || urlObj.searchParams.get('route') || urlObj.searchParams.get('__url');
    if (routeParam) {
      urlObj.searchParams.delete('__route');
      urlObj.searchParams.delete('route');
      urlObj.searchParams.delete('__url');
      const search = urlObj.searchParams.toString();
      req.url = (routeParam.startsWith('/') ? routeParam : '/' + routeParam) + (search ? `?${search}` : '');
    }
  } catch {}

  // 2. Fallback check for Vercel internal headers
  if (!req.url || req.url === '/' || req.url.startsWith('/api/index')) {
    const matchedPath = (
      req.headers['x-matched-path'] ||
      req.headers['x-vercel-matched-path'] ||
      req.headers['x-forwarded-uri'] ||
      req.headers['x-original-uri'] ||
      ''
    ) as string;

    if (matchedPath && matchedPath.startsWith('/api') && !matchedPath.startsWith('/api/index')) {
      req.url = matchedPath;
    }
  }

  // 3. Fallback: Parse x-now-route-matches if present
  if ((!req.url || req.url === '/' || req.url === '/api' || req.url.startsWith('/api/index')) && req.headers['x-now-route-matches']) {
    const headerStr = String(req.headers['x-now-route-matches']);
    const match = headerStr.match(/1=([^&]+)/);
    if (match && match[1]) {
      const decoded = decodeURIComponent(match[1]);
      req.url = '/api/' + (decoded.startsWith('/') ? decoded.slice(1) : decoded);
    }
  }

  // 4. Strip /api/index prefix if still remaining
  if (req.url && req.url.startsWith('/api/index/')) {
    req.url = req.url.replace('/api/index/', '/api/');
  }

  return app(req, res);
}

