/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';

type ImageDisplayProps = {
  srcUrl?: string;
  prompt?: string;
  caption?: string;
  alt?: string;
  onEdit?: (blob: Blob, key: string) => void;
  editKey?: string;
};

export const ImageDisplay: React.FC<ImageDisplayProps> = ({ srcUrl, prompt, caption, alt, onEdit, editKey }) => {
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (srcUrl) {
      fetch(srcUrl)
        .then(res => {
          if (!res.ok) throw new Error(`Failed to fetch image with status: ${res.status}`);
          return res.blob();
        })
        .then(setImageBlob)
        .catch(err => {
          console.error("Could not fetch online image for download/edit:", err);
        });
    }
  }, [srcUrl]);

  const handleDownload = () => {
    if (!imageBlob || !srcUrl) return;

    const url = URL.createObjectURL(imageBlob);
    const link = document.createElement('a');
    link.href = url;
    
    const finalAlt = alt || prompt || 'generated-image';
    const sanitizedAlt = finalAlt.toLowerCase().replace(/[\s\W]+/g, '-').substring(0, 50);
    const filename = `${sanitizedAlt}.png`;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const handleEdit = () => {
    if (onEdit && imageBlob && editKey) {
        onEdit(imageBlob, editKey);
    }
  };

  const displayAlt = alt || prompt || "AI-generated visual content";
  const displayCaption = caption || alt || prompt;

  return (
    <div className="my-6 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-200/10 shadow-lg bg-white dark:bg-white/5">
      <div className="aspect-square w-full bg-slate-900/50 flex items-center justify-center">
        {srcUrl ? (
          <img
            src={srcUrl}
            alt={displayAlt}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="text-sm text-slate-400 p-4 text-center">
             <span>No image source provided.</span>
          </div>
        )}
      </div>
      <div className="p-4 bg-gray-50 dark:bg-black/20 border-t border-gray-200 dark:border-slate-200/10 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
            {displayCaption && (
              <p className="font-serif italic text-gray-600 dark:text-slate-300 break-words" title={`Full prompt: ${prompt}`}>
                  “{displayCaption}”
              </p>
            )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 mt-1">
            {onEdit && srcUrl && imageBlob && (
                <button
                    onClick={handleEdit}
                    className="p-1.5 rounded-full text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-gray-800 dark:hover:text-slate-100 transition-colors"
                    title="Edit this image"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" /></svg>
                </button>
            )}
            {srcUrl && imageBlob && (
            <button
                onClick={handleDownload}
                className="p-1.5 rounded-full text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-gray-800 dark:hover:text-slate-100 transition-colors"
                title="Download image"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                </svg>
                <span className="sr-only">Download</span>
            </button>
            )}
        </div>
      </div>
    </div>
  );
};