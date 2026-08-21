const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/extract', async (req, res) => {
    const { tmdbId, type } = req.query;
    try {
        // Yahan tera extraction logic aayega (filhal ke liye dummy stream link bhej rahe hain test karne ke liye)
        const streamUrl = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Referer": "https://vidsrc.xyz/"
        };

        res.json({
            success: true,
            streamUrl: streamUrl,
            headers: headers
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});