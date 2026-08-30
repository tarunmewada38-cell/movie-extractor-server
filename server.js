const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// TMDb की पब्लिक या अपनी एपीआई की (या ऐप साइड से पास करने के लिए)
const TMDB_API_KEY = "8265bd1679663a7ea12ac168da84d2e8"; // (पब्लिक ओपन की या अपनी डाल सकते हो)

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

    // साफ नाम निकालना
    let decodedStr = decodeURIComponent(query);
    const cleanTitle = decodedStr.split(':')[0].split('[')[0].trim();
    console.log(`Multi-Provider Engine: Searching TMDb for -> ${cleanTitle}`);

    try {
        // स्टेप 1: TMDb API से मूवी की ऑफिशियल ID ढूंढना ताकि कभी सर्च फेल न हो
        const tmdbSearchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`;
        const searchRes = await axios.get(tmdbSearchUrl);
        const movies = searchRes.data.results;

        if (!movies || movies.length === 0) {
            return res.status(404).json({ success: false, error: "Movie not found in TMDb database." });
        }

        const movie = movies[0];
        const tmdbId = movie.id;
        const movieTitle = movie.title || cleanTitle;
        const releaseYear = movie.release_date ? movie.release_date.split('-')[0] : "HD";

        console.log(`Found TMDb ID: ${tmdbId} for ${movieTitle} (${releaseYear})`);

        // स्टेप 2: मल्टी-प्रोवाइडर स्ट्रीम लिस्ट तैयार करना (जिन्होंने VidSrc सबसे आखिरी में रखा है)
        let streams = [
            {
                url: `https://player.autoembed.cc/embed/movie/${tmdbId}`,
                magnet_url: "",
                quality: "1080p Multi-Server HD",
                size: "Streaming Stream",
                source: "AutoEmbed Cluster",
                label: `${movieTitle} (${releaseYear}) - Server 1 (AutoEmbed)`
            },
            {
                url: `https://multembed.mov/?video_id=${tmdbId}&tmdb=1`,
                magnet_url: "",
                quality: "1080p Fast Stream",
                size: "Streaming Stream",
                source: "MultiEmbed Network",
                label: `${movieTitle} (${releaseYear}) - Server 2 (MultiEmbed)`
            },
            {
                url: `https://www.2embed.cc/embed/${tmdbId}`,
                magnet_url: "",
                quality: "HD High Speed",
                size: "Streaming Stream",
                source: "2Embed Hub",
                label: `${movieTitle} (${releaseYear}) - Server 3 (2Embed)`
            },
            {
                url: `https://moviesapi.club/movie/${tmdbId}`,
                magnet_url: "",
                quality: "HD Original Stream",
                size: "Streaming Stream",
                source: "MoviesAPI Edge",
                label: `${movieTitle} (${releaseYear}) - Server 4 (MoviesAPI)`
            },
            // 🔻 आपके निर्देशानुसार 'vidsrc' को बिल्कुल आखिरी (Last) पोजीशन पर रखा गया है
            {
                url: `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}`,
                magnet_url: "",
                quality: "HD Backup Stream",
                size: "Streaming Stream",
                source: "VidSrc Official",
                label: `${movieTitle} (${releaseYear}) - Server 5 (VidSrc Backup)`
            }
        ];

        return res.json({
            success: true,
            query: cleanTitle,
            tmdb_id: tmdbId,
            total_streams: streams.length,
            streams: streams
        });

    } catch (error) {
        console.error("TMDb Multi-Provider Error: " + error.message);
        
        // फॉलबैक के तौर पर डायरेक्ट नाम आधारित एम्बेड लिंक्स देना ताकि ऐप कभी क्रैश न हो
        let fallbackStreams = [
            {
                url: `https://multembed.mov/?query=${encodeURIComponent(cleanTitle)}`,
                magnet_url: "",
                quality: "HD Fallback",
                size: "Stream",
                source: "Direct Query Fallback",
                label: `${cleanTitle} (Direct Search Fallback)`
            },
            {
                url: `https://vidsrc.xyz/embed/movie?title=${encodeURIComponent(cleanTitle)}`,
                magnet_url: "",
                quality: "VidSrc Fallback",
                size: "Stream",
                source: "VidSrc Last Resort",
                label: `${cleanTitle} (VidSrc Fallback)`
            }
        ];

        return res.json({
            success: true,
            query: cleanTitle,
            total_streams: fallbackStreams.length,
            streams: fallbackStreams
        });
    }
});

app.listen(PORT, () => {
    console.log(`MovieBox Multi-Provider TMDb Core running on port ${PORT}`);
});
