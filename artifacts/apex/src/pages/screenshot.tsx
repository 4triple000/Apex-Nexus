import { useState, useRef } from "react";
import { useAnalyzeScreenshot } from "@workspace/api-client-react";
import { Search, Loader2, MessageSquarePlus, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Screenshot() {
  const [content, setContent] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analyzeScreenshot = useAnalyzeScreenshot();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max image size is 10MB.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageBase64(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAnalyze = async () => {
    if (!content.trim() && !imageBase64) return;
    try {
      await analyzeScreenshot.mutateAsync({
        data: {
          content: content || undefined,
          imageBase64: imageBase64 ?? undefined,
        } as any,
      });
    } catch {
      toast({ title: "Analysis failed", description: "Could not analyze the content.", variant: "destructive" });
    }
  };

  const canAnalyze = (content.trim().length > 0 || !!imageBase64) && !analyzeScreenshot.isPending;

  return (
    <div className="flex flex-col h-full bg-transparent relative overflow-y-auto pb-24">
      <div className="p-4 border-b border-border/50 sticky top-0 bg-[rgba(14,12,32,0.5)] backdrop-blur-md z-10">
        <h1 className="font-mono font-bold text-xl tracking-tight flex items-center gap-2">
          <span className="text-primary">/</span>
          <span>ANALYZE</span>
        </h1>
        <p className="text-muted-foreground text-xs mt-1">
          Paste text or upload a screenshot — get instant analysis and reply suggestions.
        </p>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Image upload area */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            data-testid="input-image-upload"
            onChange={handleFileChange}
          />

          {imagePreview ? (
            <div className="relative rounded-xl overflow-hidden border border-border bg-card">
              <img
                src={imagePreview}
                alt="Screenshot to analyze"
                className="w-full max-h-60 object-contain bg-black/20"
              />
              <button
                onClick={clearImage}
                data-testid="button-clear-image"
                className="absolute top-2 right-2 bg-[rgba(14,12,32,0.5)] border border-border rounded-full p-1.5 hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-upload-image"
              className="w-full h-28 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-muted/30 transition-all cursor-pointer"
            >
              <ImagePlus className="w-6 h-6" />
              <span className="text-xs font-mono uppercase tracking-widest">Upload Screenshot</span>
              <span className="text-[10px] opacity-60">PNG, JPG, WEBP up to 10MB</span>
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">or paste text</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Text input */}
        <div className="relative">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste raw conversation text here..."
            data-testid="input-screenshot-text"
            className="w-full h-36 bg-card border border-border rounded-xl p-4 text-sm font-mono leading-relaxed resize-none focus:ring-1 focus:ring-primary outline-none transition-shadow"
          />
          <div className="absolute bottom-3 right-3 text-xs text-muted-foreground/50 font-mono">
            {content.length} chars
          </div>
        </div>

        <Button
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          data-testid="button-analyze"
          className="w-full h-12 font-semibold tracking-wide uppercase shadow-lg shadow-primary/20"
        >
          {analyzeScreenshot.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <Search className="w-5 h-5 mr-2" />
          )}
          Decode Intent
        </Button>

        {analyzeScreenshot.data && (
          <div className="mt-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Analysis
              </h3>
              <p className="text-sm leading-relaxed">{analyzeScreenshot.data.analysis}</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-secondary-foreground" />
                Suggested Replies
              </h3>
              {analyzeScreenshot.data.suggestions.map((suggestion, i) => (
                <div
                  key={i}
                  data-testid={`suggestion-${i}`}
                  className="bg-card hover:bg-muted/50 border border-border hover:border-primary/50 transition-colors rounded-xl p-4 cursor-pointer group flex items-start gap-3"
                  onClick={() => {
                    navigator.clipboard.writeText(suggestion);
                    toast({ title: "Copied to clipboard" });
                  }}
                >
                  <MessageSquarePlus className="w-4 h-4 mt-0.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  <p className="text-sm leading-relaxed">{suggestion}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
