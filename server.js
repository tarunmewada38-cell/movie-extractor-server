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
// फिक्स्ड यूआरएल सिंटैक्स डॉलर साइन और प्रॉपर इनकोडिंग के साथ
const ytsUrl = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}`;
const response = await axios.get(ytsUrl, { headers: { 'User-Agent': userAgent }, timeout: 8000 });
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
source: "YTS Engine",
label: `YTS Direct ${torrent.quality}`
});
}
}
}
}
} catch (e) {
console.log("YTS API Error: " + e.message);
}
if (streams.length === 0) {
return res.status(404).json({ success: false, message: "No streamable torrents found on any source." });
}
return res.json({ success: true, query, total_streams: streams.length, streams });
});
app.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});
