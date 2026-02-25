
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

  const startNewChat = useCallback(async (model: string, settings: any, optimisticId?: string): Promise<ChatSession> => {
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

    // We propagate the error now so the caller knows if persistence failed.
    // This allows the Chat logic to abort generation if the chat doesn't exist on backend.
    try {
        await fetchApi('/api/chats/new', {
            method: 'POST',
            body: JSON.stringify({ id: newId, model, ...settings }),
        });
        return newChat;
    } catch (error) {
        console.error("Failed to persist new chat:", error);
        throw error;
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
      // Update Local State if it matches
      // Use functional update to avoid dependency on 'currentChatId' which might be stale in async closures
      setActiveChat(prev => {
          if (prev && prev.id === chatId) {
              return { ...prev, messages };
          }
          return prev;
      });
      
      // We DO NOT update the full chatHistory list cache here on every token.
      // The history list only needs metadata (title, id, etc.), not the full messages array.
      // Updating the full list on every token causes severe lag due to re-rendering the sidebar.
  }, []);

  // Specific helpers to avoid full list traversals in UI components
  const addMessagesToChat = useCallback((chatId: string, newMessages: Message[]) => {
      setActiveChat(prev => {
          if (prev && prev.id === chatId) {
              const updatedMessages = [...(prev.messages || []), ...newMessages];
              return { ...prev, messages: updatedMessages };
          }
          return prev;
      });
  }, []);

  const updateMessage = useCallback((chatId: string, messageId: string, update: Partial<Message>) => {
      setActiveChat(prev => {
          if (prev && prev.id === chatId && prev.messages) {
              const updatedMessages = prev.messages.map(m => m.id === messageId ? { ...m, ...update } : m);
              return { ...prev, messages: updatedMessages };
          }
          return prev;
      });
  }, []);

  const updateActiveResponseOnMessage = useCallback((chatId: string, messageId: string, updateFn: (response: ModelResponse) => Partial<ModelResponse>) => {
      setActiveChat(prev => {
          if (prev && prev.id === chatId && prev.messages) {
              const updatedMessages = prev.messages.map(m => {
                  if (m.id !== messageId || m.role !== 'model' || !m.responses) return m;
                  const idx = m.activeResponseIndex;
                  const currentResp = m.responses[idx];
                  const updatedResp = { ...currentResp, ...updateFn(currentResp) };
                  const newResponses = [...m.responses];
                  newResponses[idx] = updatedResp;
                  return { ...m, responses: newResponses };
              });
              return { ...prev, messages: updatedMessages };
          }
          return prev;
      });
  }, []);
  
  const setChatLoadingState = useCallback((chatId: string, isLoading: boolean) => {
      updateLocalAndCache(old => (old || []).map(c => c.id === chatId ? { ...c, isLoading } : c));
  }, [updateLocalAndCache]);

  const completeChatLoading = useCallback((chatId: string) => {
      setChatLoadingState(chatId, false);
      // Sync the active chat back to the cache so it's not lost when switching chats
      setActiveChat(prev => {
          if (prev && prev.id === chatId) {
              updateLocalAndCache(old => (old || []).map(c => c.id === chatId ? prev : c));
          }
          return prev;
      });
  }, [setChatLoadingState, updateLocalAndCache]);

  // Persist updates to backend
  // Returns true on success, false on failure to allow callers to handle critical failures
  const updateChatProperty = useCallback(async (chatId: string, update: Partial<ChatSession>, debounceMs: number = 0): Promise<boolean> => {
      if (!chatId) return false;

      updateLocalAndCache(old => (old || []).map(c => c.id === chatId ? { ...c, ...update } : c));
      
      if (currentChatId === chatId) {
          setActiveChat(prev => prev ? { ...prev, ...update } : null);
      }
      
      try {
          const body = JSON.stringify(update);
          // keepalive has a 64KB limit. Use it for small updates only.
          const useKeepalive = new Blob([body]).size < 60000;

          await fetchApi(`/api/chats/${chatId}`, {
              method: 'PUT',
              body,
              keepalive: useKeepalive
          });
          return true;
      } catch (e) {
          console.error("Failed to save chat property", e);
          return false;
      }
  }, [updateLocalAndCache, currentChatId]);

  const updateChatTitle = useCallback((chatId: string, title: string) => updateChatProperty(chatId, { title }), [updateChatProperty]);

  return { 
    chatHistory, // Return the raw React Query cache for the sidebar
    activeChat,  // Return the active chat with real-time messages
    currentChatId, 
    isHistoryLoading,
    startNewChat, loadChat, deleteChat, clearAllChats, importChat,
    addMessagesToChat, updateActiveResponseOnMessage, 
    updateMessage, setChatLoadingState, completeChatLoading,
    updateChatTitle, updateChatProperty,
    addModelResponse: () => {} 
  };
};
