import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets from the compiled build output folder
app.use(express.static(path.join(__dirname, 'dist')));

// Explicit SEO Routes
app.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  const distFile = path.join(__dirname, 'dist', 'robots.txt');
  const pubFile = path.join(__dirname, 'public', 'robots.txt');
  import('fs').then(fs => {
    if (fs.existsSync(distFile)) {
      res.sendFile(distFile);
    } else if (fs.existsSync(pubFile)) {
      res.sendFile(pubFile);
    } else {
      res.status(200).send("User-agent: *\nAllow: /\n\nSitemap: https://smartproduct-manager.onrender.com/sitemap.xml\n");
    }
  });
});

app.get('/sitemap.xml', (req, res) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  const distFile = path.join(__dirname, 'dist', 'sitemap.xml');
  const pubFile = path.join(__dirname, 'public', 'sitemap.xml');
  import('fs').then(fs => {
    if (fs.existsSync(distFile)) {
      res.sendFile(distFile);
    } else if (fs.existsSync(pubFile)) {
      res.sendFile(pubFile);
    } else {
      res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://smartproduct-manager.onrender.com/</loc>\n    <lastmod>2026-10-04</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>`);
    }
  });
});

// Fallback to index.html for Single Page Application routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Production server running and listening on port ${PORT}`);
});
