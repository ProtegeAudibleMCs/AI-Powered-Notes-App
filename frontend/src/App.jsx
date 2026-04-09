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
  const [selectedNote, setSelectedNote] = useState(null); // State for the popup

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

      if (!response.ok) throw new Error("AI Synthesis failed");

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

  const deleteNote = async (id) => {
    if (!confirm("Are you sure you want to purge this record?")) return;
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) alert("Delete failed");
    else {
      setSelectedNote(null);
      fetchHistory();
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col items-center p-4 sm:p-8 selection:bg-indigo-500/30">
      
      {/* Header */}
      <header className="mt-4 mb-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1 italic uppercase">
          Lexis<span className="text-indigo-500 not-italic">Archive</span>
        </h1>
        <p className="text-slate-400 text-[10px] tracking-[0.3em] uppercase">Intelligence Terminal</p>
      </header>

      <main className="w-full max-w-2xl space-y-12">
        {/* Entry Section */}
        <section className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-1 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
          <div className="p-6 sm:p-8">
            <textarea 
              className="w-full h-32 bg-slate-950/40 border border-slate-800 rounded-2xl px-5 py-4 mb-4 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-slate-300 placeholder:text-slate-700 resize-none"
              placeholder="Input new raw data for processing..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <button 
              onClick={handleSaveAndSummarize}
              disabled={loading || !content}
              className="w-full py-4 bg-white text-slate-950 rounded-xl font-bold hover:bg-indigo-50 transition-all disabled:opacity-20 uppercase tracking-tight text-sm"
            >
              {loading ? 'Synthesizing...' : 'Process Intelligence'}
            </button>
          </div>
        </section>

        {/* History Feed */}
        <section className="space-y-6">
          <div className="flex items-center gap-4 px-2">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Encrypted Logs</h2>
            <div className="h-[1px] flex-grow bg-slate-800/50"></div>
          </div>

          <div className="grid gap-4">
            {history.map((note) => (
              <button 
                key={note.id} 
                onClick={() => setSelectedNote(note)}
                className="w-full text-left bg-slate-900/30 border border-slate-800/50 p-6 rounded-2xl hover:bg-slate-800/30 hover:border-indigo-500/30 transition-all group"
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[9px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded tracking-tighter">
                    REF_{note.id.toString().slice(0,6).toUpperCase()}
                  </span>
                  <span className="text-[10px] text-slate-600 font-medium tracking-wide">
                    {new Date(note.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-slate-400 line-clamp-2 mb-0 group-hover:text-slate-200 transition-colors">
                  {note.content}
                </p>
              </button>
            ))}
          </div>
        </section>
      </main>

      {/* Modal Overlay */}
      {selectedNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 sm:p-10 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mb-1">Intelligence Report</h3>
                  <p className="text-xs text-slate-500 font-mono">Archived on {new Date(selectedNote.created_at).toLocaleString()}</p>
                </div>
                <button 
                  onClick={() => setSelectedNote(null)}
                  className="p-2 hover:bg-slate-800 rounded-full text-slate-500 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest block mb-3">Executive Summary</label>
                  <div className="bg-indigo-500/5 border border-indigo-500/20 p-5 rounded-2xl">
                    <p className="text-indigo-100 text-lg italic leading-relaxed font-light">
                      "{selectedNote.summary || "Summary pending..."}"
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest block mb-3">Raw Content</label>
                  <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap font-light px-1">
                    {selectedNote.content}
                  </p>
                </div>

                <div className="pt-8 border-t border-slate-800 flex justify-between items-center">
                  <button 
                    onClick={() => deleteNote(selectedNote.id)}
                    className="text-xs font-bold text-rose-500/70 hover:text-rose-500 transition-colors flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    PURGE RECORD
                  </button>
                  <button 
                    onClick={() => setSelectedNote(null)}
                    className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all"
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App