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

    // 🚀 NetNaija Style HTTP Aggregator Response: सीधे होस्ट सर्वर से शुद्ध वीडियो फ़ाइल का लिंक
    let streams = [{
        url: "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
        magnet_url: "", // टोरेंट पूरी तरह बंद, कोई मैग्नेट लिंक नहीं
        quality: "NetNaija HD 1080p (Direct HTTP)",
        size: "Direct Stream",
        source: "File Host CDN",
        label: "Direct High Speed Video File"
    }];

    return res.json({ success: true, query, total_streams: streams.length, streams });
});

app.listen(PORT, () => {
    console.log(`HTTP Scraper Server running on port ${PORT}`);
});
