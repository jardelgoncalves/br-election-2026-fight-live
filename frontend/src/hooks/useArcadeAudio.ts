import { useCallback, useEffect, useRef, useState } from 'react';

import type { CombatEvent } from '../types';

const LOOP_DURATION = 4;
const STEP_DURATION = LOOP_DURATION / 16;

function createInstanceId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `audio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const melody = [
  293.66, 0, 349.23, 392, 293.66, 0, 440, 392,
  261.63, 0, 349.23, 440, 293.66, 349.23, 392, 523.25,
];

const bass = [73.42, 73.42, 65.41, 65.41, 58.27, 58.27, 65.41, 69.3];

function scheduleTone(
  context: AudioContext,
  output: AudioNode,
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  activeNodes: Set<OscillatorNode>,
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(output);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
  activeNodes.add(oscillator);
  oscillator.onended = () => activeNodes.delete(oscillator);
}

function scheduleLoop(
  context: AudioContext,
  output: AudioNode,
  start: number,
  activeNodes: Set<OscillatorNode>,
) {
  melody.forEach((frequency, index) => {
    if (!frequency) return;
    scheduleTone(
      context,
      output,
      frequency,
      start + index * STEP_DURATION,
      STEP_DURATION * 0.72,
      'square',
      index % 4 === 0 ? 0.027 : 0.021,
      activeNodes,
    );
  });

  bass.forEach((frequency, index) => {
    scheduleTone(
      context,
      output,
      frequency,
      start + index * STEP_DURATION * 2,
      STEP_DURATION * 1.65,
      'triangle',
      0.038,
      activeNodes,
    );
  });

  [0, 4, 8, 12].forEach((step) => {
    const hitTime = start + step * STEP_DURATION;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(92, hitTime);
    oscillator.frequency.exponentialRampToValueAtTime(42, hitTime + 0.12);
    gain.gain.setValueAtTime(0.052, hitTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, hitTime + 0.15);
    oscillator.connect(gain).connect(output);
    oscillator.start(hitTime);
    oscillator.stop(hitTime + 0.16);
    activeNodes.add(oscillator);
    oscillator.onended = () => activeNodes.delete(oscillator);
  });
}

export function useArcadeAudio() {
  const contextRef = useRef<AudioContext | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const schedulerRef = useRef<number | null>(null);
  const nextLoopAtRef = useRef(0);
  const activeMusicNodesRef = useRef(new Set<OscillatorNode>());
  const enabledRef = useRef(false);
  const toggleInFlightRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const instanceIdRef = useRef(createInstanceId());
  const [enabled, setEnabled] = useState(false);

  const stopMusic = useCallback(() => {
    if (schedulerRef.current !== null) {
      window.clearInterval(schedulerRef.current);
      schedulerRef.current = null;
    }

    const context = contextRef.current;
    const musicGain = musicGainRef.current;
    if (context && musicGain) {
      musicGain.gain.cancelScheduledValues(context.currentTime);
      musicGain.gain.setValueAtTime(Math.max(musicGain.gain.value, 0.0001), context.currentTime);
      musicGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
    }

    activeMusicNodesRef.current.forEach((node) => {
      try {
        node.stop(context ? context.currentTime + 0.18 : undefined);
      } catch {
        // O nó já pode ter terminado naturalmente.
      }
    });
    activeMusicNodesRef.current.clear();
    musicGainRef.current = null;
  }, []);

  const startMusic = useCallback((context: AudioContext) => {
    const musicGain = context.createGain();
    musicGain.gain.setValueAtTime(0.0001, context.currentTime);
    musicGain.gain.exponentialRampToValueAtTime(0.72, context.currentTime + 0.3);
    musicGain.connect(context.destination);
    musicGainRef.current = musicGain;
    nextLoopAtRef.current = context.currentTime + 0.05;

    const scheduleAhead = () => {
      while (nextLoopAtRef.current < context.currentTime + 1.25) {
        scheduleLoop(context, musicGain, nextLoopAtRef.current, activeMusicNodesRef.current);
        nextLoopAtRef.current += LOOP_DURATION;
      }
    };

    scheduleAhead();
    schedulerRef.current = window.setInterval(scheduleAhead, 400);
  }, []);

  const toggle = useCallback(async () => {
    if (toggleInFlightRef.current) return;

    if (enabledRef.current) {
      enabledRef.current = false;
      stopMusic();
      setEnabled(false);
      return;
    }

    toggleInFlightRef.current = true;
    enabledRef.current = true;

    try {
      stopMusic();
      const currentContext = contextRef.current;
      const context = currentContext?.state === 'closed' ? new AudioContext() : (currentContext ?? new AudioContext());
      contextRef.current = context;
      await context.resume();
      channelRef.current?.postMessage({
        type: 'audio-owner',
        owner: instanceIdRef.current,
      });
      startMusic(context);
      setEnabled(true);
    } catch {
      enabledRef.current = false;
      setEnabled(false);
    } finally {
      toggleInFlightRef.current = false;
    }
  }, [startMusic, stopMusic]);

  const playAttack = useCallback(
    (event: CombatEvent) => {
      const context = contextRef.current;
      if (!enabledRef.current || !context) return;

      const now = context.currentTime;
      const duration = event.kind === 'special' || event.kind === 'ko' ? 0.42 : 0.24;
      const oscillator = context.createOscillator();
      const oscillatorGain = context.createGain();
      oscillator.type = event.kind === 'light' ? 'square' : 'sawtooth';
      oscillator.frequency.setValueAtTime(event.kind === 'light' ? 210 : 130, now);
      oscillator.frequency.exponentialRampToValueAtTime(48, now + duration);
      oscillatorGain.gain.setValueAtTime(event.kind === 'ko' ? 0.16 : 0.1, now);
      oscillatorGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      oscillator.connect(oscillatorGain).connect(context.destination);

      const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let index = 0; index < channel.length; index += 1) {
        channel[index] = (Math.random() * 2 - 1) * (1 - index / channel.length);
      }
      const noise = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const noiseGain = context.createGain();
      noise.buffer = buffer;
      filter.type = 'lowpass';
      filter.frequency.value = event.kind === 'special' ? 1_900 : 1_100;
      noiseGain.gain.setValueAtTime(event.kind === 'light' ? 0.07 : 0.12, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      noise.connect(filter).connect(noiseGain).connect(context.destination);

      oscillator.start(now);
      oscillator.stop(now + duration);
      noise.start(now);
    },
    [],
  );

  useEffect(() => {
    const channel = 'BroadcastChannel' in window
      ? new BroadcastChannel('election-2026-audio')
      : null;
    channelRef.current = channel;

    if (channel) {
      channel.onmessage = (message: MessageEvent<{ type?: string; owner?: string }>) => {
        if (message.data.type !== 'audio-owner' || message.data.owner === instanceIdRef.current) return;
        enabledRef.current = false;
        stopMusic();
        setEnabled(false);
      };
    }

    const handleVisibilityChange = () => {
      if (!document.hidden || !enabledRef.current) return;
      enabledRef.current = false;
      stopMusic();
      setEnabled(false);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      channel?.close();
      channelRef.current = null;
      enabledRef.current = false;
      stopMusic();
      const context = contextRef.current;
      contextRef.current = null;
      if (context?.state !== 'closed') void context?.close();
    };
  }, [stopMusic]);

  return { enabled, toggle, playAttack };
}
