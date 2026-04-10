import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as pdfjs from 'pdfjs-dist'

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // New State for Editing
  const [editableContent, setEditableContent] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  // Sync editable content when a note is selected
  useEffect(() => {
    if (selectedNote) {
      setEditableContent(selectedNote.content || '');
    }
  }, [selectedNote]);

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

  const extractTextFromFile = async (file) => {
    if (file.type === 'text/plain') return await file.text();
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
    return `\n[File attached: ${file.name}]\n`;
  };

  const handleSaveAndSummarize = async () => {
    if (!content && attachments.length === 0) return;
    setLoading(true);
    setSelectedNote(null);
    try {
      const uploadedPaths = [];
      let allFilesContent = '';
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
      const { data, error: insertError } = await supabase
        .from('notes')
        .insert([{ content: `${content}\n${allFilesContent}`, attachments: uploadedPaths }])
        .select();
      if (insertError) throw insertError;
      
      const response = await fetch(`${API_BASE}/api/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `${content}\n\n${allFilesContent}`, noteId: data[0].id }),
      });
      
      const aiData = await response.json();
      setSummary(aiData.summary);
      setContent(''); 
      setAttachments([]);
      fetchHistory();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // NEW: Update existing note
  const handleUpdateNote = async () => {
    if (!selectedNote) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('notes')
        .update({ content: editableContent })
        .eq('id', selectedNote.id);
      
      if (error) throw error;
      await fetchHistory();
      alert("Note updated successfully.");
    } catch (err) {
      alert("Update failed: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteNote = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Permanently purge this record?")) return;
    await supabase.from('notes').delete().eq('id', id);
    if (selectedNote?.id === id) setSelectedNote(null);
    fetchHistory();
  };

  const getTopic = (text) => {
    if (!text) return "Untitled Log";
    const firstLine = text.split('\n')[0].trim();
    return firstLine.length > 25 ? firstLine.substring(0, 25) + "..." : firstLine;
  };

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans relative">
      
      {/* SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-[60] w-72 bg-[#0f172a] border-r border-slate-800/60 transform transition-transform duration-300 lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-5 border-b border-slate-800/40 flex items-center justify-between">
          <h1 className="text-sm font-black italic tracking-tighter text-white uppercase opacity-80">
            Lexis<span className="text-indigo-500 not-italic">Archive</span>
          </h1>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1 h-[calc(100vh-80px)] custom-scrollbar">
          <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] px-2 py-4 block">Personal Workspace</label>
          {history.map((note) => (
            <div 
              key={note.id}
              onClick={() => { setSelectedNote(note); setIsSidebarOpen(false); }}
              className={`group relative flex flex-col p-3 rounded-xl cursor-pointer transition-all ${selectedNote?.id === note.id ? 'bg-slate-800/80' : 'hover:bg-slate-800/30'}`}
            >
              <span className="text-xs font-bold truncate pr-6 text-slate-300">{getTopic(note.content)}</span>
              <span className="text-[9px] text-slate-600 mt-1 block font-mono">{new Date(note.created_at).toLocaleDateString()}</span>
              <button onClick={(e) => deleteNote(e, note.id)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-700 hover:text-rose-500 lg:opacity-0 lg:group-hover:opacity-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          ))}
        </nav>
      </aside>

      {/* MOBILE HEADER */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0f172a] border-b border-slate-800/60 flex items-center justify-between px-4 z-50">
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
        </button>
        <span className="font-bold text-xs tracking-widest uppercase">Workspace</span>
        <button onClick={() => { setSelectedNote(null); setSummary(''); setContent(''); }} className="p-2 text-indigo-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
        </button>
      </div>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto bg-[#020617] relative custom-scrollbar pt-16 lg:pt-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 lg:py-16">
          
          {!selectedNote ? (
            /* NEW NOTE INTERFACE */
            <div className="max-w-3xl mx-auto space-y-10">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">New Brain Dump</h2>
                <p className="text-slate-500 text-sm">Drop your files or raw thoughts. We'll archive and clean it up for you.</p>
              </div>

              <div className="bg-slate-900/40 border border-slate-800/60 rounded-[2rem] p-6 lg:p-8 shadow-2xl">
                <textarea 
                  className="w-full h-64 bg-transparent outline-none text-slate-200 placeholder:text-slate-800 resize-none text-lg lg:text-xl leading-relaxed font-light"
                  placeholder="Start typing..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />

                <div className="mt-4 flex flex-col sm:flex-row justify-between items-center border-t border-slate-800/50 pt-6 gap-4">
                   <div className="flex gap-4 w-full sm:w-auto">
                      <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple accept=".pdf,.txt" />
                      <button onClick={() => fileInputRef.current?.click()} className="flex-1 sm:flex-none p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                      </button>
                   </div>
                  <button onClick={handleSaveAndSummarize} disabled={loading || (!content && attachments.length === 0)} className="w-full sm:w-auto px-10 py-4 bg-white text-slate-950 rounded-xl font-black hover:bg-indigo-50 transition-all text-[10px] tracking-[0.2em]">
                    {loading ? 'PROCESSING...' : 'SAVE & ARCHIVE'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* NOTE EDITOR INTERFACE (Duo Layout) */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
              
              {/* Left Column: Editable Workspace */}
              <div className="flex flex-col space-y-6">
                <header className="flex justify-between items-end">
                  <div>
                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.4em]">Active Workspace</span>
                    <h2 className="text-3xl font-black text-white tracking-tighter mt-2">Your Notes</h2>
                  </div>
                  <button 
                    onClick={handleUpdateNote} 
                    disabled={isUpdating}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all"
                  >
                    {isUpdating ? 'Saving...' : 'Update Note'}
                  </button>
                </header>
                <textarea 
                  className="w-full h-[60vh] bg-slate-900/40 border border-slate-800/80 p-6 rounded-[1.5rem] text-slate-300 text-lg leading-relaxed resize-none focus:border-indigo-500/50 outline-none transition-all"
                  value={editableContent}
                  onChange={(e) => setEditableContent(e.target.value)}
                />
              </div>

              {/* Right Column: AI Insights */}
              <div className="flex flex-col space-y-6">
                <div>
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em]">AI Synthesis</span>
                  <h2 className="text-3xl font-black text-slate-400 tracking-tighter mt-2">Insights</h2>
                </div>
                <div className="bg-indigo-500/5 border border-indigo-500/20 p-8 rounded-[1.5rem] h-fit">
                  <label className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.5em] block mb-4">Executive Summary</label>
                  <p className="text-indigo-50 text-xl italic font-serif leading-relaxed">
                    "{selectedNote?.summary || "Summary generation in progress..."}"
                  </p>
                </div>
                {selectedNote?.attachments?.length > 0 && (
                  <div className="bg-slate-900/20 border border-slate-800/40 p-6 rounded-[1.5rem]">
                    <label className="text-[8px] font-black text-slate-600 uppercase tracking-[0.5em] block mb-4">Linked Sources</label>
                    <div className="flex flex-wrap gap-2">
                      {selectedNote.attachments.map((name, i) => (
                        <span key={i} className="text-[8px] font-mono px-3 py-1 bg-slate-800/50 text-slate-500 rounded-full border border-slate-700/50 uppercase">📎 {name}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App;