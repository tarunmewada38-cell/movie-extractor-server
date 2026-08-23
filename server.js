const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');

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

// 1. NetNaija Scraper Provider
async function searchNetNaija(query) {
    try {
        const searchUrl = `https://www.thenetnaija.net/search?t=${query}`;
        const response = await axios.get(searchUrl, {
            headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://www.thenetnaija.net/' },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        let postLink = $('h3.loop-item-title a').attr('href') || 
                       $('.file-info a').attr('href') || 
                       $('div.post-details a').attr('href');

        if (!postLink) return null;

        const postResp = await axios.get(postLink, {
            headers: { 'User-Agent': USER_AGENT, 'Referer': searchUrl },
            timeout: 10000
        });

        const postDoc = cheerio.load(postResp.data);
        let downloadBtn = postDoc('a.download-btn').attr('href') || 
                          postDoc('a.btn-primary').attr('href') || 
                          postDoc('a.download-link').attr('href');

        return downloadBtn || null;
    } catch (error) {
        console.error("NetNaija Error:", error.message);
        return null;
    }
}

// 2. FzMovies Scraper Provider
async function searchFzMovies(query) {
    try {
        const searchUrl = `https://fzmovies.net/search.aspx?q=${query}`;
        const response = await axios.get(searchUrl, {
            headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://fzmovies.net/' },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        let movieLink = $('a.moviename').attr('href') || 
                        $('.search-result a').attr('href') || 
                        $('table.datas a').attr('href');

        if (!movieLink) return null;

        const resolvedUrl = movieLink.startsWith('http') ? movieLink : `https://fzmovies.net/${movieLink}`;
        const detResp = await axios.get(resolvedUrl, {
            headers: { 'User-Agent': USER_AGENT, 'Referer': searchUrl },
            timeout: 10000
        });

        const detDoc = cheerio.load(detResp.data);
        let downloadLink = detDoc('a.downloadlink').attr('href') || 
                           detDoc('a.download').attr('href') || 
                           detDoc('a.download-btn').attr('href');

        return downloadLink || null;
    } catch (error) {
        console.error("FzMovies Error:", error.message);
        return null;
    }
}

// Main Extraction Endpoint
app.get('/extract', async (req, res) => {
    const rawQuery = req.query.q;
    if (!rawQuery) {
        return res.status(400).json({ success: false, error: "Query parameter 'q' is required" });
    }

    const query = cleanTitle(rawQuery);
    console.log(`Searching stream for: ${rawQuery} (Cleaned: ${query})`);

    let streamUrl = await searchNetNaija(query);

    if (!streamUrl) {
        console.log("NetNaija failed. Falling back to FzMovies...");
        streamUrl = await searchFzMovies(query);
    }

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
            message: "No stream found on indexers."
        });
    }
});

// Video Proxy Endpoint with Safe Header Forwarding
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
                'Referer': 'https://www.thenetnaija.net/',
                'Range': req.headers.range || 'bytes=0-'
            },
            responseType: 'stream',
            timeout: 30000
        });

        // Safe header copying to prevent crash on restricted properties
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

// Optimized /hls endpoint: Direct Proxy Stream routing
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
    console.log(`Movie Extractor Server running on port ${PORT}`);
});
