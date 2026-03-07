/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Skeleton } from './Skeleton';

export const AppSkeleton = () => {
  return (
    <div className="flex h-full w-full bg-page overflow-hidden animate-in fade-in duration-500">
      {/* Sidebar Ghost (Desktop) */}
      <div className="hidden md:flex w-[272px] flex-col border-r border-border bg-layer-1 p-3 gap-6 flex-shrink-0 z-20">
        {/* Header */}
        <div className="flex items-center gap-3 px-2 mt-2">
            <Skeleton className="w-8 h-8 rounded-xl" />
            <Skeleton className="h-6 w-24 rounded-md" />
        </div>
        
        {/* Search & New Chat */}
        <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
        </div>

        <div className="h-px w-full bg-border" />

        {/* History List */}
        <div className="flex-1 space-y-4 pt-2">
            <div className="space-y-2">
                <Skeleton className="h-3 w-12 rounded ml-2" /> {/* Section Title */}
                <Skeleton className="h-9 w-full rounded-lg" />
                <Skeleton className="h-9 w-full rounded-lg" />
                <Skeleton className="h-9 w-full rounded-lg" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-3 w-16 rounded ml-2" />
                <Skeleton className="h-9 w-full rounded-lg" />
                <Skeleton className="h-9 w-full rounded-lg" />
            </div>
        </div>

        {/* Footer */}
        <div className="mt-auto border-t border-border pt-4">
            <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>

      {/* Main Content Ghost */}
      <div className="flex-1 flex flex-col min-w-0 bg-page relative z-10">
        {/* Chat Header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-6 flex-shrink-0 bg-page/90">
           <Skeleton className="h-8 w-48 rounded-full" />
           <Skeleton className="h-10 w-10 rounded-full" />
        </div>

        {/* Chat Area */}
        <div className="flex-1 p-4 sm:p-8 flex flex-col justify-end space-y-8 pb-4 overflow-hidden">
           {/* AI Message Ghost */}
           <div className="flex flex-col gap-3 max-w-3xl w-full">
              <div className="flex items-center gap-3">
                 <Skeleton className="w-8 h-8 rounded-lg" />
                 <Skeleton className="h-4 w-32 rounded" />
              </div>
              <div className="space-y-2 pl-11">
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-[90%] rounded" />
                  <Skeleton className="h-4 w-[95%] rounded" />
                  <div className="flex gap-2 mt-4">
                      <Skeleton className="h-8 w-24 rounded-lg" />
                      <Skeleton className="h-8 w-24 rounded-lg" />
                  </div>
              </div>
           </div>

           {/* User Message Ghost */}
           <div className="flex justify-end w-full">
              <div className="flex flex-col items-end gap-2 max-w-2xl w-full">
                  <Skeleton className="h-20 w-3/4 rounded-2xl rounded-tr-sm" />
              </div>
           </div>
        </div>

        {/* Input Area Ghost */}
        <div className="p-4 sm:px-8 pb-6 flex-shrink-0">
           <div className="h-16 w-full max-w-4xl mx-auto bg-layer-2 border border-border rounded-xl flex items-center px-4 justify-between relative overflow-hidden">
                <Skeleton className="absolute inset-0 opacity-50" />
           </div>
           <Skeleton className="h-3 w-48 mx-auto mt-3 rounded" />
        </div>
      </div>
    </div>
  );
};