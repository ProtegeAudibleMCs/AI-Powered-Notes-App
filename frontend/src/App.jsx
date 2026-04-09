import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// 1. Environment Variables - Ensure these are set in your Render dashboard
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
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
    setSummary(''); // Clear previous summary

    try {
      // STEP 1: Insert into Supabase
      console.log("Saving to Supabase...");
      const { data, error: insertError } = await supabase
        .from('notes')
        .insert([{ content: content }])
        .select();

      if (insertError) throw new Error(`Supabase Error: ${insertError.message}`);
      
      const newNoteId = data[0].id;
      console.log("Saved! Note ID:", newNoteId);

      // STEP 2: Send to Backend for AI Summary
      console.log("Sending to AI backend at:", `${API_BASE}/api/summarize`);
      
      const response = await fetch(`${API_BASE}/api/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, noteId: newNoteId }),
      });

      // Debugging: Log the raw response status
      console.log("Backend Status:", response.status);
      
      const text = await response.text();
      console.log("Raw Backend Response:", text);

      if (!response.ok) {
        throw new Error(`Server Error (${response.status}): ${text}`);
      }

      const aiData = JSON.parse(text);
      setSummary(aiData.summary);

    } catch (err) {
      console.error("Full Error Object:", err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-3xl font-bold mb-6 text-center text-blue-500">Auto-Notes AI</h1>
        
        <textarea 
          className="w-full h-48 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 mb-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
          placeholder="What's on your mind? Just type, the AI handles the rest..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        <button 
          onClick={handleSaveAndSummarize}
          disabled={loading}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : 'Save & Summarize'}
        </button>

        {summary && (
          <div className="mt-8 p-4 bg-zinc-950 border-l-4 border-blue-500 rounded-r-lg animate-in fade-in duration-500">
            <span className="text-xs text-blue-400 font-bold uppercase tracking-wider">AI Insight</span>
            <p className="mt-1 text-zinc-300 italic">"{summary}"</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App