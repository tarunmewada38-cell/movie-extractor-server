const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// CORS ओपन करने के लिए ताकि आपकी एंड्रॉइड ऐप इसे बिना एरर के हिट कर सके
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

    let streams = [];
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    // 1. SolidTorrents API Integration (यह रेंडर के सर्वर्स पर कभी ब्लॉक नहीं होता)
    try {
        const solidApiUrl = `https://solidtorrents.to{encodeURIComponent(query)}&category=all`;
        const response = await axios.get(solidApiUrl, { headers: { 'User-Agent': userAgent }, timeout: 5000 });
        
        if (response.data && response.data.results && response.data.results.length > 0) {
            for (const item of response.data.results) {
                if (item.magnet) {
                    streams.push({
                        url: item.magnet,
                        magnet_url: item.magnet,
                        quality: "HD / Multi-Audio",
                        size: (item.size / (1024 * 1024 * 1024)).toFixed(2) + " GB",
                        source: "SolidTorrents Engine",
                        label: item.title || "High Speed Stream"
                    });
                }
            }
        }
    } catch (e) {
        console.log("SolidTorrents Engine Failed, trying YTS...");
    }

    // 2. YTS Official API Fallback
    if (streams.length === 0) {
        try {
            const ytsUrl = `https://yts.mx{encodeURIComponent(query)}`;
            const response = await axios.get(ytsUrl, { headers: { 'User-Agent': userAgent }, timeout: 5000 });
            
            if (response.data && response.data.status === 'ok' && response.data.data.movie_count > 0) {
                const movies = response.data.data.movies;
                for (const movie of movies) {
                    if (movie.torrents) {
                        for (const torrent of movie.torrents) {
                            const magnetLink = `magnet:?xt=urn:btih:${torrent.hash}&dn=${encodeURIComponent(movie.title)}&tr=udp://://demonii.com`;
                            streams.push({
                                url: magnetLink,
                                magnet_url: magnetLink,
                                quality: `${torrent.quality} (${torrent.type.toUpperCase()})`,
                                size: torrent.size,
                                source: "YTS Official API",
                                label: `YTS Direct ${torrent.quality}`
							});
                        }
                    }
                }
            }
        } catch (e) {
            console.log("YTS Fallback Failed too...");
        }
    }

    // फाइनल रिस्पॉन्स डिलीवरी
    if (streams.length === 0) {
        return res.status(404).json({ success: false, message: "No streamable torrents found on any source." });
    }

    return res.json({ success: true, query, total_streams: streams.length, streams });
});

app.listen(PORT, () => {
    console.log(`Movie Scraper Server running on port ${PORT}`);
});
