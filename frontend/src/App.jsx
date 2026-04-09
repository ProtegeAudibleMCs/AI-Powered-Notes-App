import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// Configuration
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

function App() {
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error("Database Fetch Error:", error);
    else setHistory(data || []);
  };

  const handleSaveAndSummarize = async () => {
    if (!content) return;
    setLoading(true);
    setSelectedNote(null);
    try {
      const { data, error: insertError } = await supabase
        .from('notes')
        .insert([{ content }])
        .select();

      if (insertError) throw insertError;
      
      const response = await fetch(`${API_BASE}/api/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, noteId: data[0].id }),
      });

      if (!response.ok) throw new Error("AI synthesis protocol failed.");

      const aiData = await response.json();
      setSummary(aiData.summary);
      setContent(''); 
      fetchHistory();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteNote = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Permanently purge this record from the archive?")) return;
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) alert("Purge failed.");
    else {
      if (selectedNote?.id === id) setSelectedNote(null);
      fetchHistory();
    }
  };

  const getTopic = (text) => {
    if (!text) return "Untitled Log";
    const firstLine = text.split('\n')[0].trim();
    return firstLine.length > 30 ? firstLine.substring(0, 30) + "..." : firstLine;
  };

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 sm:w-72 bg-[#0f172a] border-r border-slate-800/60 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800/40 flex items-center justify-between">
          <h1 className="text-sm font-black italic tracking-tighter text-white uppercase opacity-80">
            Lexis<span className="text-indigo-500 not-italic">Archive</span>
          </h1>
          
          <button 
            onClick={() => { setSelectedNote(null); setSummary(''); setContent(''); }}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all active:scale-90"
            title="New Entry"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] px-2 py-4 block">Archive Logs</label>
          
          {history.length === 0 && (
            <div className="px-2 py-4 text-[11px] text-slate-700 italic">No records found.</div>
          )}

          {history.map((note) => (
            <div 
              key={note.id}
              onClick={() => setSelectedNote(note)}
              className={`group relative flex flex-col p-3 rounded-xl cursor-pointer transition-all ${
                selectedNote?.id === note.id 
                ? 'bg-slate-800/80' 
                : 'hover:bg-slate-800/30'
              }`}
            >
              <span className={`text-xs font-bold truncate pr-6 transition-colors ${selectedNote?.id === note.id ? 'text-indigo-400' : 'text-slate-300'}`}>
                {getTopic(note.content)}
              </span>
              <span className="text-[9px] text-slate-600 mt-1 block font-mono uppercase tracking-tighter">
                {new Date(note.created_at).toLocaleDateString()}
              </span>
              
              <button 
                onClick={(e) => deleteNote(e, note.id)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-700 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </nav>
      </aside>

      {/* MAIN CONTENT STAGE */}
      <main className="flex-1 overflow-y-auto bg-[#020617] relative custom-scrollbar">
        <div className="max-w-3xl mx-auto px-6 py-12 sm:py-24">
          
          {!selectedNote ? (
            /* COMPOSER MODE */
            <div className="space-y-10 animate-in fade-in duration-500">
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl">
                <textarea 
                  className="w-full h-72 bg-transparent outline-none text-slate-200 placeholder:text-slate-800 resize-none text-xl sm:text-2xl leading-relaxed font-light"
                  placeholder="Initiate synthesis protocol..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
                <div className="mt-8 flex justify-between items-center border-t border-slate-800/50 pt-8">
                  <span className="text-[10px] text-slate-600 font-mono tracking-widest uppercase">Buffer: {content.length}</span>
                  <button 
                    onClick={handleSaveAndSummarize}
                    disabled={loading || !content}
                    className="px-10 py-4 bg-white text-slate-950 rounded-2xl font-black transition-all hover:bg-indigo-50 disabled:opacity-10 active:scale-95 text-[10px] tracking-[0.2em]"
                  >
                    {loading ? 'ANALYZING...' : 'ARCHIVE & SYNTHESIZE'}
                  </button>
                </div>
              </div>

              {summary && (
                <div className="animate-in slide-in-from-top-4 duration-700 mt-16">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-[1px] w-8 bg-indigo-500"></div>
                    <span className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.4em]">Synthesis Result</span>
                  </div>
                  <div className="bg-indigo-500/5 border border-indigo-500/20 p-10 rounded-[2.5rem] text-2xl text-indigo-100 leading-relaxed font-serif italic">
                    "{summary}"
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ARCHIVE VIEW MODE */
            <div className="space-y-16 animate-in fade-in duration-400">
              <header className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.4em]">Verified Log</span>
                </div>
                <h2 className="text-4xl sm:text-6xl font-black text-white leading-tight tracking-tighter">
                  {getTopic(selectedNote.content)}
                </h2>
                <p className="text-slate-500 font-mono text-xs tracking-tighter italic border-l border-slate-800 pl-4 py-1">
                  ARCHIVED: {new Date(selectedNote.created_at).toLocaleString()}
                </p>
              </header>

              <div className="space-y-12">
                <div className="bg-slate-900/40 border border-slate-800/80 p-10 rounded-[2.5rem] relative shadow-2xl">
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.5em] block mb-6">Executive Summary</label>
                  <p className="text-indigo-50 text-2xl sm:text-3xl italic leading-relaxed font-serif">
                    "{selectedNote.summary || "Summary data processing..."}"
                  </p>
                </div>

                <div className="px-2 pb-20">
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.5em] block mb-8">Full Intelligence Log</label>
                  <p className="text-slate-400 text-lg sm:text-xl leading-loose whitespace-pre-wrap font-light italic">
                    {selectedNote.content}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App