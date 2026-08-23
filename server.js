const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(express.json());

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// Helper function to clean movie/TV titles for searching
function cleanTitle(title) {
    if (!title) return "";
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/gi, '')
        .trim()
        .replace(/\s+/g, '+');
}

// Universal Regex Engine to extract direct video links (.mp4, .m3u8, .mkv) from HTML text
function extractVideoLinks(htmlContent) {
    if (!htmlContent) return [];
    // Regex to match direct video streams or download files
    const regex = /https?:\/\/[^\s"'<>]+?\.(mp4|m3u8|mkv)(\?[^\s"'<>]+)?/gi;
    const matches = htmlContent.match(regex) || [];
    // Remove duplicates
    return [...new Set(matches)];
}

// Universal Provider Search Function
async function searchAcrossProviders(query) {
    // List of domains categorized for fallback
    const providers = [
        // Hindi & South Focused
        `https://vegamovies.pages.dev/?s=${query}`,
        `https://katmoviehd.eu/?s=${query}`,
        `https://bolly4u.org/?s=${query}`,
        `https://7starhd.run/?s=${query}`,
        `https://hdhub4u.tv/?s=${query}`,
        `https://moviesmod.org/?s=${query}`,
        `https://worldfree4u.store/?s=${query}`,
        `https://skymovieshd.life/?s=${query}`,
        // Direct Web Scrapes / Mobile
        `https://fzmovies.net/search.aspx?q=${query}`,
        `https://www.thenetnaija.net/search?t=${query}`,
        // Regional
        `https://tamilyogi.vip/?s=${query}`,
        `https://5movierulz.im/s/?q=${query}`
    ];

    for (const searchUrl of providers) {
        try {
            console.log(`Trying provider: ${searchUrl}`);
            const response = await axios.get(searchUrl, {
                headers: { 'User-Agent': USER_AGENT, 'Referer': searchUrl },
                timeout: 7000
            });

            const html = response.data;
            const foundLinks = extractVideoLinks(html);

            if (foundLinks.length > 0) {
                console.log(`Found direct link on ${searchUrl}: ${foundLinks[0]}`);
                return foundLinks[0]; // Return the first valid video link found
            }

            // If direct link not on search page, look for post/article links to deep scrape
            const $ = cheerio.load(html);
            let postLink = $('a.loop-item-title').attr('href') || 
                           $('h2 a').attr('href') || 
                           $('.search-result a').attr('href') || 
                           $('a.moviename').attr('href');

            if (postLink) {
                if (!postLink.startsWith('http')) {
                    const parsedUrl = new URL(searchUrl);
                    postLink = `${parsedUrl.protocol}//${parsedUrl.host}${postLink}`;
                }

                console.log(`Deep scraping post: ${postLink}`);
                const postResp = await axios.get(postLink, {
                    headers: { 'User-Agent': USER_AGENT, 'Referer': searchUrl },
                    timeout: 7000
                });

                const postLinks = extractVideoLinks(postResp.data);
                if (postLinks.length > 0) {
                    console.log(`Found deep video link: ${postLinks[0]}`);
                    return postLinks[0];
                }
            }
        } catch (err) {
            console.log(`Failed on ${searchUrl}: ${err.message}`);
            continue; // Try next provider
        }
    }

    return null; // If all providers fail
}

// Main Extraction Endpoint
app.get('/extract', async (req, res) => {
    const rawQuery = req.query.q;
    if (!rawQuery) {
        return res.status(400).json({ success: false, error: "Query parameter 'q' is required" });
    }

    const query = cleanTitle(rawQuery);
    console.log(`Universal Engine Searching for: ${rawQuery} (Cleaned: ${query})`);

    const streamUrl = await searchAcrossProviders(query);

    if (streamUrl) {
        return res.json({
            success: true,
            streamUrl: streamUrl,
            headers: {
                "User-Agent": USER_AGENT,
                "Referer": "https://www.google.com/"
            }
        });
    } else {
        return res.json({
            success: false,
            streamUrl: "",
            message: "No stream found across all indexers."
        });
    }
});

// Video Proxy Endpoint with Safe Header Forwarding (Bypasses 403 / CORS)
app.get('/proxy', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) {
        return res.status(400).send("Video URL is required");
    }

    try {
        const response = await axios({
            method: 'get',
            url: videoUrl,
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': 'https://www.google.com/',
                'Range': req.headers.range || 'bytes=0-'
            },
            responseType: 'stream',
            timeout: 30000
        });

        const safeHeaders = {};
        const passHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified'];
        
        Object.keys(response.headers).forEach(key => {
            if (passHeaders.includes(key.toLowerCase())) {
                safeHeaders[key] = response.headers[key];
            }
        });

        res.writeHead(response.status, {
            ...safeHeaders,
            'Access-Control-Allow-Origin': '*'
        });
        
        response.data.pipe(res);
    } catch (error) {
        console.error("Proxy Error:", error.message);
        if (!res.headersSent) {
            res.status(500).send("Failed to proxy video stream.");
        }
    }
});

// Optimized HLS/Stream Router endpoint for Android App
app.get('/hls', (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) {
        return res.status(400).json({ success: false, error: "Video URL is required" });
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const proxyStreamUrl = `${protocol}://${host}/proxy?url=${encodeURIComponent(videoUrl)}`;

    return res.json({
        success: true,
        streamUrl: proxyStreamUrl
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`MovieBox Ultimate Extractor Server running on port ${PORT}`);
});
