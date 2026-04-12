import { useState, useEffect, useRef } from 'react';
import { analyzeAudio } from './services/analyzer';

function createReverbIR(audioCtx: BaseAudioContext, duration: number, decay: number) {
  const sampleRate = audioCtx.sampleRate;
  const length = sampleRate * duration;
  const impulse = audioCtx.createBuffer(2, length, sampleRate);
  const L = impulse.getChannelData(0);
  const R = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const n = i / length;
    // Multi-layered exponential decay for lush textures
    const envelope = Math.pow(1 - n, decay);
    
    // Primary tail (Random noise for dispersion)
    const noise = (Math.random() * 2 - 1) * envelope;
    
    // Secondary reflections (Simulated body)
    const reflection = Math.sin(i * 0.02) * 0.05 * envelope;

    L[i] = noise + reflection;
    R[i] = noise - reflection;
  }
  return impulse;
}

function createSoftCurve() {
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    // Cubic soft-clipping for warm analog-style saturation
    curve[i] = (3 / 2) * x - (1 / 2) * (x * x * x);
  }
  return curve;
}

export interface EQSettings {
  sub: number;    // 60Hz
  bass: number;   // 250Hz
  mid: number;    // 1000Hz
  treble: number; // 4000Hz
  air: number;    // 12000Hz
}

export type MasteringPreset = 'transparent' | 'slowed_reverb' | 'nightcore';

export function useAudioEngine(
  activeBuffer: AudioBuffer | null, 
  speed: number, 
  reverbWet: number,
  roomSize: number,
  eq: EQSettings,
  attenuation: number,
  isLimiterEnabled: boolean,
  punch: number,
  tail: number,
  isElastic: boolean,
  isNightcore: boolean,
  onAnalysis?: (bpm: number, genre: string, suggestedEQ: any) => void
) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [bpm, setBpm] = useState(0);
  const [genre, setGenre] = useState('');

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  
  // Node Refs
  const filtersRef = useRef<{
    sub: BiquadFilterNode;
    bass: BiquadFilterNode;
    mid: BiquadFilterNode;
    treble: BiquadFilterNode;
    air: BiquadFilterNode;
  } | null>(null);
  
  const convolverRef = useRef<ConvolverNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const summerGainRef = useRef<GainNode | null>(null);
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);
  const attenuatorRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const shaperRef = useRef<AudioWorkletNode | null>(null);

  const [pausedAt, setPausedAt] = useState(0);
  const startedAtRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Initialize Audio Graph
  useEffect(() => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;
    setAudioCtx(ctx);

    // 5-Band EQ
    const sub = ctx.createBiquadFilter(); sub.type = 'lowshelf'; sub.frequency.value = 60;
    const bass = ctx.createBiquadFilter(); bass.type = 'peaking'; bass.frequency.value = 250; bass.Q.value = 1;
    const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1000; mid.Q.value = 1;
    const treble = ctx.createBiquadFilter(); treble.type = 'peaking'; treble.frequency.value = 4000; treble.Q.value = 1;
    const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 12000;

    sub.connect(bass);
    bass.connect(mid);
    mid.connect(treble);
    treble.connect(air);
    filtersRef.current = { sub, bass, mid, treble, air };

    // Reverb / Post-processing
    const convolver = ctx.createConvolver();
    convolver.buffer = createReverbIR(ctx, 3.0, 3.0); 
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    const summerGain = ctx.createGain();
    
    air.connect(dryGain);
    air.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(summerGain);
    wetGain.connect(summerGain);

    // Limiter -> Attenuator -> Analyser (Studio Peak Mastering Tuning)
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.setTargetAtTime(-0.5, ctx.currentTime, 0.01);
    limiter.knee.setTargetAtTime(0, ctx.currentTime, 0.01);
    limiter.ratio.setTargetAtTime(20, ctx.currentTime, 0.01);
    limiter.attack.setTargetAtTime(0.001, ctx.currentTime, 0.01);
    limiter.release.setTargetAtTime(0.05, ctx.currentTime, 0.01);

    const attenuator = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048; 
    analyser.smoothingTimeConstant = 0.8;

    // High-Fidelity Soft Clipper (Saturation)
    const softClipper = ctx.createWaveShaper();
    softClipper.curve = createSoftCurve();
    softClipper.oversample = '4x';

    // Load Worklets
    ctx.audioWorklet.addModule('/worklets/transient-shaper.js').then(() => {
      if (ctx.state === 'closed') return;
      const shaper = new AudioWorkletNode(ctx, 'transient-shaper-processor');
      shaperRef.current = shaper;
      summerGain.disconnect();
      summerGain.connect(shaper);
      shaper.connect(limiter);
    }).catch(err => console.error("Worklet Load Error", err));

    summerGain.connect(limiter);
    limiter.connect(softClipper);
    softClipper.connect(attenuator);
    attenuator.connect(analyser);
    analyser.connect(ctx.destination);

    convolverRef.current = convolver;
    dryGainRef.current = dryGain;
    wetGainRef.current = wetGain;
    summerGainRef.current = summerGain;
    limiterRef.current = limiter;
    attenuatorRef.current = attenuator;
    analyserRef.current = analyser;

    return () => {
      ctx.close();
    };
  }, []);

  // Sync Settings
  useEffect(() => {
    if (!filtersRef.current || !audioCtxRef.current) return;
    const t = audioCtxRef.current.currentTime;
    filtersRef.current.sub.gain.setTargetAtTime(eq.sub, t, 0.1);
    filtersRef.current.bass.gain.setTargetAtTime(eq.bass, t, 0.1);
    filtersRef.current.mid.gain.setTargetAtTime(eq.mid, t, 0.1);
    filtersRef.current.treble.gain.setTargetAtTime(eq.treble, t, 0.1);
    filtersRef.current.air.gain.setTargetAtTime(eq.air, t, 0.1);
  }, [eq]);

  useEffect(() => {
    if (!attenuatorRef.current || !audioCtxRef.current) return;
    attenuatorRef.current.gain.setTargetAtTime(attenuation, audioCtxRef.current.currentTime, 0.1);
  }, [attenuation]);

  useEffect(() => {
    if (!limiterRef.current || !audioCtxRef.current) return;
    limiterRef.current.ratio.setTargetAtTime(isLimiterEnabled ? 20 : 1, audioCtxRef.current.currentTime, 0.1);
  }, [isLimiterEnabled]);

  useEffect(() => {
    if (!shaperRef.current || !audioCtxRef.current) return;
    const t = audioCtxRef.current.currentTime;
    shaperRef.current.parameters.get('attack')?.setTargetAtTime(punch, t, 0.1);
    shaperRef.current.parameters.get('sustain')?.setTargetAtTime(tail, t, 0.1);
  }, [punch, tail]);

  useEffect(() => {
    setIsPlaying(false);
    setPausedAt(0);
    setCurrentTime(0);

    if (activeBuffer) {
      analyzeAudio(activeBuffer).then(res => {
        setBpm(res.bpm);
        setGenre(res.genreHint);
        if (onAnalysis) onAnalysis(res.bpm, res.genreHint, res.suggestedEQ);
      });
    }
  }, [activeBuffer]);

  useEffect(() => {
    if (isPlaying && activeBuffer && audioCtxRef.current) {
      const updateProgress = () => {
        const elapsed = (audioCtxRef.current!.currentTime - startedAtRef.current) * speed;
        setCurrentTime(elapsed % activeBuffer.duration);
        rafRef.current = requestAnimationFrame(updateProgress);
      };
      rafRef.current = requestAnimationFrame(updateProgress);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, activeBuffer, speed]);

  useEffect(() => {
    if (!activeBuffer || !audioCtxRef.current) return;

    if (isPlaying) {
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }

      const source = audioCtxRef.current.createBufferSource();
      source.buffer = activeBuffer;
      source.playbackRate.value = speed;
      source.connect(filtersRef.current!.sub);
      source.start(0, pausedAt);
      startedAtRef.current = audioCtxRef.current.currentTime - (pausedAt / speed);
      sourceRef.current = source;
      source.onended = () => {
        if (sourceRef.current === source) {
          setIsPlaying(false);
          setPausedAt(0);
          setCurrentTime(0);
        }
      };
    } else {
      if (sourceRef.current) {
        const elapsed = (audioCtxRef.current.currentTime - startedAtRef.current) * speed;
        setPausedAt(elapsed % activeBuffer.duration);
        sourceRef.current.onended = null;
        sourceRef.current.stop();
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
    }

    return () => {
      if (sourceRef.current) {
        sourceRef.current.onended = null;
        sourceRef.current.stop();
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
    };
  }, [isPlaying, activeBuffer]);

  useEffect(() => {
    if (sourceRef.current && audioCtxRef.current) {
      sourceRef.current.playbackRate.setTargetAtTime(speed, audioCtxRef.current.currentTime, 0.1);
    }
  }, [speed, isElastic]);

  useEffect(() => {
    if (!convolverRef.current || !audioCtxRef.current || isNightcore) return;
    // Debounced IR regeneration for stability
    const duration = 0.5 + (roomSize * 7.5);
    const decay = 1.0 + (roomSize * 4.0);
    convolverRef.current.buffer = createReverbIR(audioCtxRef.current, duration, decay);
  }, [roomSize, isNightcore]);

  useEffect(() => {
    if (!audioCtxRef.current || !filtersRef.current || !dryGainRef.current || !wetGainRef.current || !summerGainRef.current || !limiterRef.current) return;
    const ctx = audioCtxRef.current;
    const t = ctx.currentTime;
    
    // ACTIVE BYPASS LOGIC: Purity vs Textures
    if (isNightcore) {
      // Direct Master Route (Zero convolution jitter)
      filtersRef.current.air.disconnect();
      filtersRef.current.air.connect(limiterRef.current);
    } else {
      // Studio Signal Path (Parallel FX Processing)
      filtersRef.current.air.disconnect();
      filtersRef.current.air.connect(dryGainRef.current);
      filtersRef.current.air.connect(convolverRef.current!);
      
      const dryVal = Math.cos(reverbWet * 0.5 * Math.PI);
      const wetVal = Math.cos((1.0 - reverbWet) * 0.5 * Math.PI);
      dryGainRef.current.gain.setTargetAtTime(dryVal, t, 0.05);
      wetGainRef.current.gain.setTargetAtTime(wetVal, t, 0.05);
    }
  }, [reverbWet, isNightcore]);

  const seekTo = (time: number) => {
    if (!activeBuffer) return;
    const wasPlaying = isPlaying;
    if (wasPlaying) setIsPlaying(false);
    const bufferPos = Math.max(0, Math.min(time * speed, activeBuffer.duration));
    setPausedAt(bufferPos);
    setCurrentTime(bufferPos);
    if (wasPlaying) setTimeout(() => setIsPlaying(true), 10);
  };

  const renderBuffer = async (
    targetBuffer: AudioBuffer, 
    p: { speed: number, reverb: number, roomSize: number, eq: EQSettings, attenuation: number, limiter: boolean, isNightcore: boolean }
  ): Promise<AudioBuffer | null> => {
    const offlineCtx = new OfflineAudioContext(
      targetBuffer.numberOfChannels,
      targetBuffer.sampleRate * (targetBuffer.duration / p.speed),
      targetBuffer.sampleRate
    );

    const sub = offlineCtx.createBiquadFilter(); sub.type = 'lowshelf'; sub.frequency.value = 60; sub.gain.value = p.eq.sub;
    const bass = offlineCtx.createBiquadFilter(); bass.type = 'peaking'; bass.frequency.value = 250; bass.gain.value = p.eq.bass;
    const mid = offlineCtx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1000; mid.gain.value = p.eq.mid;
    const treble = offlineCtx.createBiquadFilter(); treble.type = 'peaking'; treble.frequency.value = 4000; treble.gain.value = p.eq.treble;
    const air = offlineCtx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 12000; air.gain.value = p.eq.air;

    const convolver = offlineCtx.createConvolver();
    const duration = 0.5 + (p.roomSize * 7.5);
    const decay = 1.0 + (p.roomSize * 4.0);
    convolver.buffer = createReverbIR(offlineCtx, duration, decay);
    const dryGain = offlineCtx.createGain();
    const wetGain = offlineCtx.createGain();
    const summerGain = offlineCtx.createGain();
    
    dryGain.gain.value = Math.cos(p.reverb * 0.5 * Math.PI);
    wetGain.gain.value = Math.cos((1.0 - p.reverb) * 0.5 * Math.PI);

    const limiter = offlineCtx.createDynamicsCompressor();
    limiter.threshold.value = -0.5;
    limiter.knee.value = 0;
    limiter.ratio.value = p.limiter ? 20 : 1;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.05;

    const attenuator = offlineCtx.createGain();
    attenuator.gain.value = p.attenuation;

    const softClipper = offlineCtx.createWaveShaper();
    softClipper.curve = createSoftCurve();
    softClipper.oversample = '4x';

    sub.connect(bass); bass.connect(mid); mid.connect(treble); treble.connect(air);
    
    if (p.isNightcore) {
      air.connect(limiter);
    } else {
      air.connect(dryGain); air.connect(convolver);
      convolver.connect(wetGain); dryGain.connect(summerGain); wetGain.connect(summerGain);
      summerGain.connect(limiter);
    }

    limiter.connect(softClipper);
    softClipper.connect(attenuator); 
    attenuator.connect(offlineCtx.destination);

    const source = offlineCtx.createBufferSource();
    source.buffer = targetBuffer;
    source.playbackRate.value = p.speed;
    source.connect(sub);
    source.start(0);

    return await offlineCtx.startRendering();
  };

  return {
    isPlaying,
    setIsPlaying,
    currentTime: currentTime / speed,
    duration: (activeBuffer?.duration || 0) / speed,
    seekTo,
    renderBuffer,
    audioCtx,
    analyser: analyserRef.current,
    bpm,
    genre
  };
}
