const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

function cleanTitle(title) {
    if (!title) return '';
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '+')
        .trim();
}

const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5"
};

async function searchAndExtract(site, query) {
    try {
        const cleanQuery = cleanTitle(query);
        if (!cleanQuery) return null;

        const searchUrl = `${site}/?s=${cleanQuery}`;
        const { data: searchData } = await axios.get(searchUrl, { headers, timeout: 7000 });
        const $ = cheerio.load(searchData);
        
        let postUrl = $('h2.title a, .item a, .result-item a, article a, .movies-list-culmns a, .post-title a').first().attr('href');
        if (!postUrl) return null;

        if (!postUrl.startsWith('http')) {
            postUrl = site + postUrl;
        }

        const { data: postData } = await axios.get(postUrl, { headers, timeout: 7000 });
        const $$ = cheerio.load(postData);

        let streamUrl = null;
        $$('a').each((i, el) => {
            const href = $$(el).attr('href');
            // Removed vidsrc from here to strictly focus on direct video/storage links
            if (href && (href.includes('.m3u8') || href.includes('.mp4') || href.includes('pixeldrain') || href.includes('hubcloud') || href.includes('filepress'))) {
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

    const searchQuery = query || tmdbId;

    // List of active Hindi/South focused domains
    const preferredSites = [
        "https://vegamovies.ist",
        "https://hdhub4u.wf",
        "https://katmoviehd.nl",
        "https://luxangi.com"
    ];

    for (let site of preferredSites) {
        const foundLink = await searchAndExtract(site, searchQuery);
        if (foundLink) {
            return res.json({ 
                success: true, 
                streamUrl: foundLink, 
                headers: { "User-Agent": headers["User-Agent"] }, 
                message: null 
            });
        }
    }

    // Fallback: If direct scraping fails, return failure instead of vidsrc embeds
    return res.json({ 
        success: false, 
        streamUrl: null, 
        message: "Stream link not found on preferred Hindi/South sources." 
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
