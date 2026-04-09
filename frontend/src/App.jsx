import { useState } from 'react'
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

  const handleSaveAndSummarize = async () => {
    if (!content) return;

    setLoading(true);
    setSummary('');

    try {
      const { data, error: insertError } = await supabase
        .from('notes')
        .insert([{ content: content }])
        .select();

      if (insertError) throw new Error(`Database connectivity issue: ${insertError.message}`);
      
      const newNoteId = data[0].id;

      const response = await fetch(`${API_BASE}/api/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, noteId: newNoteId }),
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(`Synthesis failed: ${response.status}`);
      }

      const aiData = JSON.parse(text);
      setSummary(aiData.summary);
      setContent(''); 

    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col items-center justify-start sm:justify-center p-4 sm:p-6 selection:bg-indigo-500/30">
      
      {/* Header Section - Scale text for mobile */}
      <div className="mt-8 mb-6 sm:mb-10 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2 italic">
          LEXIS<span className="text-indigo-500 not-italic">ARCHIVE</span>
        </h1>
        <p className="text-slate-400 text-[10px] sm:text-xs tracking-[0.2em] sm:tracking-[0.3em] uppercase">
          Intelligent Document Synthesis
        </p>
      </div>

      {/* Main Container - Responsive width & padding */}
      <div className="w-full max-w-2xl bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
        
        <div className="p-5 sm:p-10">
          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-3 tracking-widest">
            Input Raw Content
          </label>
          
          <textarea 
            className="w-full h-48 sm:h-64 bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 sm:px-5 sm:py-4 mb-5 sm:mb-6 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none text-sm sm:text-base text-slate-300 placeholder:text-slate-700 leading-relaxed"
            placeholder="Enter or paste text for archival processing..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />

          <button 
            onClick={handleSaveAndSummarize}
            disabled={loading || !content}
            className="group relative w-full py-4 sm:py-5 bg-white text-slate-950 rounded-xl font-bold tracking-tight overflow-hidden transition-all hover:bg-indigo-50 active:scale-[0.97] disabled:opacity-30 disabled:grayscale"
          >
            <div className="relative z-10 flex items-center justify-center gap-2 text-sm sm:text-base">
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>ANALYZING...</span>
                </>
              ) : (
                <>
                  <span>SYNTHESIZE & ARCHIVE</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 transition-transform group-hover:translate-x-1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </>
              )}
            </div>
          </button>

          {summary && (
            <div className="mt-8 sm:mt-10 animate-in slide-in-from-bottom-4 fade-in duration-700">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-[1px] flex-grow bg-slate-800"></div>
                <span className="text-[9px] sm:text-[10px] text-indigo-400 font-black uppercase tracking-[0.3em]">Executive Summary</span>
                <div className="h-[1px] flex-grow bg-slate-800"></div>
              </div>
              <div className="bg-indigo-500/5 border border-indigo-500/20 p-5 sm:p-6 rounded-2xl relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                 <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-light">
                  {summary}
                 </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="mt-auto sm:mt-12 py-6 text-slate-600 text-[9px] tracking-[0.2em] uppercase text-center">
        Encrypted Endpoint • Llama 3.3 Optimized
      </footer>
    </div>
  )
}

export default App