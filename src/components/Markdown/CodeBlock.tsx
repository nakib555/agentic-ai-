
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { useSyntaxTheme } from '../../hooks/useSyntaxTheme';
import { fetchFromApi } from '../../utils/api';
import { AnimatePresence, motion as motionTyped } from 'framer-motion';

const motion = motionTyped as any;

// Comprehensive alias map to handle various LLM outputs
const languageMap: { [key: string]: string } = {
    // JavaScript / TypeScript
    js: 'javascript', javascript: 'javascript', jsx: 'javascript',
    ts: 'typescript', typescript: 'typescript', tsx: 'typescript',
    
    // Python
    py: 'python', python: 'python', python3: 'python',
    
    // Shell
    sh: 'bash', bash: 'bash', shell: 'bash', zsh: 'bash', console: 'bash',
    
    // Web
    html: 'html', xml: 'xml', svg: 'svg', markup: 'html',
    css: 'css', scss: 'scss', sass: 'scss', less: 'less',
    
    // Data Formats
    json: 'json', jsonc: 'json',
    yaml: 'yaml', yml: 'yaml',
    toml: 'toml',
    csv: 'csv',
    
    // Backend / Systems
    java: 'java',
    c: 'c', h: 'c',
    cpp: 'cpp', 'c++': 'cpp', hpp: 'cpp', cc: 'cpp',
    csharp: 'csharp', 'c#': 'csharp', cs: 'csharp', dotnet: 'csharp',
    go: 'go', golang: 'go',
    rust: 'rust', rs: 'rust',
    php: 'php',
    ruby: 'ruby', rb: 'ruby',
    perl: 'perl', pl: 'perl',
    lua: 'lua',
    r: 'r',
    swift: 'swift',
    kotlin: 'kotlin', kt: 'kotlin',
    scala: 'scala',
    groovy: 'groovy',
    dart: 'dart',
    
    // Systems & Config
    dockerfile: 'dockerfile', docker: 'dockerfile',
    makefile: 'makefile', mk: 'makefile',
    cmake: 'cmake',
    nginx: 'nginx',
    apache: 'apacheconf',
    
    // Others
    sql: 'sql', mysql: 'sql', postgres: 'sql', postgresql: 'sql', plsql: 'plsql',
    md: 'markdown', markdown: 'markdown',
    latex: 'latex', tex: 'latex',
    matlab: 'matlab',
    powershell: 'powershell', ps1: 'powershell',
    batch: 'batch', bat: 'batch', cmd: 'batch',
    diff: 'diff',
    vim: 'vim',
    git: 'git',
    graphql: 'graphql',
    solidity: 'solidity', sol: 'solidity',
    
    // Fallbacks
    text: 'text', plaintext: 'text', txt: 'text', raw: 'text'
};

// Languages that support text-based execution via Piston
const RUNNABLE_LANGUAGES = new Set([
    'python', 'javascript', 'typescript', 'go', 'rust', 'c', 'cpp', 'java', 'bash', 'ruby', 'php', 'swift', 'perl', 'lua',
    'awk', 'brainfuck', 'csharp', 'cobol', 'crystal', 'dart', 'elixir', 'emacs', 'erlang', 'fortran', 'golfscript', 'groovy', 
    'haskell', 'julia', 'kotlin', 'lisp', 'nasm', 'nim', 'ocaml', 'octave', 'pascal', 'powershell', 'r', 'scala', 'zig'
]);

type CodeBlockProps = {
    language?: string;
    children: React.ReactNode;
    isStreaming: boolean;
    onRunCode?: (language: string, code: string) => void;
    isDisabled?: boolean;
};

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, children, isStreaming, onRunCode, isDisabled }) => {
    const [isCopied, setIsCopied] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [runOutput, setRunOutput] = useState<string | null>(null);
    const [showOutput, setShowOutput] = useState(false);
    
    const syntaxStyle = useSyntaxTheme();

    const codeContent = String(children).replace(/\n$/, '');

    const handleCopy = () => {
        if (!codeContent) return;
        navigator.clipboard.writeText(codeContent).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }).catch(err => console.error('Failed to copy code: ', err));
    };
    
    // Normalize language
    const { highlighterLang, displayLang } = useMemo(() => {
        const raw = (language || 'text').toLowerCase().trim();
        const mapped = languageMap[raw] || raw;
        
        // Formatted name for display
        let display = raw;
        if (language) {
             if (['html', 'css', 'json', 'xml', 'sql', 'php'].includes(raw)) display = raw.toUpperCase();
             else display = raw.charAt(0).toUpperCase() + raw.slice(1);
        }

        return { highlighterLang: mapped, displayLang: display };
    }, [language]);


    const handleOpenArtifact = () => {
        window.dispatchEvent(new CustomEvent('open-artifact', { 
            detail: { code: codeContent, language: highlighterLang } 
        }));
    };

    const isRunnable = RUNNABLE_LANGUAGES.has(highlighterLang);

    const handleRun = async () => {
        if (isRunning) return;
        
        setIsRunning(true);
        setShowOutput(true);
        setRunOutput(null);

        try {
            const response = await fetchFromApi('/api/handler?task=run_piston', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ language: highlighterLang, code: codeContent }),
            });
            
            if (response.ok) {
                const data = await response.json();
                setRunOutput(data.result);
            } else {
                const errorData = await response.json().catch(() => ({}));
                setRunOutput(`Error: ${errorData.error || response.statusText}`);
            }
        } catch (error: any) {
            setRunOutput(`Execution Failed: ${error.message}`);
        } finally {
            setIsRunning(false);
        }
    };

    return (
      <div className="my-6 rounded-lg shadow-sm font-sans group bg-code-surface transition-colors duration-300 border border-border-subtle relative overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 flex justify-between items-center px-4 py-2 bg-layer-2/80 border-b border-border-subtle select-none backdrop-blur-md">
          <div className="flex items-center gap-3">
             <span className="text-xs font-semibold text-content-tertiary font-mono">
                {displayLang}
             </span>
          </div>
          
          <div className="flex items-center gap-2">
            {!isStreaming && isRunnable && (
                 <button
                    onClick={handleRun}
                    disabled={isRunning}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all ${
                        isRunning 
                        ? 'text-slate-400 bg-slate-100 dark:bg-white/5' 
                        : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                    }`}
                    title="Run Code"
                >
                    {isRunning ? (
                         <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" /></svg>
                    )}
                    Run
                </button>
            )}

            <button
                onClick={handleOpenArtifact}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-primary-main hover:bg-primary-subtle transition-all"
                title="Open in Side Panel"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M15.28 9.47a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 1 1-1.06-1.06L13.69 10 9.97 6.28a.75.75 0 0 1 1.06-1.06l4.25 4.25ZM6.03 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.69 10 5.97 6.28a.75.75 0 0 1 .06-1.06Z" clipRule="evenodd" /></svg>
                Open
            </button>

            <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-content-secondary hover:text-content-primary hover:bg-layer-3 transition-all"
                aria-label="Copy code"
            >
                {isCopied ? (
                    <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-status-success-text"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        <span className="text-status-success-text">Copied</span>
                    </>
                ) : (
                    <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        <span>Copy</span>
                    </>
                )}
            </button>
          </div>
        </div>
        
        {/* Editor Body */}
        <div className="relative overflow-x-auto text-[13px] leading-6 custom-scrollbar bg-code-surface">
            <SyntaxHighlighter
                language={highlighterLang}
                style={syntaxStyle}
                customStyle={{ 
                    margin: 0, 
                    padding: '1.5rem', 
                    fontSize: '13px', 
                    lineHeight: '1.5',
                    fontFamily: "'Fira Code', monospace",
                    background: 'transparent',
                }}
                showLineNumbers={false}
                wrapLines={false}
                fallbackLanguage="text"
            >
                {codeContent}
            </SyntaxHighlighter>
        </div>

        {/* Execution Output Panel */}
        <AnimatePresence>
            {showOutput && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="border-t border-border-subtle bg-[#0d0d0d] dark:bg-black/40 overflow-hidden rounded-b-lg relative"
                >
                    {/* Terminal Status Bar */}
                    <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5 select-none">
                        <div className="flex items-center gap-3">
                             <div className="flex gap-1.5">
                                <div className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-yellow-500 animate-pulse' : (runOutput?.includes('Error') || runOutput?.includes('Execution errors') ? 'bg-red-500' : 'bg-green-500')}`}></div>
                             </div>
                             <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                Terminal
                                {isRunning && <span className="text-slate-500 font-normal normal-case tracking-normal">— Running...</span>}
                             </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setShowOutput(false)} 
                                className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-md hover:bg-white/10"
                                title="Close Output"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                            </button>
                        </div>
                    </div>
                    
                    {/* Terminal Body */}
                    <div className="p-4 font-mono text-xs sm:text-sm text-slate-300 whitespace-pre-wrap break-all max-h-80 overflow-y-auto custom-scrollbar shadow-inner bg-[#0d0d0d] relative">
                        {isRunning ? (
                            <div className="flex items-center gap-2 text-slate-500 italic">
                                <span className="w-2 h-4 bg-slate-500 animate-pulse inline-block align-middle"></span>
                                <span>Executing script...</span>
                            </div>
                        ) : (
                            runOutput ? (
                                <div className="leading-relaxed">
                                    <span className="text-green-500/50 select-none mr-2">$</span>
                                    {runOutput}
                                    <span className="ml-1 w-2 h-4 bg-slate-500/50 inline-block align-middle animate-pulse"></span>
                                </div>
                            ) : (
                                <span className="text-slate-600 italic">No output returned.</span>
                            )
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
      </div>
    );
};
