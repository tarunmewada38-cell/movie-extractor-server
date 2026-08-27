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
// 1. पहला अनब्लॉकड बाईपास गेटवे (टाइमआउट बढ़ाकर 30 सेकंड किया)
try {
const proxyApiUrl = `https://workers.dev/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}`;
const response = await axios.get(proxyApiUrl, { headers: { 'User-Agent': userAgent }, timeout: 30000 });
if (response.data && response.data.status === 'ok' && response.data.data.movie_count > 0) {
const movies = response.data.data.movies;
for (const movie of movies) {
if (movie.torrents) {
for (const torrent of movie.torrents) {
const magnetLink = `magnet:?xt=urn:btih:${torrent.hash}&dn=${encodeURIComponent(movie.title)}&tr=udp://open.demonii.com:1337/announce`;
streams.push({
url: magnetLink,
magnet_url: magnetLink,
quality: `${torrent.quality} (${torrent.type.toUpperCase()})`,
size: torrent.size,
source: "Proxy Gateway Engine",
label: `YTS Direct ${torrent.quality}`
});
}
}
}
}
} catch (e) {
console.log("Proxy Gateway Engine Timeout/Failed, trying backup...");
}
// 2. बैकअप गेटवे (टाइमआउट बढ़ाकर 30 सेकंड किया)
if (streams.length === 0) {
try {
const secondaryUrl = `https://yts-proxy.com/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}`;
const response = await axios.get(secondaryUrl, { headers: { 'User-Agent': userAgent }, timeout: 30000 });
if (response.data && response.data.status === 'ok' && response.data.data.movie_count > 0) {
const movies = response.data.data.movies;
for (const movie of movies) {
if (movie.torrents) {
for (const torrent of movie.torrents) {
const magnetLink = `magnet:?xt=urn:btih:${torrent.hash}&dn=${encodeURIComponent(movie.title)}&tr=udp://open.demonii.com:1337/announce`;
streams.push({
url: magnetLink,
magnet_url: magnetLink,
quality: `${torrent.quality} (${torrent.type.toUpperCase()})`,
size: torrent.size,
source: "Secondary Proxy Engine",
label: `YTS Direct ${torrent.quality}`
});
}
}
}
}
} catch (e) {
console.log("Secondary Proxy Engine also timed out: " + e.message);
}
}
if (streams.length === 0) {
return res.status(404).json({ success: false, message: "No streamable torrents found on any source." });
}
return res.json({ success: true, query, total_streams: streams.length, streams });
});
app.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});
