/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { Source } from '../../types';
import { Favicon } from '../UI/Favicon';

type SourcesPillsProps = {
  sources: Source[];
  onShowSources: () => void;
};

const PillContent: React.FC<{ source: Source, index: number }> = ({ source, index }) => {
    let domain: string | null = null;
    try {
        domain = new URL(source.uri).hostname;
    } catch (error) {
        console.warn(`Invalid source URI encountered: "${source.uri}"`);
    }

    return (
        <Favicon
            domain={domain || source.uri}
            className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-700 bg-white dark:bg-gray-800"
            style={{ zIndex: 3 - index }}
        />
    );
};


export const SourcesPills: React.FC<SourcesPillsProps> = ({ sources, onShowSources }) => {
  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <button 
        onClick={onShowSources}
        className="flex items-center gap-2 rounded-full px-3 py-1.5 bg-gray-100 dark:bg-black/20 hover:bg-gray-200 dark:hover:bg-black/40 transition-colors"
        title="View sources"
        aria-label="View sources"
    >
        <div className="flex -space-x-2">
            {sources.slice(0, 3).map((source, index) => (
                <PillContent key={source.uri + index} source={source} index={index} />
            ))}
        </div>
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Sources</span>
    </button>
  );
};