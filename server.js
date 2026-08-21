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

app.get('/api/extract', async (req, res) => {
    // Ab server direct query (title) lega, TMDb API ki zaroorat hi nahi!
    const { query } = req.query;
    
    try {
        if (!query) {
            return res.status(400).json({ success: false, message: "Query parameter is required" });
        }

        console.log(`Searching directly for query: ${query}`);

        const preferredSites = [
            "https://netnaija.com",
            "https://vegamovies.pages.dev",
            "https://katmoviehd.eu",
            "https://bolly4u.org",
            "https://hdhub4u.tv"
        ];

        for (let site of preferredSites) {
            try {
                const searchUrl = `${site}/?s=${encodeURIComponent(query)}`;
                const { data } = await axios.get(searchUrl, { 
                    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
                    timeout: 5000 
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
                        timeout: 5000 
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
                continue; 
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
