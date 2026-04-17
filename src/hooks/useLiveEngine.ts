import { useEffect, useRef } from 'react';
import type { StudioEffects } from '../services/engine/StudioEngine';
import { getAudioContext } from '../services/engine/audioContext';

export function useLiveEngine(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  effects: StudioEffects
) {
  const isInitialized = useRef(false);
  const sourceNode = useRef<MediaElementAudioSourceNode | null>(null);
  const reverbNode = useRef<ConvolverNode | null>(null);
  const wetGain = useRef<GainNode | null>(null);
  const dryGain = useRef<GainNode | null>(null);

  useEffect(() => {
    if (!videoRef.current || isInitialized.current) return;
    
    try {
      const ctx = getAudioContext();
      
      // Initialize single-instance routing to bypass RAM limits
      sourceNode.current = ctx.createMediaElementSource(videoRef.current);
      
      dryGain.current = ctx.createGain();
      wetGain.current = ctx.createGain();
      reverbNode.current = ctx.createConvolver();
      
      // Standard mathematical fallback IR
      createSimpleIR(ctx).then(buffer => {
          if (reverbNode.current) reverbNode.current.buffer = buffer;
      });

      // Split
      sourceNode.current.connect(dryGain.current);
      sourceNode.current.connect(reverbNode.current);
      reverbNode.current.connect(wetGain.current);
      
      // Merge to output
      dryGain.current.connect(ctx.destination);
      wetGain.current.connect(ctx.destination);

      isInitialized.current = true;
    } catch (e) {
      console.error("[LIVE-ENGINE] Init failure, usually means element already bound.", e);
    }
  }, [videoRef.current]);

  // Reactive Effect Sync
  useEffect(() => {
    if (!videoRef.current) return;
    const ctx = getAudioContext();

    // 1. Hardware-level Pitch Shifting (True Native Nightcore/Slowed)
    // By disabling preservesPitch, the Chromium engine natively resamples the media
    // mapping speed directly to pitch instantly, requiring 0 CPU over-head.
    videoRef.current.preservesPitch = false;
    videoRef.current.playbackRate = effects.speed || 1.0;

    // 2. Reverb Sync
    if (wetGain.current && dryGain.current) {
        wetGain.current.gain.setTargetAtTime(effects.reverbWet || 0, ctx.currentTime, 0.1);
        const dryLevel = 1.0 - ((effects.reverbWet || 0) * 0.4);
        dryGain.current.gain.setTargetAtTime(dryLevel, ctx.currentTime, 0.1);
    }

    // Custom IR Sync
    if (reverbNode.current && effects.customIRBuffer) {
        reverbNode.current.buffer = effects.customIRBuffer;
    }

  }, [effects, videoRef.current]);

  return { isInitialized: isInitialized.current };
}

// Math-based fallback IR for safe real-time 
async function createSimpleIR(ctx: AudioContext): Promise<AudioBuffer> {
    const duration = 2.0;
    const decay = 2.0;
    const impulse = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = impulse.getChannelData(c);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, decay);
      }
    }
    return impulse;
}
