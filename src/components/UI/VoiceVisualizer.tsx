/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';

type VoiceVisualizerProps = {
    isRecording: boolean;
};

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ isRecording }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const animationIdRef = useRef<number | null>(null);

    useEffect(() => {
        if (!isRecording) {
            if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
            if (audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
            return;
        }

        const startVisualizer = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const analyser = audioCtx.createAnalyser();
                const source = audioCtx.createMediaStreamSource(stream);

                analyser.fftSize = 64; // Low resolution for "bar" look
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);

                source.connect(analyser);

                audioContextRef.current = audioCtx;
                analyserRef.current = analyser;
                dataArrayRef.current = dataArray;
                sourceRef.current = source;

                draw();
            } catch (err) {
                console.error("Error accessing microphone for visualizer:", err);
            }
        };

        const draw = () => {
            if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current) return;

            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const width = canvas.width;
            const height = canvas.height;
            const analyser = analyserRef.current;
            const dataArray = dataArrayRef.current;

            animationIdRef.current = requestAnimationFrame(draw);

            // Cast to any to avoid TS mismatch between Uint8Array<ArrayBuffer> and Uint8Array<ArrayBufferLike>
            analyser.getByteFrequencyData(dataArray as any);

            ctx.clearRect(0, 0, width, height);

            // Add strong glow effect
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#818cf8'; // Indigo-400 for the shine

            const barWidth = (width / dataArray.length) * 2.5;
            let x = 0;

            for (let i = 0; i < dataArray.length; i++) {
                const barHeight = (dataArray[i] / 255) * height;
                
                // Gradient Color based on height (Volume)
                const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
                gradient.addColorStop(0, '#6366f1'); // Indigo
                gradient.addColorStop(0.5, '#a855f7'); // Purple
                gradient.addColorStop(1, '#ffffff'); // White tip for "shine"

                ctx.fillStyle = gradient;
                
                // Rounded tops
                ctx.beginPath();
                ctx.roundRect(x, height - barHeight, barWidth, barHeight, 4);
                ctx.fill();

                x += barWidth + 2;
            }
        };

        startVisualizer();

        return () => {
            if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
            if (audioContextRef.current) audioContextRef.current.close();
        };
    }, [isRecording]);

    if (!isRecording) return null;

    return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50 rounded-xl">
            <div className="bg-white dark:bg-[#1e1e1e] p-4 rounded-2xl shadow-2xl flex flex-col items-center gap-2 border border-white/10">
                <canvas ref={canvasRef} width={200} height={60} className="w-48 h-16" />
                <span className="text-xs font-bold text-red-500 animate-pulse uppercase tracking-wider">Listening...</span>
            </div>
        </div>
    );
};