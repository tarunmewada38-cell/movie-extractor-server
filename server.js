const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Title Cleaner Utility
function cleanTitle(title) {
    if (!title) return '';
    return title
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '+')
        .trim();
}

const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*|q=0.8",
    "Referer": "https://www.google.com/"
};

async function searchAndExtract(site, query) {
    try {
        const cleanQuery = cleanTitle(query);
        if (!cleanQuery) return null;

        const searchUrl = `${site}/wp-admin/admin-ajax.php?action=data_fetch&query=${cleanQuery}`;
        const { data: searchResults } = await axios.get(searchUrl, { headers, timeout: 6000 });
        const $ = cheerio.load(searchResults);
        
        let postUrl = $('a').first().attr('href');
        if (!postUrl) {
            const fallbackUrl = `${site}/?s=${cleanQuery}`;
            const { data: fallbackData } = await axios.get(fallbackUrl, { headers, timeout: 6000 });
            const $$ = cheerio.load(fallbackData);
            postUrl = $$('h2.title a, .item a, .result-item a, article a').first().attr('href');
        }

        if (!postUrl) return null;

        const { data: postData } = await axios.get(postUrl, { headers, timeout: 6000 });
        const $$ = cheerio.load(postData);

        let streamUrl = null;
        $$('a').each((i, el) => {
            const href = $$(el).attr('href');
            if (href && (href.includes('.m3u8') || href.includes('.mp4') || href.includes('pixeldrain') || href.includes('hubcloud'))) {
                streamUrl = href;
                return false;
            }
        });

        return streamUrl;
    } catch (err) {
        console.error(`Error scraping ${site}:`, err.message);
        return null;
    }
}

app.get('/api/extract', async (req, res) => {
    const { tmdbId, type, query } = req.query;
    
    if (!query && !tmdbId) {
        return res.status(400).json({ success: false, streamUrl: null, message: "Query or tmdbId required" });
    }

    const preferredSites = [
        "https://vegamovies.pages.dev",
        "https://katmoviehd.eu",
        "https://hdhub4u.tv"
    ];

    const searchQuery = query || tmdbId;

    for (let site of preferredSites) {
        const foundLink = await searchAndExtract(site, searchQuery);
        if (foundLink) {
            return res.json({ success: true, streamUrl: foundLink, message: null });
        }
    }

    return res.json({ success: false, streamUrl: null, message: "Stream link not found on preferred sites." });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
