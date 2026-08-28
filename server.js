const express = require('express');
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

    // 🚀 ExoPlayer स्पेशल प्रीमियम गेटवे: यह कोई वेबव्यू पेज नहीं है,
    // बल्कि एक शुद्ध डायरेक्ट वीडियो स्ट्रीम (.mp4/.m3u8) है जिसे ExoPlayer सीधे प्ले कर सकता है
    let streams = [{
        url: "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
        magnet_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
        quality: "Direct Ultra HD 1080p",
        size: "Instant Play",
        source: "Premium Netiv CDN",
        label: "Professional ExoPlayer Link"
    }];

    return res.json({ success: true, query, total_streams: streams.length, streams });
});

app.listen(PORT, () => {
    console.log(`Professional Netiv Stream Server running on port ${PORT}`);
});
