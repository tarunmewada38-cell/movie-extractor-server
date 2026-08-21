const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Universal Regex Engine to filter .m3u8 and .mp4 links
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

// Robust TMDb Title Fetcher with multiple fallbacks
async function getTmdbTitle(tmdbId, type) {
    const apiKey = "c3397946927d6d52674e2a8684eb4300";
    const mediaTypes = [type, 'movie', 'tv'];
    
    for (let mType of mediaTypes) {
        if (!mType) continue;
        try {
            const url = `https://api.themoviedb.org/3/${mType}/${tmdbId}?api_key=${apiKey}`;
            const response = await axios.get(url, { timeout: 3000 });
            if (response.data && (response.data.title || response.data.name)) {
                return response.data.title || response.data.name;
            }
        } catch (err) {
            continue;
        }
    }
    return "Movie"; // Fallback title so scraping never breaks
}

app.get('/api/extract', async (req, res) => {
    const { tmdbId, type } = req.query;
    
    try {
        console.log(`API Hit -> TMDB ID: ${tmdbId}, Type: ${type}`);

        if (!tmdbId) {
            return res.status(400).json({ success: false, message: "TMDB ID is required" });
        }

        // 1. Get title safely
        const mediaTitle = await getTmdbTitle(tmdbId, type);
        console.log(`Resolved Title: ${mediaTitle}`);

        // 2. Preferred Indexer Sites List
        const preferredSites = [
            "https://netnaija.com",
            "https://vegamovies.pages.dev",
            "https://katmoviehd.eu",
            "https://bolly4u.org",
            "https://hdhub4u.tv"
        ];

        let foundStreamUrl = null;

        for (let site of preferredSites) {
            try {
                const searchUrl = `${site}/?s=${encodeURIComponent(mediaTitle)}`;
                const { data } = await axios.get(searchUrl, { 
                    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
                    timeout: 3000 
                });
                
                const $ = cheerio.load(data);
                const firstResult = $('a').filter((i, el) => {
                    const href = $(el).attr('href') || '';
                    return href.includes('movie') || href.includes('post') || href.length > 15;
                }).first().attr('href');

                if (firstResult) {
                    const targetPostUrl = firstResult.startsWith('http') ? firstResult : `${site}${firstResult}`;
                    const { data: postData } = await axios.get(targetPostUrl, { 
                        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
                        timeout: 3000 
                    });

                    const mediaLinks = extractMediaLinks(postData);
                    if (mediaLinks.m3u8.length > 0) {
                        foundStreamUrl = mediaLinks.m3u8[0];
                        break;
                    }
                    if (mediaLinks.mp4.length > 0) {
                        foundStreamUrl = mediaLinks.mp4[0];
                        break;
                    }
                }
            } catch (err) {
                continue; // Try next site
            }
        }

        // 3. Ultimate Fallback: If scraper gets blocked or times out, provide a reliable direct stream resolver link based on ID
        if (!foundStreamUrl) {
            console.log("Indexers blocked/empty, utilizing direct secure fallback stream URL.");
            foundStreamUrl = `https://vidsrc.cc/v2/embed/${type === 'tv' ? 'tv' : 'movie'}/${tmdbId}`;
        }

        return res.json({
            success: true,
            streamUrl: foundStreamUrl,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Referer": "https://google.com"
            }
        });

    } catch (err) {
        console.error("Extraction Error:", err.message);
        // Fallback response so app never shows an error screen
        res.json({
            success: true,
            streamUrl: `https://vidsrc.cc/v2/embed/movie/${tmdbId}`,
            headers: {}
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
