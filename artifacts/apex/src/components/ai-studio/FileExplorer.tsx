/**
 * FileExplorer — File tree and code viewer for AI Studio.
 *
 * Left section: collapsible file tree grouped by folder
 * Right section: syntax-highlighted code viewer for the selected file
 */

import { useState, useMemo } from "react";

export interface ProjectFile {
  path: string;
  content: string;
  language: string;
}

interface FileExplorerProps {
  files: ProjectFile[];
  onCopyFile?: (file: ProjectFile) => void;
  onDownloadFile?: (file: ProjectFile) => void;
}

// ── Language → color mapping ──────────────────────────────────────────────────

const LANG_COLORS: Record<string, string> = {
  typescript: "#3178c6",
  tsx: "#3178c6",
  javascript: "#f7df1e",
  jsx: "#f7df1e",
  html: "#e34c26",
  css: "#264de4",
  json: "#c2c2c2",
  markdown: "#083fa1",
  python: "#3572A5",
  default: "#6B7280",
};

const LANG_ICONS: Record<string, string> = {
  typescript: "TS",
  tsx: "TSX",
  javascript: "JS",
  jsx: "JSX",
  html: "HTML",
  css: "CSS",
  json: "{}",
  markdown: "MD",
  default: "—",
};

function getLangColor(lang: string) {
  return LANG_COLORS[lang.toLowerCase()] ?? LANG_COLORS.default;
}
function getLangIcon(lang: string) {
  return LANG_ICONS[lang.toLowerCase()] ?? LANG_ICONS.default;
}

// ── Simple syntax highlighter (CSS-based tokenizer) ────────────────────────────

function highlightCode(code: string, lang: string): string {
  // Escape HTML first
  let escaped = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Apply basic token colors for JS/TS
  if (["typescript", "tsx", "javascript", "jsx"].includes(lang.toLowerCase())) {
    escaped = escaped
      // Strings (single, double, backtick)
      .replace(/(&#39;[^&#39;]*&#39;|&quot;[^&quot;]*&quot;|`[^`]*`)/g, '<span style="color:#a5d6ff">$1</span>')
      // Keywords
      .replace(/\b(const|let|var|function|return|import|export|default|from|type|interface|class|extends|implements|async|await|if|else|for|while|switch|case|break|new|this|typeof|instanceof|void|null|undefined|true|false)\b/g, '<span style="color:#ff7b72">$1</span>')
      // Comments
      .replace(/(\/\/[^\n]*)/g, '<span style="color:#8b949e">$1</span>')
      // Function names
      .replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g, '<span style="color:#d2a8ff">$1</span>')
      // Numbers
      .replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#79c0ff">$1</span>');
  }

  if (lang.toLowerCase() === "json") {
    escaped = escaped
      .replace(/("[\w\s]+")\s*:/g, '<span style="color:#7ee787">$1</span>:')
      .replace(/:\s*(".*?")/g, ': <span style="color:#a5d6ff">$1</span>')
      .replace(/:\s*(true|false|null)/g, ': <span style="color:#ff7b72">$1</span>')
      .replace(/:\s*(\d+)/g, ': <span style="color:#79c0ff">$1</span>');
  }

  return escaped;
}

// ── File tree grouping ─────────────────────────────────────────────────────────

interface FileNode {
  name: string;
  path: string;
  file?: ProjectFile;
  children?: FileNode[];
}

function buildFileTree(files: ProjectFile[]): FileNode[] {
  const root: Record<string, FileNode> = {};

  for (const file of files) {
    const parts = file.path.replace(/^\//, "").split("/");
    if (parts.length === 1) {
      root[file.path] = { name: parts[0], path: file.path, file };
    } else {
      const folderName = parts[0];
      if (!root[folderName]) {
        root[folderName] = { name: folderName, path: folderName, children: [] };
      }
      root[folderName].children!.push({
        name: parts.slice(1).join("/"),
        path: file.path,
        file,
      });
    }
  }

  return Object.values(root).sort((a, b) => {
    // Folders first
    if (a.children && !b.children) return -1;
    if (!a.children && b.children) return 1;
    return a.name.localeCompare(b.name);
  });
}

// ── FileExplorer component ─────────────────────────────────────────────────────

export function FileExplorer({ files, onCopyFile, onDownloadFile }: FileExplorerProps) {
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(files[0] ?? null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["src"]));
  const [copied, setCopied] = useState(false);

  const tree = useMemo(() => buildFileTree(files), [files]);

  const handleCopy = () => {
    if (!selectedFile) return;
    void navigator.clipboard.writeText(selectedFile.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopyFile?.(selectedFile);
    });
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Select first file if current selection is gone
  if (files.length > 0 && (!selectedFile || !files.find((f) => f.path === selectedFile.path))) {
    setSelectedFile(files[0]);
  }

  const lines = selectedFile?.content.split("\n") ?? [];

  return (
    <div className="flex h-full" style={{ background: "#0D0D0D" }}>
      {/* File tree sidebar */}
      <div
        className="w-52 flex-shrink-0 flex flex-col border-r overflow-y-auto"
        style={{ background: "#0D0D0D", borderColor: "#1C1C1E" }}
      >
        <div
          className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest border-b flex-shrink-0"
          style={{ color: "rgba(255,255,255,0.3)", borderColor: "#1C1C1E" }}
        >
          Files · {files.length}
        </div>

        {files.length === 0 ? (
          <div className="p-4 text-center text-white/30 text-xs">No files yet</div>
        ) : (
          <div className="py-2">
            {tree.map((node) =>
              node.children ? (
                <FolderNode
                  key={node.path}
                  node={node}
                  expanded={expandedFolders.has(node.name)}
                  onToggle={() => toggleFolder(node.name)}
                  selectedPath={selectedFile?.path}
                  onSelect={setSelectedFile}
                />
              ) : (
                node.file && (
                  <FileNode
                    key={node.path}
                    file={node.file}
                    isSelected={selectedFile?.path === node.path}
                    onSelect={() => setSelectedFile(node.file!)}
                    depth={0}
                  />
                )
              )
            )}
          </div>
        )}
      </div>

      {/* Code viewer */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedFile ? (
          <>
            {/* Code toolbar */}
            <div
              className="flex items-center gap-3 px-4 py-2.5 border-b flex-shrink-0"
              style={{ background: "#0D0D0D", borderColor: "#1C1C1E" }}
            >
              <div
                className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                style={{
                  background: `${getLangColor(selectedFile.language)}22`,
                  color: getLangColor(selectedFile.language),
                  border: `1px solid ${getLangColor(selectedFile.language)}44`,
                }}
              >
                {getLangIcon(selectedFile.language)}
              </div>
              <span className="text-white/70 text-xs font-mono flex-1 truncate">{selectedFile.path}</span>
              <span className="text-white/25 text-[11px] font-mono">{lines.length} lines</span>
              <button
                onClick={handleCopy}
                className="px-2.5 py-1 rounded-lg text-[11px] transition-all"
                style={{
                  background: copied ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
                  color: copied ? "#22c55e" : "rgba(255,255,255,0.4)",
                  border: `1px solid ${copied ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
              {onDownloadFile && (
                <button
                  onClick={() => onDownloadFile(selectedFile)}
                  className="px-2.5 py-1 rounded-lg text-[11px] transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.4)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  ↓
                </button>
              )}
            </div>

            {/* Code content */}
            <div className="flex-1 overflow-auto" style={{ background: "#0D0D0F" }}>
              <table className="w-full border-collapse min-w-full">
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="hover:bg-white/2 group">
                      <td
                        className="select-none pl-4 pr-3 py-0 text-right font-mono text-[11px] leading-5 w-10 flex-shrink-0"
                        style={{ color: "rgba(255,255,255,0.2)", userSelect: "none" }}
                      >
                        {i + 1}
                      </td>
                      <td
                        className="pl-4 py-0 font-mono text-[12px] leading-5 whitespace-pre"
                        style={{ color: "#e6edf3" }}
                        dangerouslySetInnerHTML={{
                          __html: highlightCode(line, selectedFile.language) || "&nbsp;",
                        }}
                      />
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="h-8" />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-white/20 text-sm">
            Select a file to view its code
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FolderNode({
  node,
  expanded,
  onToggle,
  selectedPath,
  onSelect,
}: {
  node: FileNode;
  expanded: boolean;
  onToggle: () => void;
  selectedPath?: string;
  onSelect: (file: ProjectFile) => void;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-3 py-1 text-xs text-white/50 hover:text-white/80 transition-colors"
      >
        <span className="text-[9px] transition-transform" style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
        <span>📁</span>
        <span className="font-medium">{node.name}</span>
      </button>
      {expanded && node.children?.map((child) =>
        child.file ? (
          <FileNode
            key={child.path}
            file={child.file}
            isSelected={selectedPath === child.path}
            onSelect={() => onSelect(child.file!)}
            depth={1}
          />
        ) : null
      )}
    </div>
  );
}

function FileNode({
  file,
  isSelected,
  onSelect,
  depth,
}: {
  file: ProjectFile;
  isSelected: boolean;
  onSelect: () => void;
  depth: number;
}) {
  const fileName = file.path.split("/").pop() ?? file.path;
  const langColor = getLangColor(file.language);

  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-2 py-1 text-xs transition-all text-left"
      style={{
        paddingLeft: 12 + depth * 16,
        background: isSelected ? "rgba(255,204,51,0.08)" : "transparent",
        color: isSelected ? "#FFCC33" : "rgba(255,255,255,0.55)",
        borderRight: isSelected ? "2px solid #FFCC33" : "2px solid transparent",
      }}
    >
      <div
        className="w-4 h-4 rounded text-[7px] flex items-center justify-center font-bold flex-shrink-0"
        style={{ background: `${langColor}22`, color: langColor }}
      >
        {getLangIcon(file.language).slice(0, 2)}
      </div>
      <span className="truncate">{fileName}</span>
    </button>
  );
}
