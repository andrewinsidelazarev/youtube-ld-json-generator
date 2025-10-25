import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.YOUTUBE_API_KEY;

// ✅ 1. Разрешаем CORS ДО всех маршрутов:
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // или конкретный домен
  res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// ✅ 2. Основной API-маршрут:
app.get("/api/youtube-schema", async (req, res) => {
    const videoId = req.query.id;
    if (!videoId) return res.status(400).json({ error: "videoId required" });

    try {
        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${API_KEY}`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            return res.status(404).json({ error: "Видео не найдено" });
        }

        const video = data.items[0];
        const snippet = video.snippet;
        const duration = video.contentDetails.duration;

        const schema = {
            "@context": "https://schema.org",
            "@type": "VideoObject",
            "name": snippet.title,
            "description": snippet.description,
            "thumbnailUrl": snippet.thumbnails.high?.url || snippet.thumbnails.default?.url,
            "uploadDate": snippet.publishedAt,
            "duration": duration,
            "contentUrl": `https://www.youtube.com/watch?v=${videoId}`,
            "embedUrl": `https://www.youtube.com/embed/${videoId}`,
            "publisher": {
                "@type": "Organization",
                "name": snippet.channelTitle,
                "url": `https://www.youtube.com/channel/${snippet.channelId}`
            }
        };

        res.json(schema);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Ошибка при обращении к API YouTube" });
    }
});

// ✅ 3. Необязательный маршрут для корня:
app.get("/", (req, res) => {
    res.send("✅ YouTube Schema API работает! Используйте /api/youtube-schema?id=VIDEO_ID");
});

// ✅ 4. Запуск сервера:
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
