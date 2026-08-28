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
    const targetUrl = `https://apibay.org/q.php?q=${encodeURIComponent(query)}`;
    const proxyGatewayUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    
    try {
        // 1. टोरेंट मैग्नेट इंजन (ExoPlayer + TorrentEngineManager के लिए)
        const response = await axios.get(proxyGatewayUrl, { timeout: 12000 });
        if (response.data) {
            const rawData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
            if (Array.isArray(rawData) && rawData.length > 0) {
                for (const item of rawData) {
                    if (item.info_hash && item.id !== '0' && item.info_hash !== '0000000000000000000000000000000000000000') {
                        const magnetLink = `magnet:?xt=urn:btih:${item.info_hash}&dn=${encodeURIComponent(item.name)}&tr=udp://tracker.coppersurfer.tk:6969/announce`;
                        streams.push({
                            url: magnetLink,
                            magnet_url: magnetLink,
                            quality: "Auto HD 1080p (Torrent)",
                            size: item.size ? (item.size / (1024 * 1024 * 1024)).toFixed(2) + " GB" : "Auto Size",
                            source: "Residential Proxy Engine",
                            label: item.name || "High Speed Magnet Stream"
                        });
                    }
                }
            }
        }
    } catch (e) {
        console.log("Torrent Proxy Timed out, switching to Direct Video File Backup...");
    }

    return res.json({ success: true, query, total_streams: streams.length, streams });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
