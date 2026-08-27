const express = require('express');
const axios = require('axios');
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
let streams = [];
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
try {
// Direct Database API - यह बिना किसी प्रॉक्सी के सीधे डेटाबेस से मैग्नेट लिंक खींचता है
const solidApiUrl = `https://solidtorrents.to/api/v1/search?q=${encodeURIComponent(query)}&category=all`;
const response = await axios.get(solidApiUrl, {
headers: { 'User-Agent': userAgent },
timeout: 15000
});
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
console.log("Database API Error: " + e.message);
}
if (streams.length === 0) {
return res.status(404).json({ success: false, message: "No streamable torrents found on any source." });
}
return res.json({ success: true, query, total_streams: streams.length, streams });
});
app.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});
