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
  
  const [editableContent, setEditableContent] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (selectedNote) {
      setEditableContent(selectedNote.content || '');
    } else {
      setEditableContent('');
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
    try {
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
    } catch (e) {
      console.error("Extraction failed", e);
    }
    return `\n[File attached: ${file.name}]\n`;
  };

  const handleSaveAndSummarize = async () => {
    if (!content && attachments.length === 0) return;
    setLoading(true);
    try {
      const uploadedPaths = [];
      let allFilesContent = '';
      for (const file of attachments) {
        const text = await extractTextFromFile(file);
        allFilesContent += text;
        const filePath = `${Date.now()}-${file.name}`;
        await supabase.storage.from('archives').upload(filePath, file);
        uploadedPaths.push(filePath);
      }
      
      const { data, error: insertError } = await supabase
        .from('notes')
        .insert([{ content: `${content}\n${allFilesContent}`, attachments: uploadedPaths }])
        .select();

      if (insertError) throw insertError;
      
      await fetch(`${API_BASE}/api/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `${content}\n\n${allFilesContent}`, noteId: data[0].id }),
      });
      
      setContent(''); 
      setAttachments([]);
      fetchHistory();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateNote = async () => {
    if (!selectedNote) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('notes')
        .update({ content: editableContent })
        .eq('id', selectedNote.id);
      if (error) throw error;
      fetchHistory();
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteNote = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Delete?")) return;
    await supabase.from('notes').delete().eq('id', id);
    if (selectedNote?.id === id) setSelectedNote(null);
    fetchHistory();
  };

  const getTopic = (text) => {
    if (!text) return "Untitled Entry";
    const firstLine = text.trim().split('\n')[0];
    return firstLine.length > 25 ? firstLine.substring(0, 25) + "..." : firstLine;
  };

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans relative">
      
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-[60] w-72 bg-[#0f172a] border-r border-slate-800/60 transition-transform lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-slate-800/40 flex items-center justify-between">
          <h1 className="text-sm font-black italic tracking-tighter text-white uppercase">Lexis<span className="text-indigo-500 not-italic">Archive</span></h1>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400">✕</button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 h-[calc(100vh-80px)] custom-scrollbar">
          {history.map((note) => (
            <div key={note.id} onClick={() => { setSelectedNote(note); setIsSidebarOpen(false); }} className={`group relative flex flex-col p-3 rounded-xl cursor-pointer ${selectedNote?.id === note.id ? 'bg-slate-800/80' : 'hover:bg-slate-800/30'}`}>
              <span className="text-xs font-bold truncate pr-6">{getTopic(note.content)}</span>
              <span className="text-[9px] text-slate-600 mt-1 font-mono">{new Date(note.created_at).toLocaleDateString()}</span>
              <button onClick={(e) => deleteNote(e, note.id)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-700 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">✕</button>
            </div>
          ))}
        </nav>
      </aside>

      {/* MOBILE HEADER */}
      {!isSidebarOpen && (
        <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0f172a] border-b border-slate-800/60 flex items-center justify-between px-4 z-50">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400">☰</button>
          <span className="font-bold text-xs tracking-widest uppercase">Workspace</span>
          <button onClick={() => setSelectedNote(null)} className="p-2 text-indigo-500">+</button>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto bg-[#020617] relative custom-scrollbar pt-16 lg:pt-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 lg:py-16">
          
          {!selectedNote ? (
            <div className="max-w-3xl mx-auto space-y-10">
              <h2 className="text-3xl font-bold text-white">New Entry</h2>
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-[2rem] p-6 lg:p-8 shadow-2xl">
                <textarea className="w-full h-64 bg-transparent outline-none text-slate-200 resize-none text-lg lg:text-xl font-light" placeholder="Start typing..." value={content} onChange={(e) => setContent(e.target.value)} />
                <div className="mt-4 flex flex-col sm:flex-row justify-between items-center border-t border-slate-800/50 pt-6 gap-4">
                  <input type="file" ref={fileInputRef} onChange={(e) => setAttachments(Array.from(e.target.files))} className="hidden" multiple accept=".pdf,.txt" />
                  <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-slate-800 rounded-xl">📎</button>
                  <button onClick={handleSaveAndSummarize} disabled={loading} className="w-full sm:w-auto px-10 py-4 bg-white text-slate-950 rounded-xl font-black text-[10px] tracking-widest uppercase">
                    {loading ? 'PROCESSING...' : 'SAVE & ARCHIVE'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="flex flex-col space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-black text-white">Notes</h2>
                    <button onClick={handleUpdateNote} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase">{isUpdating ? '...' : 'Update'}</button>
                </div>
                <textarea className="w-full h-[60vh] bg-slate-900/40 border border-slate-800/80 p-6 rounded-[1.5rem] text-slate-300 text-lg resize-none outline-none" value={editableContent} onChange={(e) => setEditableContent(e.target.value)} />
              </div>
              <div className="flex flex-col space-y-6">
                <h2 className="text-2xl font-black text-slate-400">Insights</h2>
                <div className="bg-indigo-500/5 border border-indigo-500/20 p-8 rounded-[1.5rem]">
                  <p className="text-indigo-50 text-xl italic font-serif leading-relaxed">"{selectedNote?.summary || "No summary available."}"</p>
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