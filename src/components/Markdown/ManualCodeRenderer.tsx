
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { getMarkdownComponents } from './markdownComponents';
import 'katex/dist/katex.min.css';

type ManualCodeRendererProps = {
  text: string;
  components: any;
  isStreaming: boolean;
  onRunCode?: (language: string, code: string) => void;
  isRunDisabled?: boolean;
  onFixCode?: (code: string) => Promise<string | undefined>;
};

// Robust function to protect code blocks AND math from highlight replacement.
const processHighlights = (content: string): string => {
    if (!content) return '';
    
    // Split content by code blocks, inline code, display math, and inline math to protect them
    // Note: the regex `\$[^$\n]+\$` captures valid inline math (single line).
    // Using new RegExp to avoid parser issues with backticks in regex literals
    const pattern = new RegExp("(`{3}[\\s\\S]*?`{3}|`[^`]+`|\\$\\$[\\s\\S]*?\\$\\$|\\$[^$\\n]+\\$)", "g");
    const parts = content.split(pattern);
    
    return parts.map(part => {
        if (!part) return '';
        // If this part is a code block or math, return it untouched
        if (part.startsWith('`') || part.startsWith('$')) return part;
        
        let processed = part;

        // 1. Transform Custom Collapsible Syntax:
        // :::details Title
        // Content
        // :::
        // Regex looks for :::details [Title] (newline) [Content] (newline) :::
        // Uses [\s\S]*? for non-greedy multiline matching of content.
        // Updated regex to handle loose spacing and newlines more robustly
        processed = processed.replace(
            /:::details\s+([^\n]+)\n([\s\S]*?)\n:::/g, 
            '<details><summary>$1</summary>\n\n$2\n</details>'
        );

        // 2. Apply text transformations to regular text segments
        return processed
            // Match specific color syntax: ==[color] text==
            // Supports named colors, hex, rgb, rgba, hsl, lch, etc.
            .replace(/==\[([^\]]+)\](.*?)==/g, '<mark>[$1]$2</mark>')
            // Match standard highlight: ==text==
            .replace(/==(.*?)==/g, '<mark>$1</mark>')
            // Escape currency symbols ($ followed by digit) to prevent KaTeX from mistaking them for open math tags
            // This prevents "stuck" rendering when the model writes "$100" without a closing $.
            .replace(/\$(\d)/g, '\\$$$1');
    }).join('');
};

const ManualCodeRendererRaw: React.FC<ManualCodeRendererProps> = ({ text, onRunCode, isRunDisabled, isStreaming, onFixCode }) => {
    const processedText = useMemo(() => processHighlights(text), [text]);
    
    // We memoize the components object to prevent unnecessary re-renders of ReactMarkdown
    // created by getMarkdownComponents if the props haven't changed.
    const customComponents = useMemo(() => {
        return getMarkdownComponents({ onRunCode, isRunDisabled, isStreaming, onFixCode });
    }, [onRunCode, isRunDisabled, isStreaming, onFixCode]);

    return (
        <ReactMarkdown
            remarkPlugins={[remarkMath, remarkGfm]}
            rehypePlugins={[rehypeKatex, rehypeRaw]}
            components={customComponents}
        >
            {processedText}
        </ReactMarkdown>
    );
};

export const ManualCodeRenderer = memo(ManualCodeRendererRaw);
