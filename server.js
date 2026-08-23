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
    const regex = /https?:\/\/[^\s"'<>]+?\.(mp4|m3u8|mkv)(\?[^\s"'<>]+)?/gi;
    const matches = htmlContent.match(regex) || [];
    return [...new Set(matches)];
}

// Universal Redirect & CDN Link Resolver (Movie Box rotating links/CDNs ke liye)
async function resolveStreamingLink(inputUrl) {
    try {
        console.log(`[Resolver] Tracking link: ${inputUrl}`);
        
        let currentUrl = inputUrl;
        let maxRedirects = 10;
        let redirectCount = 0;

        while (redirectCount < maxRedirects) {
            const response = await axios.get(currentUrl, {
                maxRedirects: 0,
                validateStatus: function (status) {
                    return status >= 200 && status < 400;
                },
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Referer': 'https://www.google.com/'
                }
            });

            if (response.status >= 300 && response.status < 400 && response.headers.location) {
                let nextUrl = response.headers.location;
                
                if (nextUrl.startsWith('/')) {
                    const parsedUrl = new URL(currentUrl);
                    nextUrl = `${parsedUrl.protocol}//${parsedUrl.host}${nextUrl}`;
                } else if (!nextUrl.startsWith('http')) {
                    const parsedUrl = new URL(currentUrl);
                    nextUrl = `${parsedUrl.origin}/${nextUrl}`;
                }

                console.log(`[Redirect #${redirectCount + 1}] -> ${nextUrl}`);
                currentUrl = nextUrl;
                redirectCount++;
            } else {
                console.log(`[Resolver] Final Streaming/Web Link Found: ${currentUrl}`);
                if (currentUrl.includes('.m3u8') || currentUrl.includes('.mp4') || currentUrl.includes('sbcdn')) {
                    return { success: true, finalUrl: currentUrl };
                }
                return { success: true, finalUrl: currentUrl, type: 'html_page' };
            }
        }

        return { success: false, error: 'Max redirects reached without finding final stream.' };

    } catch (error) {
        console.error('[Resolver Error]:', error.message);
        return { success: false, error: error.message };
    }
}

// Universal Provider Search Function
async function searchAcrossProviders(query) {
    const providers = [
        `https://vegamovies.pages.dev/?s=${query}`,
        `https://katmoviehd.eu/?s=${query}`,
        `https://bolly4u.org/?s=${query}`,
        `https://7starhd.run/?s=${query}`,
        `https://hdhub4u.tv/?s=${query}`,
        `https://moviesmod.org/?s=${query}`,
        `https://worldfree4u.store/?s=${query}`,
        `https://skymovieshd.life/?s=${query}`,
        `https://fzmovies.net/search.aspx?q=${query}`,
        `https://www.thenetnaija.net/search?t=${query}`,
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
                return foundLinks[0];
            }

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
            continue;
        }
    }

    return null;
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

// Naya API Route: Rotating links / CDNs ko trace aur resolve karne ke liye
app.get('/api/resolve', async (req, res) => {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).json({ success: false, error: 'URL parameter is missing' });
    }

    const result = await resolveStreamingLink(targetUrl);
    return res.json(result);
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
