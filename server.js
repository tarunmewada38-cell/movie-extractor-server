const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.header("Access-Control-Allow-Headers", "*");
    next();
});

// 🚀 असली मूवी एक्स्ट्रेक्टर इंजन: यह लाइव मूवी का नाम सर्च करके उसका असली .mp4 डाउनलोड लिंक लाता है
app.get('/', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ success: false, error: 'Query parameter "q" is required.' });
    }

    try {
        console.log(`AI Engine: Searching original links for -> ${query}`);

        // स्टेप 1: नेटनैजा के सर्च इंजन को लाइव हिट मारना
        const searchUrl = `https://www.thenetnaija.com/search?q=${encodeURIComponent(query)}`;
        const searchResponse = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(searchResponse.data);

        // पहली मूवी का पेज लिंक निकालना
        const moviePageLink = $('.video-files .info h2 a').first().attr('href');
        if (!moviePageLink) {
            throw new Error("Movie not found in live database");
        }

        // स्टेप 2: मूवी के असली डाउनलोड पेज पर जाना
        const downloadPageResponse = await axios.get(moviePageLink, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $download = cheerio.load(downloadPageResponse.data);

        // असली डायरेक्ट .mp4 वीडियो का यूआरएल ढूंढना
        let realMovieUrl = $download('a.btn.download-btn').first().attr('href');
        if (!realMovieUrl) {
            // बैकअप गेटवे: अगर पहला बटन न मिले तो दूसरा ट्राई करना
            realMovieUrl = $download('.download-links a').first().attr('href');
        }

        if (!realMovieUrl) {
            throw new Error("Direct download link is missing");
        }

        // अगर लिंक मिल गया, तो उसे शुद्ध https में बदलना
        if (realMovieUrl.startsWith('//')) {
            realMovieUrl = 'https:' + realMovieUrl;
        }

        let streams = [{
            url: realMovieUrl,
            magnet_url: "",
            quality: "Original HD Premium",
            size: "Source File",
            source: "Live Scraper Engine",
            label: `${query} Original Full Movie`
        }];

        return res.json({ success: true, query, total_streams: streams.length, streams });

    } catch (error) {
        console.error("Scraper Error: " + error.message);
        // 🛡️ सेफ्टी फॉलबैक: अगर स्क्रैपिंग फेल हो जाए, तो ऐप क्रैश होने से बचाने के लिए JSON एरर भेजना
        return res.status(500).json({ success: false, error: "Could not extract original movie link at this moment." });
    }
});

app.listen(PORT, () => {
    console.log(`MovieBox Live Original Extractor running on port ${PORT}`);
});
