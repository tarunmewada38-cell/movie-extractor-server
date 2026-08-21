const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio'); // HTML parsing ke liye zaroori library
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Universal Regex Engine to filter .m3u8 and .mp4 links from HTML/responses
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

// Example Scraper Route for Indian & Dubbed Content Indexers (Vegamovies / KatmovieHD / Bolly4u style)
app.get('/api/extract', async (req, res) => {
    const { tmdbId, type, query } = req.query; // tmdbId ya movie ka naam pass kar sakte hain
    
    try {
        console.log(`Searching streams for TMDB ID: ${tmdbId}, Type: ${type}`);

        // 1. Aap yahan TMDb API se movie ka title fetch kar sakte hain (agar tmdbId diya hai)
        // Ya direct query search implement kar sakte hain in sites par.
        
        // Example target site search URL (Vegamovies / Bolly4u type indexers)
        // Note: In sites ke domain frequently change hote hain, isliye active domain use karein.
        const searchDomain = "https://vegamovies.pages.dev"; // ya koi active domain
        
        // Dummy implementation of search & scrape flow:
        // const searchResponse = await axios.get(`${searchDomain}/search?q=${encodeURIComponent(movieTitle)}`, {
        //     headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        // });

        // 2. HTML content ko cheerio mein load karke direct links nikalna:
        // const $ = cheerio.load(searchResponse.data);
        // const postLink = $('your-target-selector').attr('href');

        // 3. Post page par jaakar universal regex se .m3u8 ya .mp4 filter karna:
        // const postResponse = await axios.get(postLink);
        // const mediaLinks = extractMediaLinks(postResponse.data);

        // Filhal ke liye agar regex engine ko test karna hai ya direct link bhejwana hai:
        // Aap apne custom indexer domains ka array yahan loop karke scrape karwa sakte hain.

        // Test ke taur par agar koi valid link mil jata hai:
        const finalStreamUrl = ""; // Yahan scraped m3u8/mp4 link aayega

        if (finalStreamUrl) {
            res.json({
                success: true,
                streamUrl: finalStreamUrl,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                    "Referer": searchDomain
                }
            });
        } else {
            res.json({
                success: false,
                message: "No direct stream link found from regional indexers. Try another source."
            });
        }

    } catch (err) {
        console.error("Scraping Error:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Indexer & Scraper Server is running on port ${PORT}`);
});
