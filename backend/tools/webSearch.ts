
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { ToolError } from '../utils/apiError';
import { generateContentWithRetry } from '../utils/geminiUtils';
import * as cheerio from 'cheerio';

function hasProperty<K extends PropertyKey>(obj: unknown, prop: K): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && prop in obj;
}

export const executeWebSearch = async (ai: GoogleGenAI, args: { query: string }): Promise<string> => {
  if (!args.query || !args.query.trim()) {
      throw new ToolError('duckduckgoSearch', 'MISSING_QUERY', 'Search query cannot be empty.');
  }

  try {
    let isUrl = false;
    try {
      new URL(args.query); isUrl = true;
    } catch (_) { /* not a URL */ }

    if (isUrl) {
      const prompt = `You are a specialized URL summarizer. Fetch the content of this URL: "${args.query}".
      
      Output Requirements:
      1. Title of the page.
      2. Brief Executive Summary (2-3 sentences).
      3. Key Topics/Facts (Bullet points).
      4. If it's a technical article, extract code snippets or commands if relevant.
      `;
      
      const response = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
      });

      const summary = response.text?.trim() ?? '';
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      
      if (!summary && groundingChunks.length === 0) {
          throw new ToolError('duckduckgoSearch', 'NO_RESULTS', 'The search returned no text summary and no grounding sources.', undefined, 'Try rephrasing your search query to be more specific or use general keywords.');
      }

      const sources: { uri: string; title: string }[] = [];
      for (const chunk of groundingChunks) {
        if (!hasProperty(chunk, 'web') || typeof chunk.web !== 'object' || chunk.web === null) continue;
        const web = chunk.web;
        if (!hasProperty(web, 'uri') || typeof web.uri !== 'string') continue;
        const uri = web.uri;
        let title = uri;
        if (hasProperty(web, 'title') && typeof web.title === 'string' && web.title.trim()) {
            title = web.title.trim();
        }
        sources.push({ uri, title });
      }

      const uniqueSources = Array.from(new Map(sources.map(s => [s.uri, s])).values());
      if (!uniqueSources.some(s => s.uri === args.query)) {
          uniqueSources.unshift({ uri: args.query, title: args.query });
      }
      
      const sourcesMarkdown = uniqueSources.map(s => `- [${s.title}](${s.uri})`).join('\n');
      
      return `${summary}\n\n[SOURCES_PILLS]\n${sourcesMarkdown}\n[/SOURCES_PILLS]`;
    } else {
      // Perform actual DuckDuckGo HTML search
      const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`, {
          headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
          }
      });
      
      if (!response.ok) {
          throw new Error(`DuckDuckGo returned status ${response.status}`);
      }
      
      const html = await response.text();
      const $ = cheerio.load(html);
      const results: { title: string; snippet: string; url: string }[] = [];
      
      $('.result').each((i, el) => {
          if (results.length >= 10) return false; // Limit to top 10 results
          
          const title = $(el).find('.result__title').text().trim();
          const snippet = $(el).find('.result__snippet').text().trim();
          const rawUrl = $(el).find('.result__url').attr('href');
          
          let url = rawUrl || '';
          if (url.startsWith('//duckduckgo.com/l/?uddg=')) {
              try {
                  const parsed = new URL('https:' + url);
                  url = decodeURIComponent(parsed.searchParams.get('uddg') || '');
              } catch (e) {
                  // Keep raw URL if parsing fails
              }
          }
          
          if (title && url) {
              results.push({ title, snippet, url });
          }
      });
      
      if (results.length === 0) {
          throw new ToolError('duckduckgoSearch', 'NO_RESULTS', 'The search returned no results.', undefined, 'Try rephrasing your search query to be more specific or use general keywords.');
      }
      
      let markdownOutput = `### Search Results for "${args.query}"\n\n`;
      results.forEach((res, index) => {
          markdownOutput += `${index + 1}. **[${res.title}](${res.url})**\n   ${res.snippet}\n\n`;
      });
      
      return markdownOutput;
    }
    
  } catch (err) {
    if (err instanceof ToolError) throw err;
    const originalError = err instanceof Error ? err : new Error(String(err));
    throw new ToolError('duckduckgoSearch', 'SEARCH_FAILED', originalError.message, originalError, 'The search request failed. This may be a temporary API issue.');
  }
};
