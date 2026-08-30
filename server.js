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

app.get('/', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ success: false, error: 'Query parameter "q" is required.' });
    }

    let decodedStr = decodeURIComponent(query);
    let firstStep = decodedStr.split(':');
    let titleBeforeColon = firstStep[0];
    let secondStep = titleBeforeColon.split('[');
    const cleanTitle = secondStep[0].trim();

    console.log('AI Multi-Source Engine: Searching for -> ' + cleanTitle);

    // ----------------------------------------------------
    // प्रयास 1: FZMovies से डायरेक्ट लिंक निकालने की कोशिश
    // ----------------------------------------------------
    try {
        const searchUrl = 'https://www.fzmovies.net/csearch.php?searchname=' + encodeURIComponent(cleanTitle) + '&Search=Search';
        const searchResponse = await axios.get(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const $ = cheerio.load(searchResponse.data);

        let moviePageLink = $('.mainlink a').first().attr('href') || $('a[href*="movie.php"]').first().attr('href');
        if (moviePageLink) {
            if (!moviePageLink.startsWith('http')) {
                moviePageLink = 'https://www.fzmovies.net' + moviePageLink;
            }

            const moviePage = await axios.get(moviePageLink, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const $movie = cheerio.load(moviePage.data);
            let downloadLink = $movie('a[href*="download"]').first().attr('href') || $movie('#downloadlink').attr('href');

            if (downloadLink) {
                if (downloadLink.startsWith('//')) {
                    downloadLink = 'https:' + downloadLink;
                }
                console.log('Found on FZMovies!');
                return res.json({
                    success: true,
                    query: cleanTitle,
                    total_streams: 1,
                    streams: [{
                        url: downloadLink,
                        magnet_url: '',
                        quality: 'HD Original Premium',
                        size: 'Source Full File',
                        source: 'FZMovies Dedicated Server',
                        label: cleanTitle + ' Original Full Movie'
                    }]
                });
            }
        }
    } catch (fzError) {
        console.log('FZMovies attempt failed, switching to NetNaija: ' + fzError.message);
    }

    // ----------------------------------------------------
    // प्रयास 2: FZ में न मिलने पर NetNaija पर स्विच करना
    // ----------------------------------------------------
    try {
        const ngUrl = 'https://www.thenetnaija.com.ng/search?q=' + encodeURIComponent(cleanTitle);
        const ngResponse = await axios.get(ngUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ng = cheerio.load(ngResponse.data);

        let moviePageLink = $('.info h2 a').first().attr('href') || $ng("a[href*='/videos/']").first().attr('href');
        if (moviePageLink) {
            const downloadPageResponse = await axios.get(moviePageLink, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const $download = cheerio.load(downloadPageResponse.data);

            let realMovieUrl = $download('a.btn.download-btn').first().attr('href') || $download('a[href*="/download/"]').first().attr('href');
            if (realMovieUrl) {
                if (realMovieUrl.startsWith('//')) {
                    realMovieUrl = 'https:' + realMovieUrl;
                }
                console.log('Found on NetNaija!');
                return res.json({
                    success: true,
                    query: cleanTitle,
                    total_streams: 1,
                    streams: [{
                        url: realMovieUrl,
                        magnet_url: '',
                        quality: 'Original NG HD Premium',
                        size: 'Source File',
                        source: 'NetNaija Server',
                        label: cleanTitle + ' Original Full Movie'
                    }]
                });
            }
        }
    } catch (ngError) {
        console.log('NetNaija attempt also failed: ' + ngError.message);
    }

    // अगर दोनों सर्वर पर मूवी नहीं मिलती, तो साफ और सटीक एरर रिस्पॉन्स भेजें (कोई डमी वीडियो नहीं)
    return res.status(404).json({
        success: false,
        error: 'Movie not found in FZMovies or NetNaija active databases.'
    });
});

app.listen(PORT, () => {
    console.log('MovieBox FZ Aggregator running on port ' + PORT);
});
