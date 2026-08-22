const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Helper to extract media links (.m3u8 or .mp4) from HTML content
function extractMediaLinks(htmlContent) {
    const m3u8Regex = /https?:\/\/[^\s"'<>]+?\.m3u8[^\s"'<>*/]*/g;
    const mp4Regex = /https?:\/\/[^\s"'<>]+?\.mp4[^\s"'<>*/]*/g;
    
    const m3u8Matches = htmlContent.match(m3u8Regex) || [];
    const mp4Matches = htmlContent.match(mp4Regex) || [];
    
    return {
        m3u8: [...new Set(m3u8Matches)],
        mp4: [...new Set(mp4Matches)]
    };
}

// Fallback TMDb Title Fetcher in case query is missing
async function getTmdbTitle(tmdbId, type) {
    const apiKey = "c3397946927d6d52674e2a8684eb4300";
    try {
        const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${apiKey}`;
        const response = await axios.get(url, { timeout: 3000 });
        if (response.data && (response.data.title || response.data.name)) {
            return response.data.title || response.data.name;
        }
    } catch (err) {
        // Fallback silently if TMDb fails
    }
    return null;
}

app.get('/api/extract', async (req, res) => {
    const { tmdbId, type, query } = req.query;
    
    try {
        let mediaTitle = query;

        // Agar app ne query nahi bheji, toh TMDb se try karenge
        if (!mediaTitle && tmdbId) {
            mediaTitle = await getTmdbTitle(tmdbId, type || 'movie');
        }

        // Agar fir bhi title na mile, toh fallback ke tor par tmdbId use karenge
        if (!mediaTitle) {
            mediaTitle = tmdbId; 
        }

        console.log(`Searching on preferred sites for query: ${mediaTitle}`);

        const preferredSites = [
            "https://netnaija.com",
            "https://vegamovies.pages.dev",
            "https://katmoviehd.eu",
            "https://bolly4u.org",
            "https://hdhub4u.tv"
        ];

        for (let site of preferredSites) {
            try {
                const searchUrl = `${site}/?s=${encodeURIComponent(mediaTitle)}`;
                const { data } = await axios.get(searchUrl, { 
                    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
                    timeout: 4000 
                });
                
                const $ = cheerio.load(data);
                const firstResult = $('a').filter((i, el) => {
                    const href = $(el).attr('href') || '';
                    return href.includes('movie') || href.includes('post') || href.length > 15;
                }).first().attr('href');

                if (firstResult) {
                    const targetPostUrl = firstResult.startsWith('http') ? firstResult : `${site}${firstResult}`;
                    const { data: postData } = await axios.get(targetPostUrl, { 
                        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
                        timeout: 4000 
                    });

                    const mediaLinks = extractMediaLinks(postData);
                    if (mediaLinks.m3u8.length > 0) {
                        return res.json({ success: true, streamUrl: mediaLinks.m3u8[0], headers: {} });
                    }
                    if (mediaLinks.mp4.length > 0) {
                        return res.json({ success: true, streamUrl: mediaLinks.mp4[0], headers: {} });
                    }
                }
            } catch (err) {
                continue; // Next site try karega agar ek fail ho jaye
            }
        }

        return res.json({
            success: false,
            message: "Stream link not found on preferred sites."
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
