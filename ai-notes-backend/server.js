const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const Groq = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');

// 1. Setup Environment Variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 2. Initialize Clients
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// 3. The Summarize Route
app.post('/api/summarize', async (req, res) => {
    const { content, noteId } = req.body;

    // Safety check: Ensure we have content and an ID
    if (!content || !noteId) {
        return res.status(400).json({ error: "Content and noteId are required." });
    }

    try {
        // A. Call Groq for the Summary
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "Summarize the following note into one short, professional sentence. If it is a list, summarize the main purpose of the list."
                },
                {
                    role: "user",
                    content: content
                }
            ],
            model: "llama-3.3-70b-versatile", // Rock-solid performance in 2026
            temperature: 0.5,
            max_tokens: 100
        });

        const summaryText = chatCompletion.choices[0].message.content;

        // B. Update the Note in Supabase
        const { data, error: dbError } = await supabase
            .from('notes')
            .update({ summary: summaryText })
            .eq('id', noteId)
            .select();

        if (dbError) {
            console.error("Database Error:", dbError);
            return res.status(500).json({ error: "Failed to update database", details: dbError });
        }

        // C. Send success response back to Postman/React
        res.json({
            message: "Summary generated and saved!",
            summary: summaryText,
            updatedNote: data[0]
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({
            error: "AI processing failed.",
            message: error.message
        });
    }
});

// 4. Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`✅ Using Groq with Llama 3.3`);
});