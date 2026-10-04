import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// EXACT PRODUCTION ROBOTS.TXT CONTENT
const ROBOTS_TXT_CONTENT = `User-agent: *\nAllow: /\n\nSitemap: https://smartproduct-manager.onrender.com/sitemap.xml\n`;

// 1. Direct Public Static SEO Endpoints (Highest Priority, before static middleware and SPA routing)
app.all(['/robots.txt', '/robots.txt/'], (req, res) => {
  res.status(200);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.setHeader('X-Robots-Tag', 'all');
  res.send(ROBOTS_TXT_CONTENT);
});

app.all(['/sitemap.xml', '/sitemap.xml/'], async (req, res) => {
  res.status(200);
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=3600');
  res.setHeader('X-Robots-Tag', 'all');
  
  const baseUrl = 'https://smartproduct-manager.onrender.com';
  const today = new Date().toISOString().split('T')[0];

  const entries = [
    { loc: `${baseUrl}/`, lastmod: today, changefreq: 'daily', priority: '1.0' },
    { loc: `${baseUrl}/?view=catalog`, lastmod: today, changefreq: 'daily', priority: '0.9' },
    { loc: `${baseUrl}/?view=stores`, lastmod: today, changefreq: 'daily', priority: '0.8' },
  ];

  try {
    const cfgPath = path.join(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      const projId = process.env.VITE_FIREBASE_PROJECT_ID || cfg.projectId;
      const dbId = process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || cfg.firestoreDatabaseId;
      const apiKey = process.env.VITE_FIREBASE_API_KEY || cfg.apiKey;

      if (projId && dbId) {
        const prodsUrl = `https://firestore.googleapis.com/v1/projects/${projId}/databases/${dbId}/documents/products?pageSize=100&key=${apiKey}`;
        const prodRes = await fetch(prodsUrl);
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          if (Array.isArray(prodData.documents)) {
            for (const doc of prodData.documents) {
              const docId = doc.name ? doc.name.split('/').pop() : null;
              if (docId) {
                const updatedAt = doc.updateTime ? doc.updateTime.split('T')[0] : today;
                entries.push({
                  loc: `${baseUrl}/?product=${encodeURIComponent(docId)}`,
                  lastmod: updatedAt,
                  changefreq: 'weekly',
                  priority: '0.8',
                });
              }
            }
          }
        }
      }
    }
  } catch {}

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(e => `  <url>\n    <loc>${e.loc}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`).join('\n')}
</urlset>`;

  res.send(xml);
});

// Protect private API, Admin, and Dashboard endpoints
app.use(['/api', '/admin', '/dashboard', '/superadmin', '/settings'], (req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  next();
});

// 2. Serve static assets from the compiled build output folder
const assetsPath = path.join(__dirname, 'dist', 'assets');
app.use(
  '/assets',
  express.static(assetsPath, {
    maxAge: '1y',
    immutable: true,
    fallthrough: true,
  })
);

// Intelligent Stale Hash Asset Fallback
app.get('/assets/*.css', (req, res) => {
  try {
    if (fs.existsSync(assetsPath)) {
      const cssFiles = fs.readdirSync(assetsPath).filter((f) => f.endsWith('.css'));
      if (cssFiles.length > 0) {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.sendFile(path.join(assetsPath, cssFiles[0]));
        return;
      }
    }
  } catch {}
  res.status(200).setHeader('Content-Type', 'text/css; charset=utf-8').send('/* fallback */');
});

app.get('/assets/*.js', (req, res) => {
  try {
    if (fs.existsSync(assetsPath)) {
      const jsFiles = fs.readdirSync(assetsPath).filter((f) => f.startsWith('index-') && f.endsWith('.js'));
      if (jsFiles.length > 0) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.sendFile(path.join(assetsPath, jsFiles[0]));
        return;
      }
    }
  } catch {}
  res.status(200).setHeader('Content-Type', 'application/javascript; charset=utf-8').send('/* fallback */');
});

app.all('/assets/*', (req, res) => {
  res.status(404).type('text/plain').send('Asset not found');
});

app.use(express.static(path.join(__dirname, 'dist')));

// 3. Fallback to index.html for Single Page Application routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Production server running and listening on port ${PORT}`);
});
