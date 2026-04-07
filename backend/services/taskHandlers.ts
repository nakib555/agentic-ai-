import { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { historyControl } from './historyControl';
import { generateProviderCompletion } from '../utils/generateProviderCompletion';
import { executeTextToSpeech } from "../tools/tts";
import { executeExtractMemorySuggestions, executeConsolidateMemory } from "../tools/memory";
import { executeWithPiston } from "../tools/piston";
import { parseApiError } from '../utils/apiError';
import { GoogleGenAI } from "@google/genai";
import path from 'path';
import { promises as fs } from 'fs';

export const handleTitle = async (req: any, res: any, activeProviderName: string, chatApiKey: string, defaultModel: string) => {
    const { messages, model } = req.body;
    const historyText = (messages || [])
        .filter((m: any) => !m.isHidden)
        .slice(0, 5)
        .map((m: any) => {
            const role = m.role === 'model' ? 'Assistant' : 'User';
            const text = (m.text || '').substring(0, 500); 
            return `${role}: ${text}`;
        })
        .join('\n');
    
    const systemPrompt = "You are a specialized title generator. Output a concise title (3-6 words) for the conversation. Do not use quotes, prefixes, or periods.";
    const userPrompt = `Generate a short, descriptive title for this conversation:\n\n${historyText}`;
    
    let title = await generateProviderCompletion(activeProviderName, chatApiKey, model || defaultModel, userPrompt, systemPrompt);
    
    title = title.trim()
        .replace(/^["']|["']$/g, '')
        .replace(/^(Title:|Subject:|Topic:)\s*/i, '')
        .replace(/\.$/, '');
    
    if (title.length > 60) {
         title = title.substring(0, 57) + '...';
    }

    res.status(200).json({ title: title || 'New Chat' });
};

export const handleSuggestions = async (req: any, res: any, activeProviderName: string, chatApiKey: string, defaultModel: string) => {
    const { conversation, model } = req.body;
    const recentHistory = conversation.slice(-5).map((m: any) => `${m.role}: ${(m.text || '').substring(0, 200)}`).join('\n');
    const prompt = `Suggest 3 short follow-up questions. Return JSON array of strings. Do not use markdown code blocks.\n\nCONVERSATION:\n${recentHistory}\n\nJSON SUGGESTIONS:`;
    try {
        const text = await generateProviderCompletion(activeProviderName, chatApiKey, model || defaultModel, prompt, undefined, true);
        let suggestions = [];
        try { 
            const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
            suggestions = JSON.parse(cleanText || '[]'); 
        } catch (e) {}
        if (!Array.isArray(suggestions)) suggestions = [];
        res.status(200).json({ suggestions });
    } catch (e) { res.status(200).json({ suggestions: [] }); }
};

export const handleTTS = async (req: any, res: any, auxAi: any) => {
    if (!auxAi) throw new Error("TTS Unavailable: Google Gemini API key not configured in settings.");
    const { text, voice, model } = req.body;
    try {
        const audio = await executeTextToSpeech(auxAi, text, voice, model);
        res.status(200).json({ audio });
    } catch (e) {
        res.status(500).json({ error: parseApiError(e) });
    }
};

export const handleEnhance = async (req: any, res: any, activeProviderName: string, chatApiKey: string) => {
    const { userInput, prompt } = req.body;
    const input = userInput || prompt;
    const enhancementPrompt = `You are an expert Prompt Engineer. Rewrite this input into a highly effective prompt.\n\nUSER INPUT: "${input}"\n\nOutput ONLY the raw text of the improved prompt.`;
    res.setHeader('Content-Type', 'text/plain');
    try {
        const text = await generateProviderCompletion(activeProviderName, chatApiKey, 'gemini-3-flash-preview', enhancementPrompt); 
        res.write(text);
    } catch (e) { res.write(input); }
    res.end();
};

export const handleFixCode = async (req: any, res: any, activeProviderName: string, chatApiKey: string, defaultModel: string) => {
    const { code, error, context, model } = req.body;
    const fixPrompt = `You are an expert code debugger specializing in ECharts and data visualization.\nThe user provided the following ECharts code which failed to parse or render.\n\nINVALID CODE:\n${code}\n\nERROR DETAILS (Optional):\n${error || "Syntax or Logic Error"}\n\nCONTEXT (Optional):\n${context || ""}\n\nTASK:\n1. Fix the syntax errors.\n2. Ensure it is valid JSON/JavaScript object structure.\n3. Output ONLY the fixed XML block: <echarts>{ ... }</echarts>`;
    try {
        const result = await generateProviderCompletion(activeProviderName, chatApiKey, model || defaultModel, fixPrompt);
        res.status(200).json({ fixedCode: result });
    } catch (e) {
        res.status(500).json({ error: parseApiError(e) });
    }
};

export const handleMemorySuggest = async (req: any, res: any, activeProviderName: string, chatApiKey: string, defaultModel: string) => {
    const { conversation } = req.body;
    try {
        const suggestions = await executeExtractMemorySuggestions(activeProviderName, chatApiKey, defaultModel, conversation);
        res.status(200).json({ suggestions });
    } catch (e) { res.status(200).json({ suggestions: [] }); }
};

export const handleMemoryConsolidate = async (req: any, res: any, activeProviderName: string, chatApiKey: string, defaultModel: string) => {
    const { currentMemory, suggestions } = req.body;
    try {
        const memory = await executeConsolidateMemory(activeProviderName, chatApiKey, defaultModel, currentMemory, suggestions);
        res.status(200).json({ memory });
    } catch (e) { res.status(200).json({ memory: [currentMemory, ...suggestions].filter(Boolean).join('\n') }); }
};

export const handleRunPiston = async (req: any, res: any) => {
    const { language, code } = req.body;
    try {
        const result = await executeWithPiston(language, code);
        res.status(200).json({ result });
    } catch (e) {
        res.status(500).json({ error: parseApiError(e).message });
    }
};

export const handleCountTokens = async (req: any, res: any, activeProviderName: string, chatApiKey: string, defaultModel: string) => {
    const { newMessage, model } = req.body;
    let textToCount = "";
    if (newMessage) {
        if (newMessage.text) textToCount += newMessage.text;
        if (newMessage.attachments) textToCount += ` [${newMessage.attachments.length} attachments]`;
    }
    try {
        if (activeProviderName === 'gemini' && chatApiKey) {
             const ai = new GoogleGenAI({ apiKey: chatApiKey });
             const countResult = await ai.models.countTokens({
                 model: model || defaultModel,
                 contents: [{ parts: [{ text: textToCount }] }]
             });
             res.status(200).json({ totalTokens: countResult.totalTokens });
        } else {
             res.status(200).json({ totalTokens: Math.ceil(textToCount.length / 4) });
        }
    } catch (e) {
        res.status(200).json({ totalTokens: Math.ceil(textToCount.length / 4) });
    }
};
