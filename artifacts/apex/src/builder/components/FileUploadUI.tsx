/**
 * FileUploadUI — Canvas component for file/image uploading
 * Real GCS-backed uploads via presigned URLs.
 * Shows drag-and-drop zone + upload progress + gallery of uploaded files.
 */
import { useState, useRef, useCallback } from "react";
import { uploadFile, formatFileSize, ACCEPT_TYPES, type UploadedFile, type UploadProgress } from "../fileStorage";

const GRAD   = "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)";
const PURPLE = "#A29BFE";
const GREEN  = "#55EFC4";
const PINK   = "#FD79A8";
const CYAN   = "#00D2D3";

interface UploadItem {
  id:       string;
  file:     UploadedFile | null;
  name:     string;
  progress: number;
  error:    string | null;
  status:   "uploading" | "done" | "error";
}

export default function FileUploadUI() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setUploads(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
  }, []);

  const processFile = useCallback(async (f: File) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item: UploadItem = { id, file: null, name: f.name, progress: 0, error: null, status: "uploading" };
    setUploads(prev => [item, ...prev]);

    try {
      const onProgress = (p: UploadProgress) => updateItem(id, { progress: p.percent });
      const uploaded = await uploadFile(f, onProgress);
      updateItem(id, { file: uploaded, status: "done", progress: 100 });
    } catch (e) {
      updateItem(id, { error: (e as Error).message, status: "error" });
    }
  }, [updateItem]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files).slice(0, 5)) {
      void processFile(f);
    }
  }, [processFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const isImage = (ct: string) => ct.startsWith("image/");

  return (
    <div style={{ background: "#0A0A12", borderRadius: 12, overflow: "hidden" }}
         onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div style={{ background: "rgba(108,92,231,0.1)", padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14 }}>📁</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: "#E8EAED" }}>File Storage</span>
        <span style={{ marginLeft: "auto", fontSize: 8, color: "rgba(255,255,255,0.25)" }}>GCS-backed</span>
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        style={{
          margin: 10,
          border: `2px dashed ${dragging ? PURPLE : "rgba(255,255,255,0.1)"}`,
          borderRadius: 10,
          padding: "14px 8px",
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? "rgba(162,155,254,0.05)" : "transparent",
          transition: "all 0.2s",
        }}
      >
        <div style={{ fontSize: 22, marginBottom: 6 }}>☁️</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: PURPLE }}>Drop files here</div>
        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>or tap to browse · up to 50MB</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_TYPES.any}
          style={{ display: "none" }}
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {/* Upload list */}
      {uploads.length > 0 && (
        <div style={{ padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
          {uploads.slice(0, 6).map(item => (
            <div key={item.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 9, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px" }}>
                {/* Thumbnail or icon */}
                {item.file && isImage(item.file.contentType) ? (
                  <img src={item.file.publicUrl} alt={item.name} style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(162,155,254,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
                    {item.status === "error" ? "❌" : item.status === "uploading" ? "⬆️" : "📄"}
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#E8EAED", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                  {item.file && (
                    <div style={{ fontSize: 7, color: "rgba(255,255,255,0.3)" }}>{formatFileSize(item.file.size)}</div>
                  )}
                  {item.error && (
                    <div style={{ fontSize: 7, color: PINK }}>{item.error}</div>
                  )}
                </div>

                <div style={{ fontSize: 8, fontWeight: 700, color: item.status === "done" ? GREEN : item.status === "error" ? PINK : CYAN, flexShrink: 0 }}>
                  {item.status === "done" ? "✓" : item.status === "error" ? "✕" : `${item.progress}%`}
                </div>
              </div>

              {/* Progress bar */}
              {item.status === "uploading" && (
                <div style={{ height: 2, background: "rgba(255,255,255,0.05)" }}>
                  <div style={{ height: "100%", width: `${item.progress}%`, background: GRAD, transition: "width 0.3s ease" }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {uploads.length === 0 && (
        <div style={{ textAlign: "center", padding: "8px 12px 12px", fontSize: 8, color: "rgba(255,255,255,0.2)" }}>
          Images, videos, PDFs — all stored in the cloud
        </div>
      )}
    </div>
  );
}
