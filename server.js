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
  res.send(ROBOTS_TXT_CONTENT);
});

app.all(['/sitemap.xml', '/sitemap.xml/'], (req, res) => {
  res.status(200);
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  const distFile = path.join(__dirname, 'dist', 'sitemap.xml');
  const pubFile = path.join(__dirname, 'public', 'sitemap.xml');
  if (fs.existsSync(distFile)) {
    res.sendFile(distFile);
  } else if (fs.existsSync(pubFile)) {
    res.sendFile(pubFile);
  } else {
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://smartproduct-manager.onrender.com/</loc>\n    <lastmod>2026-10-04</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>`);
  }
});

// 2. Serve static assets from the compiled build output folder
app.use(express.static(path.join(__dirname, 'dist')));

// 3. Fallback to index.html for Single Page Application routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Production server running and listening on port ${PORT}`);
});
