import { useState, useEffect } from 'react'
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

    if (error) console.error("Fetch error:", error);
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

      if (!response.ok) throw new Error("Synthesis failed");

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
    if (!confirm("Permanently purge this record?")) return;
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) alert("Purge failed");
    else {
      if (selectedNote?.id === id) setSelectedNote(null);
      fetchHistory();
    }
  };

  const getTopic = (text) => {
    if (!text) return "Untitled Log";
    const firstLine = text.split('\n')[0];
    return firstLine.length > 30 ? firstLine.substring(0, 30) + "..." : firstLine;
  };

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans">
      
      {/* SIDEBAR */}
      <aside className="w-20 sm:w-72 bg-[#0f172a] border-r border-slate-800/60 flex flex-col shrink-0">
        <div className="p-4 sm:p-6 border-b border-slate-800/50 flex flex-col items-center sm:items-stretch">
          <h1 className="hidden sm:block text-lg font-black italic tracking-tighter text-white uppercase mb-6">
            Lexis<span className="text-indigo-500 not-italic">Archive</span>
          </h1>
          
          {/* ICON-ONLY BUTTON */}
          <button 
            onClick={() => { setSelectedNote(null); setSummary(''); setContent(''); }}
            className="group flex items-center justify-center w-12 h-12 sm:w-full sm:h-auto sm:py-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl sm:rounded-xl text-white transition-all shadow-lg shadow-indigo-500/10 active:scale-95"
            title="New Synthesis"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline-block ml-2 text-xs font-black tracking-widest">NEW ENTRY</span>
          </button>
        </div>

        {/* CUSTOM SCROLLBAR NAV */}
        <nav className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1 custom-scrollbar">
          <label className="hidden sm:block text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] px-2 mb-4">Archive Database</label>
          
          {history.map((note) => (
            <div 
              key={note.id}
              onClick={() => setSelectedNote(note)}
              className={`group relative flex flex-col items-center sm:items-start p-3 rounded-xl cursor-pointer transition-all ${
                selectedNote?.id === note.id 
                ? 'bg-slate-800/80 shadow-inner' 
                : 'hover:bg-slate-800/40'
              }`}
            >
              {/* Mobile View: Icon or initial */}
              <div className="sm:hidden w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-bold text-indigo-400 border border-slate-700">
                {getTopic(note.content).charAt(0).toUpperCase()}
              </div>

              {/* Desktop View: Text */}
              <div className="hidden sm:block w-full">
                <div className="flex justify-between items-start w-full">
                  <span className={`text-xs font-bold truncate pr-6 transition-colors ${selectedNote?.id === note.id ? 'text-indigo-400' : 'text-slate-300'}`}>
                    {getTopic(note.content)}
                  </span>
                </div>
                <span className="text-[9px] text-slate-600 mt-1 block font-mono uppercase">
                  {new Date(note.created_at).toLocaleDateString()}
                </span>
              </div>
              
              <button 
                onClick={(e) => deleteNote(e, note.id)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-700 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all hidden sm:block"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto bg-[#020617] relative custom-scrollbar">
        <div className="max-w-3xl mx-auto px-6 py-12 sm:py-24">
          
          {!selectedNote ? (
            <div className="space-y-10 animate-in fade-in duration-500">
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
                <textarea 
                  className="w-full h-72 bg-transparent outline-none text-slate-200 placeholder:text-slate-800 resize-none text-xl sm:text-2xl leading-relaxed font-light italic"
                  placeholder="Initiate synthesis protocol..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
                <div className="mt-8 flex justify-between items-center">
                  <span className="text-[10px] text-slate-600 font-mono tracking-widest uppercase">Input Buffer: {content.length} chars</span>
                  <button 
                    onClick={handleSaveAndSummarize}
                    disabled={loading || !content}
                    className="px-10 py-4 bg-white text-slate-950 rounded-2xl font-black transition-all hover:bg-indigo-50 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] disabled:opacity-10 active:scale-95 text-xs tracking-[0.2em]"
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
                  <div className="bg-indigo-500/5 border border-indigo-500/20 p-10 rounded-[2rem] text-2xl text-indigo-100 leading-relaxed font-serif italic shadow-inner">
                    "{summary}"
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-16 animate-in fade-in duration-400">
              <header className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.4em]">Verified Archive</span>
                </div>
                <h2 className="text-4xl sm:text-6xl font-black text-white leading-tight tracking-tighter">
                  {getTopic(selectedNote.content)}
                </h2>
                <p className="text-slate-500 font-mono text-xs tracking-tighter italic border-l border-slate-800 pl-4 py-1">
                  TIMESTAMP: {new Date(selectedNote.created_at).toLocaleString()}
                </p>
              </header>

              <div className="space-y-12">
                <div className="bg-slate-900/40 border border-slate-800/80 p-10 rounded-[2.5rem] relative shadow-2xl">
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.5em] block mb-6">Executive Summary</label>
                  <p className="text-indigo-50 text-2xl sm:text-3xl italic leading-relaxed font-serif">
                    "{selectedNote.summary || "Archival data pending synthesis..."}"
                  </p>
                </div>

                <div className="px-2">
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.5em] block mb-8">Raw Transcript</label>
                  <p className="text-slate-400 text-lg sm:text-xl leading-loose whitespace-pre-wrap font-light italic max-w-2xl">
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