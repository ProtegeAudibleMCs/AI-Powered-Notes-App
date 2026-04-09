const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const Groq = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const app = express();

// UPDATED CORS: More flexible for Render subdomains
app.use(cors({
  origin: '*', // Allows all origins for testing; change to your specific URL later
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// HEALTH CHECK: Visit https://your-backend.onrender.com/ in your browser to test
app.get('/', (req, res) => {
  res.send("AI Backend is Awake and Running!");
});

// INITIALIZE CLIENTS
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// DOUBLE CHECK: Ensure your Render Env Var is named SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

app.post('/api/summarize', async (req, res) => {
  const { content, noteId } = req.body;

  if (!content || !noteId) {
    return res.status(400).json({ error: "Content and noteId are required." });
  }

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "Summarize the following note into one short, professional sentence." },
        { role: "user", content: content }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
    });

    const summaryText = chatCompletion.choices[0].message.content;

    const { data, error: dbError } = await supabase
      .from('notes')
      .update({ summary: summaryText })
      .eq('id', noteId)
      .select();

    if (dbError) {
      console.error("Database Error:", dbError);
      return res.status(500).json({ error: "DB Update Failed", details: dbError });
    }

    res.json({
      message: "Success!",
      summary: summaryText
    });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: "AI Failed", message: error.message });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log(`Server on ${port}`));