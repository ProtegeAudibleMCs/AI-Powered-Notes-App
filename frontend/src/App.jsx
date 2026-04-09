import { useState, useEffect } from 'react' // Added useEffect
import { createClient } from '@supabase/supabase-js'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

function App() {
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]); // New state for history

  // Fetch history on initial load
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false }); // Newest first

    if (error) console.error("History fetch error:", error);
    else setHistory(data || []);
  };

  const handleSaveAndSummarize = async () => {
    if (!content) return;
    setLoading(true);
    setSummary('');

    try {
      const { data, error: insertError } = await supabase
        .from('notes')
        .insert([{ content: content }])
        .select();

      if (insertError) throw new Error(`Database error: ${insertError.message}`);
      
      const newNoteId = data[0].id;

      const response = await fetch(`${API_BASE}/api/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, noteId: newNoteId }),
      });

      if (!response.ok) throw new Error(`Synthesis failed`);

      const aiData = await response.json();
      setSummary(aiData.summary);
      setContent(''); 
      
      // Refresh history so the new note appears immediately
      fetchHistory();

    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col items-center p-4 sm:p-8 selection:bg-indigo-500/30">
      
      {/* Header */}
      <div className="mt-4 mb-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1 italic">
          LEXIS<span className="text-indigo-500 not-italic">ARCHIVE</span>
        </h1>
        <p className="text-slate-400 text-[10px] tracking-[0.3em] uppercase">Knowledge Vault</p>
      </div>

      <div className="w-full max-w-2xl space-y-8">
        {/* Input Section */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
          <div className="p-6">
            <textarea 
              className="w-full h-32 bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 mb-4 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-slate-300 placeholder:text-slate-700"
              placeholder="Archive new intelligence..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <button 
              onClick={handleSaveAndSummarize}
              disabled={loading || !content}
              className="w-full py-3 bg-white text-slate-950 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-all disabled:opacity-30"
            >
              {loading ? 'SYNTHESIZING...' : 'PROCESS & SAVE'}
            </button>
          </div>
        </div>

        {/* History Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-4 px-2">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Recent Archive</h2>
            <div className="h-[1px] flex-grow bg-slate-800"></div>
          </div>

          {history.length === 0 ? (
            <p className="text-center text-slate-600 text-sm py-10 italic">Archive is currently empty.</p>
          ) : (
            <div className="grid gap-4">
              {history.map((note) => (
                <div key={note.id} className="bg-slate-900/30 border border-slate-800/50 p-5 rounded-xl hover:border-slate-700 transition-colors group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] text-indigo-500 font-mono">ID: {note.id.toString().slice(0,8)}</span>
                    <span className="text-[10px] text-slate-600 uppercase tracking-tighter">
                      {new Date(note.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 line-clamp-2 mb-3 group-hover:text-slate-300 transition-colors">
                    {note.content}
                  </p>
                  {note.summary && (
                    <div className="bg-indigo-500/5 border-l-2 border-indigo-500 px-3 py-2">
                      <p className="text-xs text-indigo-300 italic">"{note.summary}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <footer className="mt-20 pb-10 text-slate-600 text-[9px] tracking-[0.2em] uppercase">
        Persistent Storage Active • Cloud Verified
      </footer>
    </div>
  )
}

export default App