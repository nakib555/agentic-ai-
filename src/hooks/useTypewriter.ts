import { useState, useEffect, useRef } from 'react';

export const useTypewriter = (text: string, isStreaming: boolean, speed: number = 15) => {
    const [displayedText, setDisplayedText] = useState('');
    const indexRef = useRef(0);
    const textRef = useRef(text);
    const wasStreamingRef = useRef(isStreaming);

    useEffect(() => {
        const previousText = textRef.current;
        textRef.current = text;
        
        // If it's not streaming and it NEVER was streaming (e.g. loaded from history), jump to end
        // OR if it's not streaming and the text changed (e.g. user edited the message), jump to end
        if (!isStreaming && (!wasStreamingRef.current || previousText !== text) && indexRef.current < text.length) {
            setDisplayedText(text);
            indexRef.current = text.length;
        }
        
        if (isStreaming) {
            wasStreamingRef.current = true;
        }
    }, [text, isStreaming]);

    useEffect(() => {
        if (!isStreaming && indexRef.current >= textRef.current.length) return;

        const interval = setInterval(() => {
            if (indexRef.current < textRef.current.length) {
                // Calculate how far behind we are
                const remaining = textRef.current.length - indexRef.current;
                
                // If we're very far behind, speed up
                const chunkSize = Math.max(1, Math.floor(remaining / 5)); 
                
                indexRef.current += chunkSize;
                setDisplayedText(textRef.current.substring(0, indexRef.current));
            } else if (!isStreaming) {
                clearInterval(interval);
            }
        }, speed);

        return () => clearInterval(interval);
    }, [isStreaming, speed]);

    // Reset if text is completely new (e.g. new message)
    useEffect(() => {
        if (text.length === 0 || (text.length > 0 && indexRef.current > text.length)) {
            setDisplayedText('');
            indexRef.current = 0;
            wasStreamingRef.current = isStreaming;
        }
    }, [text, isStreaming]);

    return displayedText;
};
