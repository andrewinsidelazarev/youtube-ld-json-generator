import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.YOUTUBE_API_KEY;

// ✅ Разрешаем CORS (важно поставить ДО маршрутов)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // можно указать свой домен
  res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// ✅ Основной маршрут API
app.get("/api/youtube-schema", async (req, res) => {
  const videoId = req.query.id;
  if (!videoId) {
    return res.status(400).json({ error: "Не указан параметр id видео" });
  }

  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails,statistics&key=${API_KEY}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return res.status(404).json({ error: "Видео не найдено" });
    }

    const video = data.items[0];
    const snippet = video.snippet;
    const contentDetails = video.contentDetails;
    const statistics = video.statistics;

    // ✅ Формируем правильный JSON-LD
    const schema = {
      "@context": "http://schema.org",
      "@type": "VideoObject",
      "name": snippet.title,
      "description": snippet.description
        .replace(/\n+/g, ' ')        // убираем переводы строк
        .replace(/\s{2,}/g, ' '),    // убираем двойные пробелы
      "thumbnailUrl": snippet.thumbnails.default?.url || snippet.thumbnails.high?.url,
      "uploadDate": snippet.publishedAt,
      "duration": contentDetails.duration,
      "embedUrl": `https://www.youtube.com/embed/${videoId}`,
      "interactionCount": statistics?.viewCount || "0"
    };

    // ✅ Возвращаем чистый JSON без экранирования
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.send(JSON.stringify(schema, null, 2));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при обращении к API YouTube" });
  }
});

// ✅ Страница по умолчанию
app.get("/", (req, res) => {
  res.send("✅ YouTube LD-JSON API работает! Используйте /api/youtube-schema?id=VIDEO_ID");
});

// ✅ Запуск сервера
app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
