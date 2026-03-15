require("dotenv").config();

/**
 * AI Interview Preparation Assistant - Backend Server
 * College Hackathon Project
 *
 * This server provides:
 * - Static file serving for the frontend
 * - POST /chat endpoint for AI-powered interview simulation
 * - Integration with Google Gemini AI for generating interview questions and feedback
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE CONFIGURATION
// ============================================
app.use(cors()); // Allow frontend to make requests from different origin
app.use(express.json()); // Parse JSON request bodies
app.use(express.static(path.join(__dirname))); // Serve static files (HTML, CSS, JS)

// ============================================
// AI INTEGRATION - GOOGLE GEMINI API
// ============================================
// How it works:
// 1. Get your FREE API key from: https://makersuite.google.com/app/apikey
// 2. Set it as environment variable: GEMINI_API_KEY=your_key_here
// 3. The GoogleGenerativeAI SDK connects to Gemini's language model
// 4. We send a "system prompt" that defines the AI's role as an interviewer
// 5. The model generates contextual responses based on conversation history

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Initialize Gemini only if API key is provided
let genAI = null;
let model = null;
if (GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    // Using gemini-1.5-flash for fast responses (good for hackathon demos)
    // Alternative: gemini-1.5-pro for more detailed responses
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
}

// System prompt that defines the AI interviewer's behavior
// This is sent with every request to keep the AI in character
const SYSTEM_PROMPT = `You are an expert AI Interviewer helping candidates prepare for software developer job interviews.

Your role:
- Ask ONE question at a time (either technical or HR-related for software dev roles)
- Technical questions: programming, data structures, algorithms, system design, frameworks
- HR questions: teamwork, problem-solving, career goals, strengths/weaknesses

When the user answers a question, ALWAYS respond in this EXACT format:

Score: X/10
Strength: [One clear strength of their answer]
Weakness: [One area that needs improvement]
Suggestion: [Specific tip to improve their answer]

[Then ask the next interview question]

Keep your responses concise. Score fairly based on clarity, completeness, and relevance.`;

// ============================================
// HELPER: Generate AI Response using Gemini
// ============================================
/**
 * Sends the conversation to Gemini API and returns the AI's response.
 * The conversation history is passed to maintain context (the AI "remembers" previous Q&A)
 */
async function getAIResponse(conversationHistory) {
    if (!model) {
        return {
            text: "⚠️ API key not configured. Please set GEMINI_API_KEY environment variable. Get a free key at https://makersuite.google.com/app/apikey",
            error: true
        };
    }

    try {
        // Build the full prompt: system instructions + conversation history
        const prompt = SYSTEM_PROMPT + "\n\n---\nConversation:\n" + conversationHistory;

        // Send to Gemini API - this is the actual AI call
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return { text, error: false };
    } catch (err) {
        console.error('Gemini API Error:', err.message);
        return {
            text: `Sorry, the AI service encountered an error: ${err.message}. Please check your API key and try again.`,
            error: true
        };
    }
}

// ============================================
// API ENDPOINT: POST /chat
// ============================================
/**
 * Receives user message, sends to AI, returns AI response.
 *
 * Request body: { message: string, history: [{role, content}] }
 * Response: { success, message, error? }
 */
app.post('/chat', async (req, res) => {
    try {
        const { message, history = [] } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Please provide a message.',
                error: 'Missing or invalid message'
            });
        }

        // Build conversation history as a string for the AI
        // Format: "Interviewer: [question]\nCandidate: [answer]\n..."
        let conversationHistory = '';
        for (const msg of history) {
            const role = msg.role === 'user' ? 'Candidate' : 'Interviewer';
            conversationHistory += `${role}: ${msg.content}\n`;
        }
        // Add the current user message
        conversationHistory += `Candidate: ${message}\nInterviewer:`;

        // ============================================
        // AI INTEGRATION POINT - This is where the magic happens!
        // ============================================
        // We send the conversation to Gemini, which:
        // 1. Understands the context (what question was asked, what the user answered)
        // 2. Evaluates the answer and generates score, strengths, weaknesses, suggestions
        // 3. Generates the next interview question
        const aiResponse = await getAIResponse(conversationHistory);

        return res.json({
            success: !aiResponse.error,
            message: aiResponse.text
        });
    } catch (err) {
        console.error('Chat endpoint error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error. Please try again.',
            error: err.message
        });
    }
});

// ============================================
// STARTUP - Get initial interview question
// ============================================
// Optional: Endpoint to get the first question without sending an answer
app.get('/api/start', async (req, res) => {
    try {
        const conversationHistory = "Candidate: [Interview just starting]\nInterviewer:";
        const aiResponse = await getAIResponse(conversationHistory);

        return res.json({
            success: !aiResponse.error,
            message: aiResponse.text
        });
    } catch (err) {
        console.error('Start endpoint error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error. Please try again.'
        });
    }
});

// ============================================
// SERVER START
// ============================================
app.listen(PORT, () => {
    console.log(`\n🎯 AI Interview Assistant running at http://localhost:${PORT}`);
    if (!GEMINI_API_KEY) {
        console.log('⚠️  GEMINI_API_KEY not set. Set it to enable AI features.');
        console.log('   Get a free key: https://makersuite.google.com/app/apikey\n');
    } else {
        console.log('✅ AI (Gemini) integration ready.\n');
    }
});
