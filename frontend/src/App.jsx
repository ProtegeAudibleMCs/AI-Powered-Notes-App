import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// At the top of App.jsx, after your imports
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Initialize Supabase (Use your actual URL and Key here)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

function App() {
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSaveAndSummarize = async () => {
    if (!content) return alert("Write something first!");

    setLoading(true);
    try {
      // STEP 1: Insert into Supabase and get the new ID back
      // Note: We use .select() to get the inserted row back in v2
      const { data, error: insertError } = await supabase
        .from('notes')
        .insert([{ content: content }])
        .select();

      if (insertError) throw insertError;
      
      const newNoteId = data[0].id; // Here is your automatic ID!

      // STEP 2: Send to your Node.js backend for AI magic
     const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: content, 
          noteId: newNoteId 
        }),
      });

      const aiData = await response.json();
      setSummary(aiData.summary);

    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
    const handleSaveAndSummarize = async () => {
    if (!content) return alert("Write something first!");

    setLoading(true);
    try {
      const { data, error: insertError } = await supabase
        .from('notes')
        .insert([{ content: content }])
        .select();

      if (insertError) throw insertError;
      
      const newNoteId = data[0].id;

      // 2. Change your fetch URL to use API_BASE
    const response = await fetch(`${API_BASE}/api/summarize`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content, noteId: newNoteId }),
});

// ADD THIS LOGGING
console.log("Response Status:", response.status);
const text = await response.text(); // Get raw text first
console.log("Raw Response:", text);

if (!response.ok) {
  throw new Error(`Server status ${response.status}: ${text}`);
}

const aiData = JSON.parse(text); // Manually parse since we know it's not empty
setSummary(aiData.summary);

    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };
  };

  

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-3xl font-bold mb-6 text-center">Auto-Notes AI</h1>
        
        <textarea 
          className="w-full h-48 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 mb-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          placeholder="What's on your mind? Just type, the AI handles the ID and summary..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        <button 
          onClick={handleSaveAndSummarize}
          disabled={loading}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-all disabled:opacity-50"
        >
          {loading ? 'Generating ID & Summary...' : 'Save & Summarize'}
        </button>

        {summary && (
          <div className="mt-8 p-4 bg-zinc-950 border-l-4 border-blue-500 rounded-r-lg">
            <span className="text-xs text-blue-400 font-bold uppercase">AI Insight</span>
            <p className="mt-1 text-zinc-300 italic">"{summary}"</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App