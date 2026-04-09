import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as pdfjs from 'pdfjs-dist'

/** * VITE NATIVE WORKER CONFIG
 * This tells Vite to treat the worker as a separate asset.
 * If you get a 'Module not found' error, check your node_modules/pdfjs-dist/build 
 * to see if the file is named pdf.worker.js or pdf.worker.mjs
 */
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

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
  const [attachments, setAttachments] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error("Database fetch failed:", err);
    }
  };

  // Helper: Extract text from PDFs or Text files
  const extractTextFromFile = async (file) => {
    if (file.type === 'text/plain') {
      return await file.text();
    }
    
    if (file.type === 'application/pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(s => s.str).join(' ');
      }
      return `\n--- Content from ${file.name} ---\n${fullText}\n`;
    }

    return `\n[File attached: ${file.name} (Content not readable by browser)]\n`;
  };

  const handleFileSelect = (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveAndSummarize = async () => {
    if (!content && attachments.length === 0) return;
    setLoading(true);
    setSelectedNote(null);
    
    try {
      const uploadedPaths = [];
      let allFilesContent = '';

      // 1. Process files: Read content AND upload to storage
      for (const file of attachments) {
        const text = await extractTextFromFile(file);
        allFilesContent += text;

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${Date.now()}-${fileName}`;
        const { error: uploadError } = await supabase.storage.from('archives').upload(filePath, file);
        if (uploadError) throw uploadError;
        uploadedPaths.push(filePath);
      }

      // 2. Insert into Database
      const { data, error: insertError } = await supabase
        .from('notes')
        .insert([{ content, attachments: uploadedPaths }])
        .select();

      if (insertError) throw insertError;
      
      // 3. Trigger AI Synthesis
      const response = await fetch(`${API_BASE}/api/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: `${content}\n\n${allFilesContent}`, 
          noteId: data[0].id 
        }),
      });

      if (!response.ok) throw new Error("Synthesis failed");

      const aiData = await response.json();
      setSummary(aiData.summary);
      
      setContent(''); 
      setAttachments([]);
      fetchHistory();
    } catch (err) {
      console.error(err);
      alert("System Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteNote = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Permanently purge this record?")) return;
    try {
      await supabase.from('notes').delete().eq('id', id);
      if (selectedNote?.id === id) setSelectedNote(null);
      fetchHistory();
    } catch (err) {
      console.error(err);
    }
  };

  const getTopic = (text) => {
    if (!text || typeof text !== 'string') return "Untitled Log";
    const firstLine = text.split('\n')[0].trim();
    return firstLine.length > 30 ? firstLine.substring(0, 30) + "..." : firstLine;
  };

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans">
      
      {/* SIDEBAR */}
      <aside className="w-64 sm:w-72 bg-[#0f172a] border-r border-slate-800/60 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800/40 flex items-center justify-between">
          <h1 className="text-sm font-black italic tracking-tighter text-white uppercase opacity-80">
            Lexis<span className="text-indigo-500 not-italic">Archive</span>
          </h1>
          <button 
            onClick={() => { setSelectedNote(null); setSummary(''); setContent(''); }}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] px-2 py-4 block">Archive Logs</label>
          {history.map((note) => (
            <div 
              key={note.id}
              onClick={() => setSelectedNote(note)}
              className={`group relative flex flex-col p-3 rounded-xl cursor-pointer transition-all ${selectedNote?.id === note.id ? 'bg-slate-800/80' : 'hover:bg-slate-800/30'}`}
            >
              <span className="text-xs font-bold truncate pr-6 text-slate-300">
                {getTopic(note.content || "Document Entry")}
              </span>
              <span className="text-[9px] text-slate-600 mt-1 block font-mono">
                {new Date(note.created_at).toLocaleDateString()}
              </span>
              <button onClick={(e) => deleteNote(e, note.id)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-700 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto bg-[#020617] relative custom-scrollbar">
        <div className="max-w-3xl mx-auto px-6 py-12 sm:py-24">
          
          {!selectedNote ? (
            <div className="space-y-10">
              <div className="mb-12">
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Intelligence Ingestion</h2>
                <p className="text-slate-500 text-sm max-w-md">The AI will now analyze both your text AND the content inside your attachments.</p>
              </div>

              <div className="bg-slate-900/40 border border-slate-800/60 rounded-[2rem] p-8 shadow-2xl relative">
                <textarea 
                  className="w-full h-48 bg-transparent outline-none text-slate-200 placeholder:text-slate-800 resize-none text-xl leading-relaxed font-light"
                  placeholder="Paste transcript or notes..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />

                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1.5 rounded-full">
                        <span className="text-[10px] font-mono text-indigo-300 truncate max-w-[120px]">{file?.name}</span>
                        <button onClick={() => removeAttachment(idx)} className="text-indigo-400 hover:text-rose-500 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-4 flex justify-between items-center border-t border-slate-800/50 pt-8">
                   <div className="flex gap-4">
                      <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple accept=".pdf,.txt" />
                      <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </button>
                   </div>
                  <button onClick={handleSaveAndSummarize} disabled={loading || (!content && attachments.length === 0)} className="px-8 py-4 bg-white text-slate-950 rounded-xl font-black transition-all hover:bg-indigo-50 disabled:opacity-5 text-[10px] tracking-[0.2em]">
                    {loading ? 'READING FILES & SUMMARIZING...' : 'ARCHIVE & SUMMARIZE'}
                  </button>
                </div>
              </div>

              {summary && (
                <div className="mt-16 animate-in slide-in-from-top-4 duration-700">
                  <div className="flex items-center gap-4 mb-6">
                    <span className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.4em]">Deep Synthesis Result</span>
                    <div className="h-[1px] flex-grow bg-slate-800"></div>
                  </div>
                  <div className="bg-indigo-500/5 border border-indigo-500/20 p-8 rounded-[2rem] text-xl text-indigo-100 italic font-serif">"{summary}"</div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-12 animate-in fade-in duration-400">
               <header className="space-y-4">
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.4em]">Archived Intelligence</span>
                <h2 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tighter">
                  {getTopic(selectedNote?.content)}
                </h2>
                {selectedNote?.attachments?.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {selectedNote.attachments.map((name, i) => (
                      <span key={i} className="text-[9px] font-mono px-2 py-1 bg-slate-800 text-slate-500 rounded border border-slate-700 uppercase">📎 {name}</span>
                    ))}
                  </div>
                )}
              </header>

              <div className="space-y-12">
                <div className="bg-slate-900/40 border border-slate-800/80 p-8 rounded-[2rem] shadow-2xl">
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.5em] block mb-6">Executive Summary</label>
                  <p className="text-indigo-50 text-2xl italic font-serif">"{selectedNote?.summary || "No summary available."}"</p>
                </div>
                <div className="border-l border-slate-800 pl-8">
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.5em] block mb-8">Raw Data Transcript</label>
                  <p className="text-slate-400 text-lg leading-loose whitespace-pre-wrap font-light italic">{selectedNote?.content || "No transcript content archived."}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App;