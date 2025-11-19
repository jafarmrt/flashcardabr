import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';

// Setup path helpers for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for audio/image data

// --- API LOGIC (Ported from api/proxy.ts) ---

// Gemini API Handler
async function handleGeminiGenerate(payload, res, apiKey) {
  const { model, contents, config } = payload;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const {
    systemInstruction,
    responseModalities,
    speechConfig,
    ...generationConfig
  } = config || {};

  const finalContents = Array.isArray(contents)
    ? contents
    : (contents && typeof contents === 'object' && contents.parts)
      ? [contents]
      : [{ parts: [{ text: contents }] }];

  const googleApiBody = {
    contents: finalContents,
    ...(systemInstruction && { systemInstruction }),
    ...(responseModalities && { responseModalities }),
    ...(speechConfig && { speechConfig }),
    ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
  };

  try {
    const geminiResponse = await fetch(`${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(googleApiBody),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Google API Error:', errorText);
      return res.status(geminiResponse.status).json({ error: 'Google API Error', details: errorText });
    }

    const responseData = await geminiResponse.json();
    const adaptedResponse = {
      text: responseData.candidates?.[0]?.content?.parts?.[0]?.text || '',
      candidates: responseData.candidates,
    };
    return res.status(200).json(adaptedResponse);
  } catch (error) {
    console.error("Gemini Fetch Error:", error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

// Dictionary API Handlers
async function handleFreeDictionary(payload, res) {
    const { word } = payload;
    if (!word) return res.status(400).json({ error: 'Word is required.' });
    try {
        const apiResponse = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
        const data = await apiResponse.json();
        return res.status(apiResponse.status).json(data);
    } catch (e) {
        return res.status(500).json({ error: 'Failed to fetch from Free Dictionary', details: e.message });
    }
}

async function handleMerriamWebster(payload, res, apiKey) {
    const { word } = payload;
    if (!word) return res.status(400).json({ error: 'Word is required.' });
    try {
        const apiResponse = await fetch(`https://www.dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(word)}?key=${apiKey}`);
        const data = await apiResponse.json();
        return res.status(apiResponse.status).json(data);
    } catch (e) {
        return res.status(500).json({ error: 'Failed to fetch from Merriam-Webster', details: e.message });
    }
}

async function handleFetchAudio(payload, res) {
    const { url } = payload;
    if (!url) return res.status(400).json({ error: 'URL is required.' });

    try {
        const audioResponse = await fetch(url);
        if (!audioResponse.ok) {
            const errorText = await audioResponse.text();
            return res.status(audioResponse.status).json({ error: 'Failed to fetch audio from source.', details: errorText });
        }
        const contentType = audioResponse.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
        
        const arrayBuffer = await audioResponse.arrayBuffer();
        return res.status(200).send(Buffer.from(arrayBuffer));

    } catch (error) {
        return res.status(500).json({ error: 'Internal server error while fetching audio.', details: error.message });
    }
}

// KV Store Logic (Mocked via REST for compatibility with existing code, or Local File Fallback)
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const getUserKey = (username) => `user:${username.toLowerCase()}`;

// Simple in-memory fallback if no KV is provided (Note: Data resets on restart!)
const memoryStore = new Map();
const DATA_FILE = 'local_db.json'; // For persistent local storage in container

// Helper to read local file if it exists (Persistence for Arvan Volumes)
if (fs.existsSync(DATA_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        Object.entries(data).forEach(([k, v]) => memoryStore.set(k, v));
        console.log('Loaded local database.');
    } catch(e) {
        console.error('Failed to load local db', e);
    }
}

function saveLocalDb() {
    try {
        const obj = Object.fromEntries(memoryStore);
        fs.writeFileSync(DATA_FILE, JSON.stringify(obj));
    } catch(e) {
        console.error('Failed to save local db', e);
    }
}

async function getUser(username) {
    const key = getUserKey(username);
    
    // If External KV configured, use it
    if (KV_URL && KV_TOKEN) {
        try {
            const kvResponse = await fetch(`${KV_URL}/get/${key}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${KV_TOKEN}` },
            });
            if (!kvResponse.ok) return null;
            const { result } = await kvResponse.json();
            return result ? JSON.parse(result) : null;
        } catch(e) {
            console.error("KV Get Error", e);
            return null;
        }
    }

    // Fallback to local storage
    return memoryStore.get(key) || null;
}

async function setUser(userData) {
    const key = getUserKey(userData.username);
    
    // If External KV configured
    if (KV_URL && KV_TOKEN) {
         const kvResponse = await fetch(`${KV_URL}/set/${key}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${KV_TOKEN}` },
            body: JSON.stringify(userData),
        });
        if (!kvResponse.ok) throw new Error("Failed to write to KV");
        return;
    }

    // Fallback to local
    memoryStore.set(key, userData);
    saveLocalDb();
}

// Auth & Sync Handlers
async function handleRegister(payload, res) {
    const { username, password } = payload;
    if (!username || !password) return res.status(400).json({ error: 'Required fields missing' });
    
    const existingUser = await getUser(username);
    if (existingUser) return res.status(409).json({ error: 'Username taken' });

    const newUser = {
        username,
        password, // In prod, hash this!
        data: { decks: [], cards: [], studyHistory: [], userProfile: null, userAchievements: [] }
    };
    await setUser(newUser);
    return res.status(201).json({ message: 'Registered' });
}

async function handleLogin(payload, res) {
    const { username, password } = payload;
    const user = await getUser(username);
    if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid credentials' });
    return res.status(200).json({ message: 'Logged in' });
}

async function handleSyncLoad(payload, res) {
    const { username } = payload;
    const user = await getUser(username);
    return res.status(200).json({ data: user ? user.data : null });
}

async function handleSyncMerge(payload, res) {
    const { username, data: clientData } = payload;
    const user = await getUser(username);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const cloudData = user.data || { decks: [], cards: [], studyHistory: [], userProfile: null, userAchievements: [] };
    
    // --- Merge Logic (Simplified for Server.js) ---
    // Using a simple strategy: Merge arrays, prefer client for conflicts based on update times if available
    
    // Helper to merge lists by ID
    const mergeLists = (cloudList, clientList) => {
        const map = new Map();
        (cloudList || []).forEach(i => map.set(i.id, i));
        (clientList || []).forEach(i => {
            const existing = map.get(i.id);
            if (existing) {
                // If existing has newer updatedAt, keep it? 
                // For simplicity in this port, we assume client has latest state for active session
                // But we respect deletions.
                const isDeleted = i.isDeleted || existing.isDeleted;
                const clientTime = new Date(i.updatedAt || 0).getTime();
                const cloudTime = new Date(existing.updatedAt || 0).getTime();
                const winner = clientTime >= cloudTime ? i : existing;
                map.set(i.id, { ...winner, isDeleted });
            } else {
                map.set(i.id, i);
            }
        });
        return Array.from(map.values());
    };

    user.data = {
        decks: mergeLists(cloudData.decks, clientData.decks),
        cards: mergeLists(cloudData.cards, clientData.cards),
        studyHistory: [...(cloudData.studyHistory || []), ...(clientData.studyHistory || [])]
            .filter((v,i,a) => a.findIndex(t => t.cardId === v.cardId && t.date === v.date && t.rating === v.rating) === i), // Unique logs
        userProfile: clientData.userProfile || cloudData.userProfile, // Simple override for profile
        userAchievements: mergeLists(cloudData.userAchievements, clientData.userAchievements),
    };

    await setUser(user);
    return res.status(200).json({ data: user.data });
}


// API Router
app.post('/api/proxy', async (req, res) => {
    const { action, ...payload } = req.body;
    
    try {
        switch (action) {
            case 'ping': return res.json({ message: 'pong' });
            case 'gemini-generate': 
                return await handleGeminiGenerate(payload, res, process.env.API_KEY);
            case 'dictionary-free': 
                return await handleFreeDictionary(payload, res);
            case 'dictionary-mw': 
                return await handleMerriamWebster(payload, res, process.env.MW_API_KEY);
            case 'fetch-audio': 
                return await handleFetchAudio(payload, res);
            case 'auth-register': 
                return await handleRegister(payload, res);
            case 'auth-login': 
                return await handleLogin(payload, res);
            case 'sync-load': 
                return await handleSyncLoad(payload, res);
            case 'sync-merge': 
                return await handleSyncMerge(payload, res);
            case 'ping-free-dict':
            case 'ping-mw':
                 return res.json({ message: 'pong' });
            default: 
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (e) {
        console.error("Route Error", e);
        return res.status(500).json({ error: e.message });
    }
});

// Serve Static Files (Frontend)
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for SPA routing (send index.html for any unknown GET request)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});