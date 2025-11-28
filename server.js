import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.YOUTUBE_API_KEY;
const MAX_DAILY_REQUESTS = 500; // лимит в день

const counterFile = path.join('./daily_counter.json');
const logFile = path.join('./requests.log');

// Чтение счётчика
function readCounter() {
    try {
        const data = fs.readFileSync(counterFile, 'utf-8');
        return JSON.parse(data);
    } catch {
        return { date: new Date().toISOString().slice(0,10), count: 0 };
    }
}

// Сохранение счётчика
function saveCounter(counter) {
    fs.writeFileSync(counterFile, JSON.stringify(counter), 'utf-8');
}

// Логирование запроса
function logRequest(videoId, status) {
    const line = `${new Date().toISOString()} | ${videoId} | ${status}\n`;
    fs.appendFileSync(logFile, line);
}

// ✅ Разрешаем CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.get("/api/youtube-schema", async (req, res) => {
    const videoId = req.query.id;
    if (!videoId) return res.status(400).json({ error: "Не указан параметр id видео" });

    let counter = readCounter();
    const today = new Date().toISOString().slice(0,10);

    // Сброс счётчика каждый день
    if (counter.date !== today) {
        counter.date = today;
        counter.count = 0;
        saveCounter(counter);
    }

    if (counter.count >= MAX_DAILY_REQUESTS) {
        logRequest(videoId, "Лимит превышен");
        return res.json({ error: "На сегодня лимит превышен, повторите завтра" });
    }

    counter.count++;
    saveCounter(counter);

    try {
        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails,statistics&key=${API_KEY}`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            logRequest(videoId, "Видео не найдено");
            return res.status(404).json({ error: "Видео не найдено" });
        }

        const video = data.items[0];
        const snippet = video.snippet;
        const contentDetails = video.contentDetails;
        const statistics = video.statistics;

        const schema = {
            "@context": "http://schema.org",
            "@type": "VideoObject",
            "name": snippet.title,
            "description": snippet.description.replace(/\n+/g,' ').replace(/\s{2,}/g,' '),
            "original_description": snippet.description,
            "thumbnailUrl": snippet.thumbnails.default?.url || snippet.thumbnails.high?.url,
            "uploadDate": snippet.publishedAt,
            "duration": contentDetails.duration,
            "embedUrl": `https://www.youtube.com/embed/${videoId}`,
            "interactionCount": statistics?.viewCount || "0"
        };

        logRequest(videoId, "OK");
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.send(JSON.stringify(schema, null, 2));

    } catch (err) {
        console.error(err);
        logRequest(videoId, "Ошибка API");
        res.status(500).json({ error: "Ошибка при обращении к API YouTube" });
    }
});

app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
