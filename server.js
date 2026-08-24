const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

const app = express();
app.use(express.json());

const httpsAgent = new https.Agent({  
    rejectUnauthorized: false
});

// Advanced Stealth Headers simulating real Chrome browser on Windows
const getStealthHeaders = (targetUrl) => {
    let host = "www.google.com";
    try {
        const parsed = new URL(targetUrl);
        host = parsed.host;
    } catch (e) {}

    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Referer': `https://www.google.com/url?q=https%3A%2F%2F${host}%2F`
    };
};

function cleanTitle(title) {
    if (!title) return "";
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/gi, '')
        .trim()
        .replace(/\s+/g, '+');
}

function extractVideoLinks(htmlContent) {
    if (!htmlContent) return [];
    const regex = /https?:\/\/[^\s"'<>]+?\.(mp4|m3u8|mkv)(\?[^\s"'<>]+)?/gi;
    const matches = htmlContent.match(regex) || [];
    return [...new Set(matches)];
}

async function searchAcrossProviders(query) {
    const providers = [
        `https://www.thenetnaija.net/search?t=${query}`,
        `https://fzmovies.net/search.aspx?q=${query}`,
        `https://1377x.to/search/${query}/1/`,
        `https://123moviesfree.net/search/${query}`,
        `https://downloads-anymovies.co/search?q=${query}`,
        `https://eztvtorrent.co/search/${query}`
    ];

    for (const searchUrl of providers) {
        try {
            console.log(`Analysing from [${searchUrl}]`);
            const response = await axios.get(searchUrl, {
                headers: getStealthHeaders(searchUrl),
                httpsAgent: httpsAgent,
                timeout: 4000,
                validateStatus: function (status) {
                    return status >= 200 && status < 500;
                }
            });

            if (response.status === 403 || response.status === 503) {
                console.log(`Blocked (Cloudflare/Anti-Bot) on ${searchUrl}`);
                continue;
            }

            const html = response.data;
            const foundLinks = extractVideoLinks(html);

            if (foundLinks.length > 0) {
                console.log(`Found direct link on ${searchUrl}: ${foundLinks[0]}`);
                return foundLinks[0];
            }

            const $ = cheerio.load(html);
            let postLink = $('a.article-title').attr('href') || 
                           $('h2 a').attr('href') || 
                           $('.search-result a').attr('href') || 
                           $('.detLink').attr('href') ||
                           $('a.moviename').attr('href');

            if (postLink) {
                if (!postLink.startsWith('http')) {
                    const parsedUrl = new URL(searchUrl);
                    postLink = `${parsedUrl.protocol}//${parsedUrl.host}${postLink}`;
                }

                console.log(`Deep scraping post: ${postLink}`);
                const postResp = await axios.get(postLink, {
                    headers: getStealthHeaders(postLink),
                    httpsAgent: httpsAgent,
                    timeout: 4000,
                    validateStatus: function (status) {
                        return status >= 200 && status < 400;
                    }
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
                "User-Agent": 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
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

app.get('/proxy', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) {
        return res.status(400).send("Video URL is required");
    }

    try {
        const parsedTargetUrl = new URL(videoUrl);
        const dynamicOrigin = `${parsedTargetUrl.protocol}//${parsedTargetUrl.host}`;

        const response = await axios({
            method: 'get',
            url: videoUrl,
            httpsAgent: httpsAgent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Referer': `${dynamicOrigin}/`,
                'Origin': dynamicOrigin,
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`MovieBox Ultimate Extractor Server running on port ${PORT}`);
});
