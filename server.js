const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 1. Title Cleaning Utility
function cleanTitle(title) {
    if (!title) return '';
    return title
        .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
        .replace(/\s+/g, '+')          // Replace spaces with +
        .trim();
}

// 2. Generic Headers to bypass basic protection & Cloudflare blocks
const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Referer": "https://www.google.com/"
};

// 3. Multi-Stage Scraper Engine (WordPress AJAX + Cheerio Pipeline)
async function searchAndExtract(site, query) {
    try {
        const cleanQuery = cleanTitle(query);
        if (!cleanQuery) return null;

        // Stage 1: WordPress AJAX Search Endpoint
        const searchUrl = `${site}/wp-admin/admin-ajax.php?action=data_fetch&query=${cleanQuery}`;
        console.log(`Hitting search URL: ${searchUrl}`);
        
        const { data: searchResults } = await axios.get(searchUrl, { headers, timeout: 6000 });
        const $ = cheerio.load(searchResults);
        
        // Extract the first movie/post article link
        let postUrl = $('a').first().attr('href');
        if (!postUrl) {
            // Fallback: try standard search URL format if AJAX fails
            const fallbackUrl = `${site}/?s=${cleanQuery}`;
            const { data: fallbackData } = await axios.get(fallbackUrl, { headers, timeout: 6000 });
            const $$ = cheerio.load(fallbackData);
            postUrl = $$('h2.title a, .item a, .result-item a, article a').first().attr('href');
        }

        if (!postUrl) return null;
        console.log(`Found post URL: ${postUrl}`);

        // Stage 2: Visit the Post Page to find download/stream hubs
        const { data: postData } = await axios.get(postUrl, { headers, timeout: 6000 });
        const $$ = cheerio.load(postData);

        // Stage 3: Extract direct streamable link or Hubcloud/Pixeldrain links
        let streamUrl = null;
        $$('a').each((i, el) => {
            const href = $$(el).attr('href');
            if (href && (href.includes('.m3u8') || href.includes('.mp4') || href.includes('pixeldrain') || href.includes('hubcloud'))) {
                streamUrl = href;
                return false; // break loop once found
            }
        });

        return streamUrl;

    } catch (err) {
        console.error(`Error scraping ${site}:`, err.message);
        return null;
    }
}

// 4. API Endpoint matching Android Retrofit interface (@GET("api/extract"))
app.get('/api/extract', async (req, res) => {
    const { tmdbId, type, query } = req.query;
    
    console.log(`Received request -> ID: ${tmdbId}, Type: ${type}, Query: ${query}`);

    if (!query && !tmdbId) {
        return res.status(400).json({ 
            success: false, 
            streamUrl: null, 
            headers: null, 
            message: "Query or tmdbId parameter is required" 
        });
    }

    // List of preferred reliable movie streaming/scraping source sites
    const preferredSites = [
        "https://vegamovies.pages.dev",
        "https://katmoviehd.eu",
        "https://hdhub4u.tv"
    ];

    const searchQuery = query || tmdbId;

    for (let site of preferredSites) {
        console.log(`Trying site: ${site} for query: ${searchQuery}`);
        const foundLink = await searchAndExtract(site, searchQuery);
        
        if (foundLink) {
            console.log(`Success! Stream link found: ${foundLink}`);
            return res.json({
                success: true,
                streamUrl: foundLink,
                headers: { "Referer": site },
                message: null
            });
        }
    }

    // If all sites fail
    return res.json({ 
        success: false, 
        streamUrl: null, 
        headers: null, 
        message: "Stream link not found on preferred sites." 
    });
});

app.listen(PORT, () => {
    console.log(`Movie Extractor Server running on port ${PORT}`);
});
