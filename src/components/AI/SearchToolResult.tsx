
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion as motionTyped } from 'framer-motion';

const motion = motionTyped as any;

type Source = {
  uri: string;
  title: string;
};

type SearchToolResultProps = {
  query: string;
  sources?: Source[];
};

const LoadingSpinner = () => (
    <svg className="animate-spin h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


const SourcePill: React.FC<{ source: Source }> = ({ source }) => {
  let domain: string | null = null;
  try {
    domain = new URL(source.uri).hostname.replace('www.', '');
  } catch (error) {
    console.warn(`Invalid source URI: "${source.uri}"`);
  }

  return (
    <motion.a
      href={source.uri}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-2.5 py-1 bg-white dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-700/50 rounded-full text-xs font-medium text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700/80 transition-colors"
      title={source.title}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {domain && <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
        alt=""
        className="w-3.5 h-3.5 flex-shrink-0"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />}
      <span className="truncate max-w-48">{source.title}</span>
    </motion.a>
  );
};

export const SearchToolResult = ({ query, sources }: SearchToolResultProps) => {
  const [showAll, setShowAll] = useState(false);
  const isLoading = sources === undefined;

  const visibleSources = showAll ? sources : sources?.slice(0, 3);
  const hiddenCount = sources ? sources.length - (visibleSources?.length ?? 0) : 0;

  return (
    <div className="space-y-3">
      {query && (
        <p className="text-sm font-medium text-gray-600 dark:text-slate-400 font-['Fira_Code',_monospace]">
          "{query}"
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
            <LoadingSpinner />
            <span>Searching...</span>
        </div>
      ) : (
        <>
            {sources && sources.length > 0 ? (
                <div className="flex flex-wrap gap-2 items-center">
                    {visibleSources?.map((source, index) => (
                    <SourcePill key={index} source={source} />
                    ))}
                    {hiddenCount > 0 && !showAll && (
                    <button
                        onClick={() => setShowAll(true)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 px-2 py-1 transition-colors"
                        aria-expanded={showAll}
                        aria-label={`Show ${hiddenCount} more sources`}
                    >
                        + {hiddenCount} more
                    </button>
                    )}
                </div>
            ) : (
                <div className="text-sm text-slate-400">
                    No sources found.
                </div>
            )}
        </>
      )}
    </div>
  );
};
