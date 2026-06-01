import { useEffect, useRef } from "react";

export interface Visemes {
  jawOpen: number;
  volume: number;
}

export function useVoiceLipSync(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  setVisemes: (v: Visemes) => void,
) {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!audioRef.current) return;

    let audioCtx: AudioContext;
    let source: MediaElementAudioSourceNode;
    let analyser: AnalyserNode;

    try {
      audioCtx = new AudioContext();
      source = audioCtx.createMediaElementSource(audioRef.current);
      analyser = audioCtx.createAnalyser();

      analyser.fftSize = 512;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);

      analyserRef.current = analyser;
      ctxRef.current = audioCtx;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const analyze = () => {
        analyser.getByteFrequencyData(dataArray);

        const sum = dataArray.reduce((a, b) => a + b, 0);
        const avg = sum / dataArray.length;
        const normalizedVolume = Math.min(avg / 80, 1);

        setVisemes({
          jawOpen: Math.min(normalizedVolume * 1.5, 1),
          volume: normalizedVolume,
        });

        rafRef.current = requestAnimationFrame(analyze);
      };

      analyze();
    } catch {
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (ctxRef.current && ctxRef.current.state !== "closed") {
        ctxRef.current.close();
      }
    };
  }, [audioRef, setVisemes]);
}

export function useSimulatedLipSync(
  active: boolean,
  setVisemes: (v: Visemes) => void,
) {
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setVisemes({ jawOpen: 0, volume: 0 });
      return;
    }

    let t = 0;
    const animate = () => {
      t += 0.08;
      const base = Math.abs(Math.sin(t * 2.3)) * 0.7;
      const noise = Math.abs(Math.sin(t * 7.1)) * 0.3;
      const jawOpen = Math.min(base + noise, 1) * (0.5 + Math.sin(t * 0.5) * 0.3);
      setVisemes({ jawOpen, volume: jawOpen });
      rafRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active, setVisemes]);
}
