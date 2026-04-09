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

  const deleteNote = async (e, id) => {
    e.stopPropagation(); // Prevents the modal from opening when clicking delete
    if (!confirm("Permanently purge this record from the archive?")) return;
    
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) alert("Purge failed");
    else fetchHistory();
  };

  // Helper to generate a "Topic" from the content
  const getTopic = (text) => {
    const firstLine = text.split('\n')[0];
    return firstLine.length > 40 ? firstLine.substring(0, 40) + "..." : firstLine;
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col items-center p-4 sm:p-8 selection:bg-indigo-500/30">
      
      <header className="mt-4 mb-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1 italic uppercase">
          Lexis<span className="text-indigo-500 not-italic">Archive</span>
        </h1>
        <p className="text-slate-400 text-[10px] tracking-[0.4em] uppercase font-black">Intelligence Terminal</p>
      </header>

      <main className="w-full max-w-2xl space-y-10">
        {/* Entry Section */}
        <section className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-1 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
          <div className="p-6 sm:p-8">
            <textarea 
              className="w-full h-32 bg-slate-950/40 border border-slate-800 rounded-2xl px-5 py-4 mb-4 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-slate-300 placeholder:text-slate-700 resize-none"
              placeholder="Input raw data for synthesis..."
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
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Archived Logs</h2>
            <div className="h-[1px] flex-grow bg-slate-800/50"></div>
          </div>

          <div className="grid gap-3">
            {history.map((note) => (
              <div 
                key={note.id} 
                onClick={() => setSelectedNote(note)}
                className="relative w-full text-left bg-slate-900/40 border border-slate-800/60 p-5 rounded-2xl hover:bg-slate-800/40 hover:border-indigo-500/40 transition-all group cursor-pointer"
              >
                <div className="flex justify-between items-start mb-2 pr-8">
                  <h3 className="text-sm font-bold text-indigo-100 truncate pr-4">
                    {getTopic(note.content)}
                  </h3>
                  <span className="text-[10px] text-slate-600 font-mono whitespace-nowrap mt-1">
                    {new Date(note.created_at).toLocaleDateString()}
                  </span>
                </div>
                
                <p className="text-xs text-slate-500 line-clamp-1 mb-3">
                  {note.content}
                </p>

                {note.summary && (
                  <div className="bg-indigo-500/5 border-l border-indigo-500/30 px-3 py-2">
                    <p className="text-[11px] text-indigo-400/80 italic line-clamp-1">"{note.summary}"</p>
                  </div>
                )}

                {/* Direct Delete Button */}
                <button 
                  onClick={(e) => deleteNote(e, note.id)}
                  className="absolute top-4 right-4 p-2 text-slate-700 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all duration-200"
                  title="Delete Record"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Modal Overlay (Maintains the Deep Dive view) */}
      {selectedNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm" onClick={() => setSelectedNote(null)}>
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-8 sm:p-12 max-h-[80vh] overflow-y-auto">
              <div className="mb-8">
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block mb-2">Topic Analysis</span>
                <h2 className="text-2xl font-bold text-white leading-tight">{getTopic(selectedNote.content)}</h2>
              </div>
              
              <div className="space-y-8">
                <div className="bg-indigo-500/5 border border-indigo-500/20 p-6 rounded-2xl">
                  <p className="text-indigo-100 text-lg italic leading-relaxed font-light italic">
                    "{selectedNote.summary || "Summary pending..."}"
                  </p>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest block mb-3">Full Intelligence Log</label>
                  <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap font-light italic">
                    {selectedNote.content}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedNote(null)}
                className="mt-10 w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
              >
                CLOSE REPORT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App