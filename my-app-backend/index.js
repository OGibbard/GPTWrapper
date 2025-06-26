// index.js
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { OpenAI } = require('openai');
require('dotenv').config();

// --- Initialize Firebase Admin SDK ---
const serviceAccount = require('./service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
app.use(cors()); // Enable CORS for all routes
app.use(express.json());
const port = 5000;

// --- Initialize OpenAI ---
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Middleware to verify Firebase ID token ---
const verifyAuthToken = async (req, res, next) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];

    if (!idToken) {
        return res.status(401).send('Unauthorized: No token provided.');
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken; // Add user info to the request object
        next();
    } catch (error) {
        console.error('Error verifying Firebase ID token:', error);
        res.status(403).send('Unauthorized: Invalid token.');
    }
};

// --- API Routes ---
app.get('/api/public-data', (req, res) => {
    res.json({ message: 'This is public data, anyone can see it.' });
});

// This route is protected by our verifyAuthToken middleware
app.get('/api/secret-data', verifyAuthToken, (req, res) => {
    // Because of the middleware, we know the user is authenticated.
    // req.user contains the user's decoded token data, like UID.
    res.json({
        message: `Hello ${req.user.name || req.user.email}! This is a secret message just for you. Your UID is ${req.user.uid}.`
    });
});

// --- NEW CHAT API ENDPOINT ---
app.post('/api/chat', verifyAuthToken, async (req, res) => {
  const { message, history } = req.body;
  const userId = req.user.uid;

  if (!message) {
    return res.status(400).send('Message is required.');
  }

  try {
    const messagesForAPI = [
      { role: 'system', content: 'You are a helpful assistant.' },
      ...(Array.isArray(history) ? history : []),
      { role: 'user', content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messagesForAPI,
    });

    const aiResponse = completion.choices[0].message.content;

    // (Optional) Save conversation to Firestore
    // const userChatHistoryRef = admin.firestore().collection('users').doc(userId).collection('chats');
    // await userChatHistoryRef.add({ role: 'user', content: message, timestamp: new Date() });
    // await userChatHistoryRef.add({ role: 'assistant', content: aiResponse, timestamp: new Date() });

    res.json({ response: aiResponse });

  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    res.status(500).send('Failed to get response from AI.');
  }
});

app.listen(port, () => {
    console.log(`Node.js server listening at http://localhost:${port}`);
});