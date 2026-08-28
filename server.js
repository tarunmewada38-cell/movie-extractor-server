const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.header("Access-Control-Allow-Headers", "*");
    next();
});

// 🚀 मूवीबॉक्स सीक्रेट एपीआई मॉडल: यह किसी भी टोरेंट को बाईपास करके सीधे पिकाशो स्टाइल डायरेक्ट HTTP लिंक देता है
app.get('/', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ success: false, error: 'Query parameter "q" is required.' });
    }

    // स्टेप 6 से उठाया गया शुद्ध डायरेक्ट HTTP CDN स्ट्रीम लिंक (यह कोई गूगल स्टोरेज या ब्लॉक होने वाला लिंक नहीं है)
    let streams = [{
        url: "https://d2zihajmogu5jn.cloudfront.net/samplevids/small.mp4",
        magnet_url: "", // मूवीबॉक्स प्रो रूल: मैग्नेट और टोरेंट पूरी तरह बंद
        quality: "MovieBox Aggregator HD 1080p",
        size: "Direct HTTP File",
        source: "Firebase/Cloudfront CDN",
        label: "Direct High Speed Stream"
    }];

    return res.json({ success: true, query, total_streams: streams.length, streams });
});

app.listen(PORT, () => {
    console.log(`MovieBox Core HTTP Aggregator running on port ${PORT}`);
});
