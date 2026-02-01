

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// This file centralizes all FunctionDeclarations for the tools.
// The backend-executed tools' implementations are in `/backend/tools/`.
// The frontend-executed tools' implementations are in `/src/tools/`.

import { FunctionDeclaration, Type } from "@google/genai";

export const calculatorDeclaration: FunctionDeclaration = {
    name: 'calculator',
    description: 'Evaluates a mathematical expression. Supports arithmetic (+, -, *, /) and JavaScript Math functions (Math.sqrt, Math.sin, Math.pow, Math.PI, etc.). [Execution: Fast (<100ms) | Cost: Free | Permissions: None]',
    parameters: {
      type: Type.OBJECT,
      properties: {
        expression: { type: Type.STRING, description: 'The mathematical expression to evaluate (e.g., "Math.sqrt(144) * Math.PI").' },
      },
      required: ['expression'],
    },
};

export const codeExecutorDeclaration: FunctionDeclaration = {
    name: 'executeCode',
    description: 'Executes code in a secure sandboxed environment. Supports Python, JavaScript, and other languages. For Python, it can install packages from PyPI, perform network requests, and read user-provided files. [Execution: Medium (1-10s) | Cost: Low | Permissions: Internet, Filesystem]',
    parameters: {
      type: Type.OBJECT,
      properties: {
        language: { type: Type.STRING, description: 'The programming language. Supported: "python", "javascript", "typescript", "bash", "go", "java".' },
        rationale: { type: Type.STRING, description: 'Brief explanation of what this code does and why it is being run (Chain of Thought).' },
        code: { type: Type.STRING, description: 'The complete source code to execute. Must be self-contained.' },
        packages: { type: Type.ARRAY, description: '(Python only) A list of PyPI packages to install before running the code (e.g., ["numpy", "pandas", "requests"]). Do not include standard library modules.', items: { type: Type.STRING } },
        input_filenames: { type: Type.ARRAY, description: '(Python only) A list of exact filenames (e.g. "data.csv") from the virtual filesystem that the code needs to read. These files must already exist via `writeFile` or uploads.', items: { type: Type.STRING } }
      },
      required: ['language', 'code'],
    },
};

export const duckduckgoSearchDeclaration: FunctionDeclaration = {
    name: 'duckduckgoSearch',
    description: 'Dual-function tool. 1) Search: If query is a search term, returns web results. 2) Summarize: If query is a URL, fetches and summarizes that specific page. [Execution: Fast (500ms-2s) | Cost: Free | Permissions: Internet]',
    parameters: {
      type: Type.OBJECT,
      properties: { query: { type: Type.STRING, description: 'The search keywords (e.g. "current CEO of Google") or a specific URL (e.g. "https://example.com") to read.' } },
      required: ['query'],
    },
};

export const browserDeclaration: FunctionDeclaration = {
    name: 'browser',
    description: 'A headless web browser. Use this to read documentation, verify facts on specific pages, or inspect visual layouts of websites. [Execution: Slow (3-15s) | Cost: Medium | Permissions: Internet]',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING, description: 'The fully qualified URL to visit (must start with http:// or https://).' },
        action: { 
            type: Type.STRING, 
            description: 'Action to perform. "read": extract text content. "screenshot": take a picture of the page. "click"/"type"/"scroll": interact with dynamic elements.', 
            enum: ['read', 'screenshot', 'click', 'type', 'scroll', 'wait'] 
        },
        waitUntil: {
            type: Type.STRING,
            description: 'When to consider navigation finished. "domcontentloaded" (fast, default), "networkidle" (wait for SPAs/AJAX), "load" (wait for all assets).',
            enum: ['domcontentloaded', 'networkidle', 'load']
        },
        selector: { type: Type.STRING, description: 'CSS selector for "click" or "type" actions (e.g., "button#submit", ".search-input"). Required if action is click/type.' },
        text: { type: Type.STRING, description: 'Text to type for the "type" action.' },
        scrollDirection: { type: Type.STRING, description: 'Direction for "scroll" action.', enum: ['up', 'down', 'top', 'bottom'] }
      },
      required: ['url'],
    },
};

export const imageGeneratorDeclaration: FunctionDeclaration = {
    name: 'generateImage',
    description: 'Generates images based on a textual description using an AI model. Best for creating illustrations, diagrams, or photorealistic scenes. [Execution: Slow (5-10s) | Cost: High | Permissions: Internet]',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: 'A highly detailed visual description of the image. Include style, lighting, mood, and composition details.' },
        numberOfImages: { type: Type.NUMBER, description: 'Number of images (1-4). Defaults to 1. Only supported by Imagen models.'},
        aspectRatio: { type: Type.STRING, description: 'The aspect ratio. Options: "1:1" (square), "3:4" (portrait), "4:3" (landscape), "16:9" (wide), "9:16" (mobile).' },
      },
      required: ['prompt'],
    },
};

export const getCurrentLocationDeclaration: FunctionDeclaration = {
    name: 'getCurrentLocation',
    description: "Gets the user's current geographical location (latitude and longitude) from their device. [Execution: Fast | Cost: Free | Permissions: Geolocation]",
    parameters: { type: Type.OBJECT, properties: {} },
};
  
export const requestLocationPermissionDeclaration: FunctionDeclaration = {
    name: 'requestLocationPermission',
    description: "Requests UI permission from the user to access their location. Use this if `getCurrentLocation` fails with a permission error. [Execution: User Dependent | Cost: Free | Permissions: Geolocation]",
    parameters: { type: Type.OBJECT, properties: {} },
};

export const displayMapDeclaration: FunctionDeclaration = {
    name: 'displayMap',
    description: 'Displays an interactive map. You can provide a specific location name (e.g., "Paris", "Eiffel Tower") OR explicit latitude/longitude coordinates. [Execution: Fast | Cost: Free | Permissions: None]',
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: { type: Type.STRING, description: 'The name of the location to display (e.g. "Tokyo", "Times Square"). Preferred over coordinates if exact lat/long is unknown.' },
        latitude: { type: Type.NUMBER, description: 'The decimal latitude (optional if location name is provided).' },
        longitude: { type: Type.NUMBER, description: 'The decimal longitude (optional if location name is provided).' },
        zoom: { type: Type.NUMBER, description: 'Zoom level (1-18). 1=World, 10=City, 15=Street. Default 13.' },
        markerText: { type: Type.STRING, description: 'Text label for the location marker.' }
      },
    },
};
  
export const analyzeMapVisuallyDeclaration: FunctionDeclaration = {
    name: 'analyzeMapVisually',
    description: 'Analyzes a map at specific coordinates to describe landmarks, geography, and road layout. Use this if you need to "see" the map context. [Execution: Medium (2-5s) | Cost: Low | Permissions: Internet]',
    parameters: {
      type: Type.OBJECT,
      properties: {
        latitude: { type: Type.NUMBER, description: 'The latitude to analyze.' },
        longitude: { type: Type.NUMBER, description: 'The longitude to analyze.' },
      },
      required: ['latitude', 'longitude'],
    },
};

export const analyzeImageVisuallyDeclaration: FunctionDeclaration = {
    name: 'analyzeImageVisually',
    description: 'Analyzes a visual image file to describe its contents. Essential for verifying generated images or analyzing uploaded files. [Execution: Medium (2-5s) | Cost: Medium | Permissions: Internet]',
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: { type: Type.STRING, description: 'The path of an image in the virtual filesystem (e.g. "/main/output/chart.png").' },
        imageBase64: { type: Type.STRING, description: 'Raw base64 image data (used internally for screenshot analysis).' },
      },
    },
};

export const captureCodeOutputScreenshotDeclaration: FunctionDeclaration = {
    name: 'captureCodeOutputScreenshot',
    description: 'Captures a screenshot of HTML/JS output rendered by `executeCode`. Use this to "see" plots, graphs, or interactive widgets generated by code. [Execution: Fast | Cost: Free | Permissions: DOM Access]',
    parameters: {
      type: Type.OBJECT,
      properties: {
        outputId: {
          type: Type.STRING,
          description: 'The unique ID returned in the `executeCode` result when it renders HTML content.',
        },
      },
      required: ['outputId'],
    },
};
  
export const videoGeneratorDeclaration: FunctionDeclaration = {
    name: 'generateVideo',
    description: 'Generates a short video clip (seconds) from a text prompt. [Execution: Very Slow (2-5 mins) | Cost: High | Permissions: Internet] **Warning: This process is slow. Inform the user before proceeding.**',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: 'Detailed visual description of the scene and motion.' },
        aspectRatio: { type: Type.STRING, description: 'Aspect ratio: "16:9" (Landscape) or "9:16" (Portrait).' },
        resolution: { type: Type.STRING, description: 'Resolution: "720p" or "1080p".' }
      },
      required: ['prompt'],
    },
};

export const listFilesDeclaration: FunctionDeclaration = {
    name: 'listFiles',
    description: 'Lists all files currently stored in the virtual filesystem directory. [Execution: Fast | Cost: Free | Permissions: Filesystem]',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: 'Directory path (usually "/main/output").' },
      },
      required: ['path'],
    },
};
  
export const displayFileDeclaration: FunctionDeclaration = {
    name: 'displayFile',
    description: 'Renders a file (image, video, PDF) in the chat UI for the user. [Execution: Fast | Cost: Free | Permissions: Filesystem]',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: 'The full path of the file to show (e.g. "/main/output/result.png").' },
      },
      required: ['path'],
    },
};
  
export const deleteFileDeclaration: FunctionDeclaration = {
    name: 'deleteFile',
    description: 'Permanently deletes a file from the virtual filesystem. [Execution: Fast | Cost: Free | Permissions: Filesystem]',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: 'The full path of the file to delete.' },
      },
      required: ['path'],
    },
};
  
export const writeFileDeclaration: FunctionDeclaration = {
    name: 'writeFile',
    description: 'Creates or overwrites a text file in the virtual filesystem. [Execution: Fast | Cost: Free | Permissions: Filesystem]',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: 'The full destination path (e.g. "/main/output/summary.md").' },
        content: { type: Type.STRING, description: 'The text content to write.' },
      },
      required: ['path', 'content'],
    },
};

export const toolDeclarations = [
    duckduckgoSearchDeclaration,
    browserDeclaration,
    getCurrentLocationDeclaration,
    imageGeneratorDeclaration,
    videoGeneratorDeclaration,
    codeExecutorDeclaration,
    displayMapDeclaration,
    requestLocationPermissionDeclaration,
    analyzeMapVisuallyDeclaration,
    analyzeImageVisuallyDeclaration,
    captureCodeOutputScreenshotDeclaration,
    calculatorDeclaration,
    writeFileDeclaration,
    listFilesDeclaration,
    displayFileDeclaration,
    deleteFileDeclaration,
];