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
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
// 🚨 1. PirateBay का सबसे तगड़ा अनब्लॉकड एपीआई गेटवे (यह रेंडर को कभी 403 एरर नहीं देगा)
try {
const tpbUrl = `https://apibay.org/q.php?q=${encodeURIComponent(query)}`;
const response = await axios.get(tpbUrl, {
headers: { 'User-Agent': userAgent },
timeout: 15000
});
if (response.data && Array.isArray(response.data) && response.data.length > 0) {
for (const item of response.data) {
// '0' चेक करता है कि कोई फेक या खाली रिजल्ट तो नहीं है
if (item.info_hash && item.id !== '0' && item.info_hash !== '0000000000000000000000000000000000000000') {
// हैश कोड से शुद्ध मैग्नेट लिंक तैयार करने का अचूक लॉजिक
const magnetLink = `magnet:?xt=urn:btih:${item.info_hash}&dn=${encodeURIComponent(item.name)}&tr=udp://open.demonii.com:1337/announce`;
streams.push({
url: magnetLink,
magnet_url: magnetLink,
quality: "HD / Multi-Audio",
size: item.size ? (item.size / (1024 * 1024 * 1024)).toFixed(2) + " GB" : "Auto Size",
source: "PirateBay Engine",
label: item.name || "High Speed Stream"
});
}
}
}
} catch (e) {
console.log("PirateBay API Error: " + e.message);
}
if (streams.length === 0) {
return res.status(404).json({ success: false, message: "No streamable torrents found on any source." });
}
return res.json({ success: true, query, total_streams: streams.length, streams });
});
app.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});
