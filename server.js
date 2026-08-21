const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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

// Fixed & Robust TMDb Title Fetcher
async function getTmdbTitle(tmdbId, type) {
    const apiKey = "c3397946927d6d52674e2a8684eb4300";
    const mediaTypes = [type, 'movie', 'tv']; // Try requested type first, then fallback
    
    for (let mType of mediaTypes) {
        if (!mType) continue;
        try {
            const url = `https://api.themoviedb.org/3/${mType}/${tmdbId}?api_key=${apiKey}`;
            const response = await axios.get(url, { timeout: 4000 });
            if (response.data && (response.data.title || response.data.name)) {
                return response.data.title || response.data.name;
            }
        } catch (err) {
            continue;
        }
    }
    return "";
}

async function scrapeFromPreferredSites(movieTitle) {
    const preferredSites = [
        "https://netnaija.com",
        "https://vegamovies.pages.dev",
        "https://katmoviehd.eu",
        "https://bolly4u.org",
        "https://hdhub4u.tv"
    ];

    for (let site of preferredSites) {
        try {
            const searchUrl = `${site}/?s=${encodeURIComponent(movieTitle)}`;
            const { data } = await axios.get(searchUrl, { 
                headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
                timeout: 4000 
            });
            
            const $ = cheerio.load(data);
            const firstResult = $('a').filter((i, el) => {
                const href = $(el).attr('href') || '';
                return href.includes('movie') || href.includes('post') || href.length > 20;
            }).first().attr('href');

            if (firstResult) {
                const targetPostUrl = firstResult.startsWith('http') ? firstResult : `${site}${firstResult}`;
                const { data: postData } = await axios.get(targetPostUrl, { 
                    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
                    timeout: 4000 
                });

                const mediaLinks = extractMediaLinks(postData);
                if (mediaLinks.m3u8.length > 0) return mediaLinks.m3u8[0];
                if (mediaLinks.mp4.length > 0) return mediaLinks.mp4[0];
            }
        } catch (err) {
            continue;
        }
    }
    return null;
}

app.get('/api/extract', async (req, res) => {
    const { tmdbId, type, query } = req.query;
    
    try {
        if (!tmdbId && !query) {
            return res.status(400).json({ success: false, message: "TMDB ID or Query is required" });
        }

        // Agar query direct app se aa rahi hai toh wo use karo, nahi toh TMDb se fetch karo
        let mediaTitle = query;
        if (!mediaTitle && tmdbId) {
            mediaTitle = await getTmdbTitle(tmdbId, type);
        }

        console.log(`Final Search Title: ${mediaTitle}`);

        if (!mediaTitle) {
            return res.json({ success: false, message: "Could not resolve title from TMDb." });
        }

        const directStreamUrl = await scrapeFromPreferredSites(mediaTitle);

        if (directStreamUrl) {
            return res.json({
                success: true,
                streamUrl: directStreamUrl,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                    "Referer": "https://google.com"
                }
            });
        } else {
            return res.json({
                success: false,
                message: "No direct stream link found from regional indexers. Try another source."
            });
        }

    } catch (err) {
        console.error("Extraction Error:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
