const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 1. Title Cleaning Utility
function cleanTitle(title) {
    return title
        .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
        .replace(/\s+/g, '+')          // Replace spaces with +
        .trim();
}

// 2. Generic Headers to bypass basic protection
const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Referer": "https://www.google.com/"
};

// 3. Multi-Stage Scraper Engine
async function searchAndExtract(site, query) {
    try {
        const cleanQuery = cleanTitle(query);
        
        // STAGE 1: WordPress AJAX Search
        // Format: /wp-admin/admin-ajax.php?action=data_fetch&query=...
        const searchUrl = `${site}/wp-admin/admin-ajax.php?action=data_fetch&query=${cleanQuery}`;
        const { data: searchResults } = await axios.get(searchUrl, { headers, timeout: 5000 });

        const $ = cheerio.load(searchResults);
        const postUrl = $('a').first().attr('href'); // Assuming first result is the movie

        if (!postUrl) return null;

        // STAGE 2: Visit Post Page
        const { data: postData } = await axios.get(postUrl, { headers, timeout: 5000 });
        const $$ = cheerio.load(postData);

        // STAGE 3: Extracting Links (Looking for direct download buttons/links)
        const links = [];
        $$('a').each((i, el) => {
            const href = $$(el).attr('href');
            if (href && (href.includes('m3u8') || href.includes('mp4') || href.includes('drive'))) {
                links.push(href);
            }
        });

        return links.length > 0 ? links[0] : null;

    } catch (err) {
        console.error(`Error scraping ${site}:`, err.message);
        return null;
    }
}

app.get('/api/extract', async (req, res) => {
    const { query } = req.query;
    
    if (!query) {
        return res.status(400).json({ success: false, message: "Query parameter is required" });
    }

    const preferredSites = [
        "https://vegamovies.pages.dev",
        "https://katmoviehd.eu",
        "https://hdhub4u.tv"
    ];

    for (let site of preferredSites) {
        console.log(`Trying ${site} for: ${query}`);
        const streamUrl = await searchAndExtract(site, query);
        
        if (streamUrl) {
            return res.json({ success: true, streamUrl });
        }
    }

    res.json({ success: false, message: "Stream link not found on preferred sites." });
});

app.listen(PORT, () => {
    console.log(`Extractor Server running on port ${PORT}`);
});
