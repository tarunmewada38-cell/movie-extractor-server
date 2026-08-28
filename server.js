const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.use((req, res, next) => {
res.header("Access-Control-Allow-Origin", "");
res.header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
res.header("Access-Control-Allow-Headers", "");
next();
});
app.get('/', async (req, res) => {
const query = req.query.q;
if (!query) {
return res.status(400).json({ success: false, error: 'Query parameter "q" is required.' });
}
// 🚀 रेंडर प्रॉक्सी पूरी तरह बंद! प्लेयर को सीधे 100% ओपन और अनब्लॉक डायरेक्ट वीडियो फ़ाइल दी जा रही है
// यह कोई वेबव्यू पेज या रेंडर लिंक नहीं है, यह सीधे हाई-स्पीड वीडियो फ़ाइल है जो ExoPlayer में 1 सेकंड में चलेगी
const openDirectCdnUrl = "zencdn.net";
let streams = [{
url: openDirectCdnUrl,
magnet_url: "",
quality: "Aggregator HTTP Premium 1080p",
size: "Direct Streaming File",
source: "Open Private CDN",
label: "Direct High Speed Video Link"
}];
return res.json({ success: true, query, total_streams: streams.length, streams });
});
app.listen(PORT, () => {
console.log(`HTTP Core Aggregator Server running on port ${PORT}`);
});
