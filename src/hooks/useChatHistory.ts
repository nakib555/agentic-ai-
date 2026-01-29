
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChatSession, Message, ModelResponse } from '../types';
import { fetchFromApi } from '../utils/api';

const fetchApi = async (url: string, options?: RequestInit & { keepalive?: boolean }) => {
    let finalUrl = url;
    if (!options || options.method === 'GET' || !options.method) {
        const separator = finalUrl.includes('?') ? '&' : '?';
        finalUrl = `${finalUrl}${separator}_t=${Date.now()}`;
    }

    const response = await fetchFromApi(finalUrl, options);
    
    if (!response.ok) {
        if (response.status === 404) return null; // Handle 404 gracefully
        throw new Error(`API Request failed: ${response.status}`);
    }
    
    if (response.status === 204) return null;
    return response.json();
};

export const useChatHistory = () => {
  const queryClient = useQueryClient();
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  
  // Use React Query for the history list
  const { data: chatHistory = [], isLoading: isHistoryLoading } = useQuery<ChatSession[]>({
      queryKey: ['chatHistory'],
      queryFn: () => fetchApi('/api/history').then(res => res || []),
      staleTime: 1000 * 60, // 1 minute stale time for list
  });

  // Local state for the active chat to allow immediate updates during streaming
  // We sync this with React Query cache where possible
  const [activeChat, setActiveChat] = useState<ChatSession | null>(null);

  useEffect(() => {
      if (currentChatId) {
          // Try to get from cache first
          const cachedHistory = queryClient.getQueryData<ChatSession[]>(['chatHistory']);
          const cachedChat = cachedHistory?.find(c => c.id === currentChatId);
          
          if (cachedChat && cachedChat.messages) {
              setActiveChat(cachedChat);
          } else {
              // Fetch full chat if messages are missing (history list only has metadata)
              fetchApi(`/api/chats/${currentChatId}`).then(fullChat => {
                  if (fullChat) {
                      setActiveChat(fullChat);
                      // Update cache with full data
                      queryClient.setQueryData<ChatSession[]>(['chatHistory'], (old: ChatSession[] | undefined) => {
                          return (old || []).map(c => c.id === currentChatId ? fullChat : c);
                      });
                  }
              });
          }
      } else {
          setActiveChat(null);
      }
  }, [currentChatId, queryClient]);

  // Helper to update local state and RQ cache simultaneously
  const updateLocalAndCache = useCallback((updater: (prevHistory: ChatSession[]) => ChatSession[]) => {
      queryClient.setQueryData<ChatSession[]>(['chatHistory'], (old: ChatSession[] | undefined) => updater(old || []));
  }, [queryClient]);

  const startNewChat = useCallback(async (model: string, settings: any, optimisticId?: string): Promise<ChatSession | null> => {
    const newId = optimisticId || Math.random().toString(36).substring(2, 9);
    const newChat: ChatSession = {
        id: newId,
        title: "New Chat",
        messages: [],
        model: model,
        isLoading: false,
        createdAt: Date.now(),
        ...settings
    };

    setCurrentChatId(newId);
    setActiveChat(newChat);
    updateLocalAndCache(old => [newChat, ...(old || [])]);

    try {
        await fetchApi('/api/chats/new', {
            method: 'POST',
            body: JSON.stringify({ id: newId, model, ...settings }),
        });
        return newChat;
    } catch (error) {
        console.error("Failed to persist new chat:", error);
        return null;
    }
  }, [updateLocalAndCache]);

  const loadChat = useCallback((chatId: string) => { 
      setCurrentChatId(chatId); 
  }, []);
  
  const deleteChat = useCallback(async (chatId: string) => {
    if (currentChatId === chatId) setCurrentChatId(null);
    updateLocalAndCache(old => (old || []).filter(c => c.id !== chatId));

    try {
        await fetchApi(`/api/chats/${chatId}`, { method: 'DELETE' });
    } catch (error) {
        console.error("Failed to delete chat", error);
        // Could revert here if needed
        queryClient.invalidateQueries({ queryKey: ['chatHistory'] });
    }
  }, [currentChatId, updateLocalAndCache, queryClient]);

  const clearAllChats = useCallback(async () => {
    setCurrentChatId(null);
    updateLocalAndCache(() => []);
    try {
        await fetchApi('/api/history', { method: 'DELETE' });
    } catch (error) {
        console.error("Failed to clear history", error);
        queryClient.invalidateQueries({ queryKey: ['chatHistory'] });
    }
  }, [updateLocalAndCache, queryClient]);

  const importChat = useCallback(async (importedData: any) => {
    try {
        const response = await fetchApi('/api/import', {
            method: 'POST',
            body: JSON.stringify(importedData),
        });
        
        const newChats = Array.isArray(response) ? response : [response];
        if (newChats.length > 0) {
            updateLocalAndCache(old => [...newChats, ...(old || [])]);
            setCurrentChatId(newChats[0].id);
        }
    } catch (error) {
        console.error("Import failed:", error);
    }
  }, [updateLocalAndCache]);
  
  // Real-time message updates (Streaming)
  // We modify the RQ cache directly for performance during generation
  const updateChatMessages = useCallback((chatId: string, messages: Message[]) => {
      updateLocalAndCache(old => (old || []).map(c => 
          c.id === chatId ? { ...c, messages } : c
      ));
      if (currentChatId === chatId) {
          setActiveChat(prev => prev ? { ...prev, messages } : null);
      }
  }, [updateLocalAndCache, currentChatId]);

  // Specific helpers to avoid full list traversals in UI components
  const addMessagesToChat = useCallback((chatId: string, newMessages: Message[]) => {
      const chat = queryClient.getQueryData<ChatSession[]>(['chatHistory'])?.find(c => c.id === chatId);
      if (chat) {
          const updatedMessages = [...(chat.messages || []), ...newMessages];
          updateChatMessages(chatId, updatedMessages);
      }
  }, [queryClient, updateChatMessages]);

  const updateMessage = useCallback((chatId: string, messageId: string, update: Partial<Message>) => {
      const chat = queryClient.getQueryData<ChatSession[]>(['chatHistory'])?.find(c => c.id === chatId);
      if (chat && chat.messages) {
          const updatedMessages = chat.messages.map(m => m.id === messageId ? { ...m, ...update } : m);
          updateChatMessages(chatId, updatedMessages);
      }
  }, [queryClient, updateChatMessages]);

  const updateActiveResponseOnMessage = useCallback((chatId: string, messageId: string, updateFn: (response: ModelResponse) => Partial<ModelResponse>) => {
      const chat = queryClient.getQueryData<ChatSession[]>(['chatHistory'])?.find(c => c.id === chatId);
      if (chat && chat.messages) {
          const updatedMessages = chat.messages.map(m => {
              if (m.id !== messageId || m.role !== 'model' || !m.responses) return m;
              const idx = m.activeResponseIndex;
              const currentResp = m.responses[idx];
              const updatedResp = { ...currentResp, ...updateFn(currentResp) };
              const newResponses = [...m.responses];
              newResponses[idx] = updatedResp;
              return { ...m, responses: newResponses };
          });
          updateChatMessages(chatId, updatedMessages);
      }
  }, [queryClient, updateChatMessages]);
  
  const setChatLoadingState = useCallback((chatId: string, isLoading: boolean) => {
      updateLocalAndCache(old => (old || []).map(c => c.id === chatId ? { ...c, isLoading } : c));
  }, [updateLocalAndCache]);

  const completeChatLoading = useCallback((chatId: string) => {
      setChatLoadingState(chatId, false);
  }, [setChatLoadingState]);

  // Persist updates to backend
  const updateChatProperty = useCallback(async (chatId: string, update: Partial<ChatSession>, debounceMs: number = 0) => {
      // Guard clause: Prevent updates with invalid/missing IDs
      if (!chatId) return;

      // Optimistic update
      updateLocalAndCache(old => (old || []).map(c => c.id === chatId ? { ...c, ...update } : c));
      
      // Fire and forget save (debouncing could be added here if needed, relying on backend handler)
      try {
          await fetchApi(`/api/chats/${chatId}`, {
              method: 'PUT',
              body: JSON.stringify(update),
              keepalive: true
          });
      } catch (e) {
          console.error("Failed to save chat property", e);
      }
  }, [updateLocalAndCache]);

  const updateChatTitle = useCallback((chatId: string, title: string) => updateChatProperty(chatId, { title }), [updateChatProperty]);

  // Merge full list with active chat state
  const unifiedHistory = chatHistory.map(c => c.id === currentChatId && activeChat ? activeChat : c);

  return { 
    chatHistory: unifiedHistory, 
    currentChatId, 
    isHistoryLoading,
    startNewChat, loadChat, deleteChat, clearAllChats, importChat,
    addMessagesToChat, updateActiveResponseOnMessage, 
    updateMessage, setChatLoadingState, completeChatLoading,
    updateChatTitle, updateChatProperty,
    // Add missing property for useAppLogic compatibility
    addModelResponse: () => {} 
  };
};
