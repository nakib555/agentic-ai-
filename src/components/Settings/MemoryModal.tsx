
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion as motionTyped } from 'framer-motion';
import { Virtuoso } from 'react-virtuoso';
import JSZip from 'jszip';
import type { MemoryFile } from '../../hooks/useMemory';
import { TabButton } from '../UI/TabButton';

const motion = motionTyped as any;

type MemoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  memoryFiles: MemoryFile[];
  onUpdateMemoryFiles: (files: MemoryFile[]) => Promise<void>;
  memoryContent: string;
  onUpdateMemoryContent: (content: string) => Promise<void>;
};

// --- Optimized Beautiful Icons ---

const Icons = {
    Back: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="m15 18-6-6 6-6"/></svg>,
    Save: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
    Close: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M18 6 6 18"/><path d="m6 6 18 18"/></svg>,
    Search: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
    Plus: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M5 12h14"/><path d="M12 5v14"/></svg>,
    FileText: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>,
    Clock: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    Edit: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>,
    Trash: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>,
    Download: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    MemoryChip: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h.01"/><path d="M7 12h.01"/><path d="M7 17h.01"/><path d="M12 7h.01"/><path d="M12 12h.01"/><path d="M12 17h.01"/><path d="M17 7h.01"/><path d="M17 12h.01"/><path d="M17 17h.01"/></svg>,
    Spinner: () => <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>,
    Export: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
    Brain: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>
};

// --- Sub-Components ---

const FileEditor: React.FC<{
    file: MemoryFile | null;
    onSave: (file: MemoryFile) => void;
    onCancel: () => void;
}> = ({ file, onSave, onCancel }) => {
    const [title, setTitle] = useState(file?.title || '');
    const [content, setContent] = useState(file?.content || '');

    // Sync state when file prop changes (e.g. after first save of 'new' file)
    useEffect(() => {
        if (file) {
            setTitle(file.title);
            setContent(file.content);
        }
    }, [file]);

    const handleSave = () => {
        if (!title.trim()) return alert('Title is required');
        onSave({
            id: file?.id || crypto.randomUUID(),
            title,
            content,
            lastUpdated: Date.now()
        });
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-[#09090b] overflow-hidden">
            {/* Editor Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-white/5 flex justify-between items-center bg-white dark:bg-[#121212] z-10 flex-shrink-0">
                 <button onClick={onCancel} className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
                    <Icons.Back />
                    Back
                </button>
                <div className="flex flex-col items-center">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm tracking-wide">{file ? 'EDIT MEMORY' : 'NEW MEMORY'}</h3>
                </div>
                <button 
                    onClick={handleSave} 
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                >
                    <Icons.Save />
                    <span>Save</span>
                </button>
            </div>

            {/* Editor Input Area */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 max-w-4xl mx-auto w-full custom-scrollbar">
                <div className="space-y-2 flex-shrink-0">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 ml-1">Title</label>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="E.g., Project Phoenix Specs"
                        className="w-full px-4 py-3 bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-xl text-lg font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700 shadow-sm"
                        autoFocus
                    />
                </div>
                <div className="flex-1 flex flex-col space-y-2 min-h-[300px]">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 ml-1">Content</label>
                    <div className="flex-1 relative rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 transition-all bg-white dark:bg-[#121212]">
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="Enter detailed memory content here..."
                            className="w-full h-full p-4 bg-transparent border-none resize-none focus:outline-none font-mono text-sm leading-relaxed text-slate-700 dark:text-slate-300 custom-scrollbar placeholder:text-slate-300 dark:placeholder:text-slate-700"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

const CoreMemoryEditor: React.FC<{
    content: string;
    onSave: (content: string) => Promise<void>;
    onClear: () => Promise<void>;
}> = ({ content, onSave, onClear }) => {
    const [value, setValue] = useState(content);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        setValue(content);
        setHasChanges(false);
    }, [content]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(value);
            setHasChanges(false);
        } catch (e) {
            alert('Failed to save Core Memory.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setValue(e.target.value);
        setHasChanges(e.target.value !== content);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-[#09090b] overflow-hidden">
             <div className="p-6 pb-2 text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-[#121212] border-b border-slate-200 dark:border-white/5">
                <p>
                    <strong>Core Context</strong> is a single block of text always available to the AI.
                    Use this for critical facts, preferences, or project details that should never be forgotten.
                </p>
            </div>
            
            <div className="flex-1 p-6 overflow-hidden flex flex-col">
                <div className="flex-1 relative rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 transition-all bg-white dark:bg-[#121212]">
                    <textarea
                        value={value}
                        onChange={handleChange}
                        placeholder="E.g., I am a software engineer living in Seattle. I prefer concise answers..."
                        className="w-full h-full p-4 bg-transparent border-none resize-none focus:outline-none font-mono text-sm leading-relaxed text-slate-700 dark:text-slate-300 custom-scrollbar placeholder:text-slate-300 dark:placeholder:text-slate-700"
                    />
                </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-[#121212] flex items-center justify-between gap-3 flex-shrink-0">
                <button
                    onClick={() => {
                        if (confirm("Clear core memory? This cannot be undone.")) {
                            onClear();
                            setValue('');
                            setHasChanges(false);
                        }
                    }}
                    disabled={!value}
                    className="px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 rounded-xl transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-500/30 disabled:opacity-50"
                >
                    Clear Memory
                </button>

                <button 
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving}
                    className={`
                        px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm
                        ${!hasChanges || isSaving 
                            ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed text-slate-500 dark:text-slate-500 shadow-none' 
                            : 'bg-indigo-600 hover:bg-indigo-500 hover:shadow-indigo-500/25 hover:-translate-y-0.5 active:translate-y-0'
                        }
                    `}
                >
                    {isSaving ? (
                        <>
                            <Icons.Spinner />
                            <span>Saving...</span>
                        </>
                    ) : (
                        <>
                            {hasChanges && <Icons.Save />}
                            <span>{hasChanges ? 'Save Changes' : 'Saved'}</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export const MemoryModal: React.FC<MemoryModalProps> = ({ isOpen, onClose, memoryFiles, onUpdateMemoryFiles, memoryContent, onUpdateMemoryContent }) => {
  const [localFiles, setLocalFiles] = useState<MemoryFile[]>(memoryFiles);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editingFile, setEditingFile] = useState<MemoryFile | null | 'new'>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'files' | 'core'>('files');

  const exportMenuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
              setIsExportMenuOpen(false);
          }
      };
      if (isExportMenuOpen) {
          document.addEventListener('mousedown', handleClickOutside);
      }
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExportMenuOpen]);

  // Sync memory files prop to local state
  useEffect(() => {
      setLocalFiles(memoryFiles);
  }, [memoryFiles]);

  const filteredFiles = useMemo(() => {
      if (!searchQuery) return localFiles;
      return localFiles.filter(f => f.title.toLowerCase().includes(searchQuery.toLowerCase()) || f.content.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [localFiles, searchQuery]);

  // --- Operations ---

  const handleSaveFiles = async () => {
      setIsSaving(true);
      try {
          await onUpdateMemoryFiles(localFiles);
          setHasUnsavedChanges(false);
      } catch (error) {
          alert("Failed to save memory files. Please try again.");
      } finally {
          setIsSaving(false);
      }
  };

  const handleFileSave = (file: MemoryFile) => {
      setLocalFiles(prev => {
          const exists = prev.find(f => f.id === file.id);
          if (exists) {
              return prev.map(f => f.id === file.id ? file : f);
          }
          return [...prev, file];
      });
      setHasUnsavedChanges(true);
      setEditingFile(file);
  };

  const handleFileDelete = (id: string) => {
      if (confirm("Delete this memory file?")) {
          setLocalFiles(prev => prev.filter(f => f.id !== id));
          setHasUnsavedChanges(true);
      }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const sanitizeFilename = (name: string) => {
      return name.replace(/[^a-z0-9_\-]/gi, '_');
  };

  const handleExportJSON = () => {
      setIsExporting(true);
      setIsExportMenuOpen(false);
      setTimeout(() => {
          try {
            const exportData = { 
                core: memoryContent,
                files: localFiles 
            };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            downloadBlob(blob, `memory-export-${new Date().toISOString().slice(0, 10)}.json`);
          } catch (e) {
            console.error("JSON Export failed", e);
            alert("Failed to export JSON");
          } finally {
            setIsExporting(false);
          }
      }, 50);
  };

  const handleExportText = () => {
      if (localFiles.length === 0 && !memoryContent) return;
      setIsExportMenuOpen(false);
      setIsExporting(true);
      setTimeout(async () => {
          try {
            const zip = new JSZip();
            
            if (memoryContent) {
                zip.file('CORE_MEMORY.txt', memoryContent);
            }
            
            localFiles.forEach(file => {
                zip.file(`files/${sanitizeFilename(file.title)}.txt`, file.content);
            });
            
            const content = await zip.generateAsync({ 
                type: "blob",
                compression: "DEFLATE",
                compressionOptions: { level: 5 }
            });
            downloadBlob(content, `memory-bank-${new Date().toISOString().slice(0, 10)}.zip`);
          } catch (error) {
            console.error("Export failed:", error);
            alert("Failed to export files.");
          } finally {
            setIsExporting(false);
          }
      }, 100);
  };

  // We use createPortal to ensure the Memory Modal is always on top of the Settings Dialog
  // and isolated from any focus traps or stacking context issues.
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-none md:backdrop-blur-sm z-[80] flex items-center justify-center p-4 sm:p-6 overflow-hidden pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="memory-modal-title"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="bg-slate-50 dark:bg-[#09090b] w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden"
          >
            {editingFile ? (
                <FileEditor 
                    file={editingFile === 'new' ? null : editingFile} 
                    onSave={handleFileSave} 
                    onCancel={() => setEditingFile(null)} 
                />
            ) : (
            <>
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-[#121212] z-10 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
                            <Icons.MemoryChip />
                        </div>
                        <div>
                            <h2 id="memory-modal-title" className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Memory Bank</h2>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                Manage persistent knowledge
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        aria-label="Close"
                    >
                        <Icons.Close />
                    </button>
                </div>
                
                {/* Tab Bar */}
                <div className="px-6 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-[#121212] flex gap-4">
                    <TabButton label="Named Files" isActive={activeTab === 'files'} onClick={() => setActiveTab('files')} />
                    <TabButton label="Core Context" isActive={activeTab === 'core'} onClick={() => setActiveTab('core')} />
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-slate-50/50 dark:bg-black/10">
                    
                    {activeTab === 'core' ? (
                        <CoreMemoryEditor 
                            content={memoryContent} 
                            onSave={onUpdateMemoryContent} 
                            onClear={() => onUpdateMemoryContent('')} 
                        />
                    ) : (
                        <>
                        {/* Files Toolbar */}
                        <div className="px-6 py-4 flex flex-col sm:flex-row items-center gap-4 flex-shrink-0">
                            <div className="relative flex-1 w-full group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                    <Icons.Search />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search memory files..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-sm placeholder:text-slate-400"
                                />
                            </div>
                            <button 
                                onClick={() => setEditingFile('new')}
                                className="flex-shrink-0 w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 flex items-center justify-center gap-2 active:scale-95"
                            >
                                <Icons.Plus />
                                <span>New File</span>
                            </button>
                        </div>

                        {/* Scrollable List with Virtuoso */}
                        <div className="flex-1 overflow-hidden px-6 pb-6 custom-scrollbar">
                            {filteredFiles.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
                                    <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4 text-slate-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    </div>
                                    <p className="text-slate-600 dark:text-slate-400 font-medium">No files found.</p>
                                    <p className="text-slate-500 dark:text-slate-500 text-sm mt-1">Create a new memory file to get started.</p>
                                </div>
                            ) : (
                                <Virtuoso
                                    style={{ height: '100%', width: '100%' }}
                                    data={filteredFiles}
                                    className="custom-scrollbar"
                                    itemContent={(index, file) => (
                                        <div className="pb-3 px-1">
                                            <div 
                                                onClick={() => setEditingFile(file)}
                                                className="group cursor-pointer relative flex items-start gap-4 p-4 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-md transition-all duration-200"
                                            >
                                                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform duration-300">
                                                     <Icons.FileText />
                                                </div>
                                                <div className="flex-1 min-w-0 py-0.5">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 truncate pr-20">{file.title}</h4>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-1 font-mono opacity-80">{file.content.substring(0, 100) || "Empty file..."}</p>
                                                    <div className="flex items-center gap-4 mt-3">
                                                        <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
                                                            <Icons.Clock />
                                                            {new Date(file.lastUpdated).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setEditingFile(file); }}
                                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Icons.Edit />
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleFileDelete(file.id); }}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Icons.Trash />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                />
                            )}
                        </div>
                        </>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-[#121212] flex flex-col-reverse sm:flex-row items-center justify-between gap-3 z-10 flex-shrink-0">
                    <div className="flex gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-initial" ref={exportMenuRef}>
                            <button
                                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                                disabled={isExporting || (localFiles.length === 0 && !memoryContent)}
                                className={`w-full sm:w-auto justify-center px-4 py-2.5 flex items-center gap-2 text-xs font-semibold rounded-xl transition-all border ${isExportMenuOpen ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30' : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10'}`}
                            >
                                {isExporting ? <Icons.Spinner /> : <Icons.Export />}
                                {isExporting ? 'Exporting...' : 'Export All'}
                            </button>
                            <AnimatePresence>
                                {isExportMenuOpen && !isExporting && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        transition={{ duration: 0.1 }}
                                        className="absolute bottom-full left-0 mb-2 w-full sm:w-48 bg-white dark:bg-[#1e1e1e] rounded-xl shadow-xl border border-gray-200 dark:border-white/10 p-1.5 z-50 overflow-hidden"
                                    >
                                        <button onClick={handleExportJSON} className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10 transition-colors">
                                            <span className="p-1 bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 rounded-md font-mono text-[10px]">{}</span>
                                            Export as JSON
                                        </button>
                                        <button onClick={handleExportText} className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10 transition-colors">
                                            <span className="p-1 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-md font-mono text-[10px]">ZIP</span>
                                            Export as Archive
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        
                        {activeTab === 'files' && (
                            <button
                                onClick={() => {
                                    if (confirm("Are you sure you want to clear all memory files? This cannot be undone.")) {
                                        setLocalFiles([]);
                                        setHasUnsavedChanges(true);
                                    }
                                }}
                                disabled={localFiles.length === 0}
                                className="flex-1 sm:flex-initial justify-center px-4 py-2.5 flex items-center gap-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 rounded-xl transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-500/30 disabled:opacity-50"
                            >
                                <Icons.Trash />
                                Clear Files
                            </button>
                        )}
                    </div>
                    
                    <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                        <button 
                            onClick={onClose}
                            disabled={isSaving}
                            className="flex-1 sm:flex-initial px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50"
                        >
                            Close
                        </button>
                        {activeTab === 'files' && (
                            <button 
                                onClick={handleSaveFiles}
                                disabled={!hasUnsavedChanges || isSaving}
                                className={`
                                    flex-1 sm:flex-initial px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm
                                    ${!hasUnsavedChanges || isSaving 
                                        ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed text-slate-500 dark:text-slate-500 shadow-none' 
                                        : 'bg-indigo-600 hover:bg-indigo-500 hover:shadow-indigo-500/25 hover:-translate-y-0.5 active:translate-y-0'
                                    }
                                `}
                            >
                                {isSaving ? (
                                    <>
                                        <Icons.Spinner />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        {hasUnsavedChanges && <Icons.Save />}
                                        <span>{hasUnsavedChanges ? 'Save Changes' : 'Saved'}</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
