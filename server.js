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

// 1. NetNaija Scraper Provider (Updated with multi-selector fallback)
async function searchNetNaija(query) {
    try {
        const searchUrl = `https://www.thenetnaija.net/search?t=${query}`;
        const response = await axios.get(searchUrl, {
            headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://www.thenetnaija.net/' },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        // Multiple fallback selectors for post link
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

// 2. FzMovies Scraper Provider (Updated with multi-selector fallback)
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

// Main Extraction Endpoint with Automatic Fallback
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Movie Extractor Server running on port ${PORT}`);
});
