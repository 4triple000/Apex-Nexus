/**
 * useShareCard — handles html2canvas capture, copy-as-image, download, native share.
 */
import { useState, useCallback } from "react";

export type ShareCardStatus = "idle" | "generating" | "ready" | "copying" | "copied" | "error";

export function useShareCard() {
  const [status, setStatus] = useState<ShareCardStatus>("idle");
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  /** Render a DOM element to a PNG data-URL using html2canvas (lazy-loaded). */
  const generateImage = useCallback(async (el: HTMLElement): Promise<string | null> => {
    setStatus("generating");
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(el, {
        backgroundColor: "#07080E",
        scale: 2,              // retina quality
        useCORS: true,
        logging: false,
        removeContainer: true,
      });
      const url = canvas.toDataURL("image/png");
      setDataUrl(url);
      setStatus("ready");
      return url;
    } catch (err) {
      console.warn("[useShareCard] html2canvas failed:", err);
      setStatus("error");
      return null;
    }
  }, []);

  /** Copy the generated PNG to the clipboard (ClipboardItem API). */
  const copyAsImage = useCallback(async (url: string) => {
    setStatus("copying");
    try {
      const res  = await fetch(url);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setStatus("copied");
      setTimeout(() => setStatus("ready"), 2200);
    } catch {
      // ClipboardItem not supported — fall back to text copy
      await navigator.clipboard.writeText("Shared via Apex — apex.app");
      setStatus("copied");
      setTimeout(() => setStatus("ready"), 2200);
    }
  }, []);

  /** Trigger a PNG download. */
  const downloadImage = useCallback((url: string, filename = "apex-share.png") => {
    const a = document.createElement("a");
    a.href     = url;
    a.download = filename;
    a.click();
  }, []);

  /** Web Share API (mobile-first native sheet). Falls back to download. */
  const nativeShare = useCallback(async (url: string, text: string) => {
    if (!navigator.share) { downloadImage(url); return; }
    try {
      const res  = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], "apex-share.png", { type: "image/png" });
      await navigator.share({
        title: "Apex AI",
        text,
        files: navigator.canShare?.({ files: [file] }) ? [file] : undefined,
      });
    } catch {
      downloadImage(url);
    }
  }, [downloadImage]);

  return { status, dataUrl, generateImage, copyAsImage, downloadImage, nativeShare };
}
