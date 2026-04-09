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
    setSelectedNote(null); // Reset view to "New Note" mode
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
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-64 sm:w-80 bg-[#0f172a] border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800/50">
          <h1 className="text-xl font-black italic tracking-tighter text-white uppercase">
            Lexis<span className="text-indigo-500 not-italic">Archive</span>
          </h1>
          <button 
            onClick={() => { setSelectedNote(null); setSummary(''); setContent(''); }}
            className="mt-6 w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            NEW SYNTHESIS
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2 mb-2 block">Archive Logs</label>
          {history.map((note) => (
            <div 
              key={note.id}
              onClick={() => setSelectedNote(note)}
              className={`group relative flex flex-col p-3 rounded-xl cursor-pointer transition-all border ${
                selectedNote?.id === note.id 
                ? 'bg-slate-800 border-indigo-500/50 shadow-lg' 
                : 'border-transparent hover:bg-slate-800/50'
              }`}
            >
              <span className="text-xs font-bold text-slate-200 truncate pr-6">
                {getTopic(note.content)}
              </span>
              <span className="text-[9px] text-slate-500 mt-1 uppercase font-mono tracking-tighter">
                {new Date(note.created_at).toLocaleDateString()}
              </span>
              
              <button 
                onClick={(e) => deleteNote(e, note.id)}
                className="absolute right-2 top-3 p-1.5 text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
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
      <main className="flex-1 overflow-y-auto bg-[#020617] relative">
        <div className="max-w-3xl mx-auto px-6 py-12 sm:py-20">
          
          {!selectedNote ? (
            /* INPUT MODE */
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-white mb-2">New Intelligence Entry</h2>
                <p className="text-slate-500 text-sm italic">Submit raw data for high-level synthesis.</p>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 shadow-2xl">
                <textarea 
                  className="w-full h-64 bg-transparent outline-none text-slate-300 placeholder:text-slate-700 resize-none text-lg leading-relaxed px-2"
                  placeholder="Type or paste content here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
                <div className="mt-4 pt-4 border-t border-slate-800/50 flex justify-end">
                  <button 
                    onClick={handleSaveAndSummarize}
                    disabled={loading || !content}
                    className="px-8 py-3 bg-white text-slate-950 rounded-xl font-bold transition-all hover:bg-indigo-50 disabled:opacity-20 active:scale-95"
                  >
                    {loading ? 'SYNTHESIZING...' : 'GENERATE REPORT'}
                  </button>
                </div>
              </div>

              {summary && (
                <div className="animate-in zoom-in-95 duration-500 mt-12">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.3em]">Success / Synthesis Complete</span>
                    <div className="h-[1px] flex-grow bg-slate-800"></div>
                  </div>
                  <div className="bg-indigo-500/5 border border-indigo-500/20 p-8 rounded-3xl italic text-xl text-indigo-100 leading-relaxed font-light">
                    "{summary}"
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* DISPLAY MODE (When a Sidebar item is clicked) */
            <div className="space-y-12 animate-in fade-in duration-300">
              <header className="border-b border-slate-800 pb-8">
                <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest block mb-2">Topic Analysis</span>
                <h2 className="text-4xl font-black text-white leading-tight">{getTopic(selectedNote.content)}</h2>
                <p className="text-slate-500 font-mono text-xs mt-4">Archived on {new Date(selectedNote.created_at).toLocaleString()}</p>
              </header>

              <div className="space-y-10">
                <div className="bg-indigo-500/5 border border-indigo-500/20 p-8 rounded-3xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                  <label className="text-[9px] font-black text-indigo-400/50 uppercase tracking-[0.4em] block mb-4">Executive Summary</label>
                  <p className="text-indigo-50 text-2xl italic leading-relaxed font-light font-serif">
                    "{selectedNote.summary || "Summary generation in progress..."}"
                  </p>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em] block mb-6">Full Intelligence Log</label>
                  <p className="text-slate-400 text-lg leading-relaxed whitespace-pre-wrap font-light max-w-2xl">
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