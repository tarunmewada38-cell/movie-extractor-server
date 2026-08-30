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

// 🚀 न्यू .NG डोमेन एक्स्ट्रेक्टर इंजन: यह लाइव मूवी का नाम सर्च करके उसका असली .mp4 डाउनलोड लिंक लाता है
app.get('/', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ success: false, error: 'Query parameter "q" is required.' });
    }

    try {
        // स्मार्ट क्लीनर: "Spider-Man: Brand New Day" में से कोलन हटाकर सिर्फ "Spider-Man" करेगा
        const cleanTitle = query.split(':')[0].trim();
        console.log(`AI Engine NG: Searching original links for -> ${cleanTitle}`);

        // स्टेप 1: आपके नए .com.ng वाले वर्किंग सर्च इंजन को लाइव हिट मारना
        const searchUrl = `https://www.thenetnaija.com.ng/search?q=${encodeURIComponent(cleanTitle)}`;
        const searchResponse = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(searchResponse.data);

        // पहली ओरिजनल मूवी का पेज लिंक ढूंढना
        let moviePageLink = $('.info h2 a').first().attr('href');
        if (!moviePageLink) {
            moviePageLink = $('a[href*="/videos/"]').first().attr('href');
        }

        if (!moviePageLink) {
            throw new Error("Movie not found in new live .NG database");
        }

        // स्टेप 2: मूवी के असली डायरेक्ट डाउनलोड पेज पर जाना
        const downloadPageResponse = await axios.get(moviePageLink, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $download = cheerio.load(downloadPageResponse.data);

        // नए डोमेन का असली डायरेक्ट .mp4 वीडियो का यूआरएल ढूंढना
        let realMovieUrl = $download('a.btn.download-btn').first().attr('href');
        if (!realMovieUrl) {
            realMovieUrl = $download('a[href*="/download/"]').first().attr('href');
        }

        if (!realMovieUrl) {
            throw new Error("Direct download link is missing on this page");
        }

        // अगर लिंक मिल गया, तो उसे शुद्ध https में बदलना
        if (realMovieUrl.startsWith('//')) {
            realMovieUrl = 'https:' + realMovieUrl;
        }

        let streams = [{
            url: realMovieUrl,
            magnet_url: "",
            quality: "Original NG HD Premium",
            size: "Source File",
            source: "Live .NG Scraper Engine",
            label: `${cleanTitle} Original Full Movie`
        }];

        return res.json({ success: true, query: cleanTitle, total_streams: streams.length, streams });

    } catch (error) {
        console.error("Scraper NG Error: " + error.message);
        return res.status(500).json({ success: false, error: "Could not extract original movie link from .NG server at this moment." });
    }
});

app.listen(PORT, () => {
    console.log(`MovieBox Live Original .NG Extractor running on port ${PORT}`);
});
