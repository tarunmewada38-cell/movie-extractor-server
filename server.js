const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const TMDB_API_KEY = "308d4de20e2f646478a097030103fbdb"; // आपकी एपीआई की

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

    let decodedStr = decodeURIComponent(query);
    
    // चेक करें कि क्या यह TV Show है (SxxExx पैटर्न ढूंढना)
    const tvRegex = /S(\d+)E(\d+)/i;
    const isTv = tvRegex.test(decodedStr);
    
    let cleanTitle = decodedStr;
    let seasonNum = 1;
    let episodeNum = 1;

    if (isTv) {
        const match = decodedStr.match(tvRegex);
        if (match) {
            seasonNum = parseInt(match[1], 10);
            episodeNum = parseInt(match[2], 10);
            cleanTitle = decodedStr.replace(tvRegex, '').trim();
        }
    } else {
        cleanTitle = decodedStr.split(':')[0].split('[')[0].trim();
    }

    console.log(`Multi-Provider Engine: Searching TMDb for -> ${cleanTitle} | IsTV: ${isTv} | S${seasonNum}E${episodeNum}`);

    try {
        // स्टेप 1: सही एंडपॉइंट चुनें (मूवी या टीवी शो)
        const searchType = isTv ? 'tv' : 'movie';
        const tmdbSearchUrl = `https://api.themoviedb.org/3/search/${searchType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`;
        
        const searchRes = await axios.get(tmdbSearchUrl);
        const results = searchRes.data.results;

        if (!results || results.length === 0) {
            return res.status(404).json({ success: false, error: "Title not found in TMDb database." });
        }

        const item = results[0];
        const tmdbId = item.id;
        const itemTitle = item.title || item.name || cleanTitle;
        const releaseYear = (item.release_date || item.first_air_date) ? (item.release_date || item.first_air_date).split('-')[0] : "HD";

        console.log(`Found TMDb ID: ${tmdbId} for ${itemTitle} (${releaseYear})`);

        let streams = [];

        if (isTv) {
            // 📺 TV Show / Series के लिए सही Embed URLs
            streams = [
                {
                    url: `https://player.autoembed.cc/embed/tv/${tmdbId}/${seasonNum}/${episodeNum}`,
                    quality: "1080p Multi-Server HD",
                    source: "AutoEmbed Cluster",
                    label: `${itemTitle} S${seasonNum}E${episodeNum} - Server 1`
                },
                {
                    url: `https://multembed.mov/?video_id=${tmdbId}&tmdb=1&s=${seasonNum}&e=${episodeNum}`,
                    quality: "1080p Fast Stream",
                    source: "MultiEmbed Network",
                    label: `${itemTitle} S${seasonNum}E${episodeNum} - Server 2`
                },
                {
                    url: `https://www.2embed.cc/embedtv/${tmdbId}&s=${seasonNum}&e=${episodeNum}`,
                    quality: "HD High Speed",
                    source: "2Embed Hub",
                    label: `${itemTitle} S${seasonNum}E${episodeNum} - Server 3`
                },
                {
                    url: `https://moviesapi.club/tv/${tmdbId}-${seasonNum}-${episodeNum}`,
                    quality: "HD Original Stream",
                    source: "MoviesAPI Edge",
                    label: `${itemTitle} S${seasonNum}E${episodeNum} - Server 4`
                },
                {
                    url: `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}&season=${seasonNum}&episode=${episodeNum}`,
                    quality: "HD Backup Stream",
                    source: "VidSrc Official",
                    label: `${itemTitle} S${seasonNum}E${episodeNum} - Server 5`
                }
            ];
        } else {
            // 🎬 Movies के लिए सही Embed URLs
            streams = [
                {
                    url: `https://player.autoembed.cc/embed/movie/${tmdbId}`,
                    quality: "1080p Multi-Server HD",
                    source: "AutoEmbed Cluster",
                    label: `${itemTitle} (${releaseYear}) - Server 1`
                },
                {
                    url: `https://multembed.mov/?video_id=${tmdbId}&tmdb=1`,
                    quality: "1080p Fast Stream",
                    source: "MultiEmbed Network",
                    label: `${itemTitle} (${releaseYear}) - Server 2`
                },
                {
                    url: `https://www.2embed.cc/embed/${tmdbId}`,
                    quality: "HD High Speed",
                    source: "2Embed Hub",
                    label: `${itemTitle} (${releaseYear}) - Server 3`
                },
                {
                    url: `https://moviesapi.club/movie/${tmdbId}`,
                    quality: "HD Original Stream",
                    source: "MoviesAPI Edge",
                    label: `${itemTitle} (${releaseYear}) - Server 4`
                },
                {
                    url: `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}`,
                    quality: "HD Backup Stream",
                    source: "VidSrc Official",
                    label: `${itemTitle} (${releaseYear}) - Server 5`
                }
            ];
        }

        return res.json({
            success: true,
            query: cleanTitle,
            tmdb_id: tmdbId,
            is_tv: isTv,
            total_streams: streams.length,
            streams: streams
        });

    } catch (error) {
        console.error("TMDb Multi-Provider Error: " + error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`MovieBox Multi-Provider TMDb Core running on port ${PORT}`);
});
