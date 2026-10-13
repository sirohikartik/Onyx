import React, { useState, useEffect, useRef } from "react";
import {
  Globe,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  ExternalLink,
  Copy,
  Check,
  BookOpen,
  Zap,
  Download,
  AlertCircle,
  Search,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface WebTabProps {
  url: string;
  onUrlChange: (url: string) => void;
  onTitleChange?: (title: string) => void;
  onSaveAsNote?: (title: string, content: string) => void;
}

export const WebTab: React.FC<WebTabProps> = ({
  url,
  onUrlChange,
  onTitleChange,
  onSaveAsNote,
}) => {
  const [inputUrl, setInputUrl] = useState(url);
  const [activeUrl, setActiveUrl] = useState(url);
  const [viewMode, setViewMode] = useState<"embedded" | "reader">("embedded");
  const [readerHtml, setReaderHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [history, setHistory] = useState<string[]>([url]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setInputUrl(url);
    setActiveUrl(url);
    setIframeError(false);
  }, [url]);

  const normalizeUrl = (raw: string): string => {
    let clean = raw.trim();
    if (!clean) return "https://google.com";
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      if (clean.includes(".") && !clean.includes(" ")) {
        clean = `https://${clean}`;
      } else {
        clean = `https://duckduckgo.com/html/?q=${encodeURIComponent(clean)}`;
      }
    }
    return clean;
  };

  const navigateTo = async (targetUrl: string, forceMode?: "embedded" | "reader") => {
    const finalUrl = normalizeUrl(targetUrl);
    setInputUrl(finalUrl);
    setActiveUrl(finalUrl);
    setIframeError(false);
    onUrlChange(finalUrl);

    // Update history
    const nextHistory = [...history.slice(0, historyIndex + 1), finalUrl];
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);

    const mode = forceMode || viewMode;

    try {
      const host = new URL(finalUrl).hostname;
      if (onTitleChange) onTitleChange(host);
    } catch {
      if (onTitleChange) onTitleChange(finalUrl);
    }

    if (mode === "reader") {
      loadReaderContent(finalUrl);
    }
  };

  const loadReaderContent = async (target: string) => {
    setLoading(true);
    try {
      const html = await invoke<string>("fetch_web_reader", { url: target });
      setReaderHtml(html);
      setViewMode("reader");
    } catch (e) {
      setReaderHtml(`<div style="color:#ef4444;padding:30px;background:#000;">Failed to load reader mode: ${e}</div>`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNativeWindow = async () => {
    try {
      await invoke("open_native_webview", {
        url: activeUrl,
        title: inputUrl,
      });
    } catch (e) {
      console.error("Failed to open native webview:", e);
      // Fallback to system browser
      window.open(activeUrl, "_blank");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      navigateTo(inputUrl);
    }
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setInputUrl(prev);
      setActiveUrl(prev);
      onUrlChange(prev);
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setInputUrl(next);
      setActiveUrl(next);
      onUrlChange(next);
    }
  };

  const handleReload = () => {
    if (viewMode === "reader") {
      loadReaderContent(activeUrl);
    } else if (iframeRef.current) {
      setIframeError(false);
      iframeRef.current.src = activeUrl;
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const quickBookmarks = [
    { label: "Wikipedia", url: "https://en.wikipedia.org" },
    { label: "Rust Docs", url: "https://docs.rs" },
    { label: "DuckDuckGo", url: "https://duckduckgo.com/html" },
    { label: "ArXiv", url: "https://arxiv.org" },
    { label: "GitHub", url: "https://github.com" },
    { label: "Google", url: "https://google.com" },
    { label: "Hacker News", url: "https://news.ycombinator.com" },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[#000000] overflow-hidden select-none">
      {/* ─── Browser Navigation Bar ──────────────────────────────────── */}
      <div className="h-11 bg-[#070707] border-b border-[#181818] px-3 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={handleBack}
            disabled={historyIndex === 0}
            title="Back"
            className="p-1.5 text-[#777] hover:text-white disabled:opacity-30 rounded hover:bg-[#161616] transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleForward}
            disabled={historyIndex >= history.length - 1}
            title="Forward"
            className="p-1.5 text-[#777] hover:text-white disabled:opacity-30 rounded hover:bg-[#161616] transition"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleReload}
            title="Reload Page"
            className="p-1.5 text-[#777] hover:text-white rounded hover:bg-[#161616] transition"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Omnibox URL Input */}
        <div className="flex-1 max-w-2xl relative flex items-center">
          <Globe className="w-3.5 h-3.5 text-[#666] absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter URL or search query..."
            className="w-full bg-[#111111] border border-[#202020] rounded-lg py-1.5 pl-8 pr-8 text-xs text-[#e0e0e0] font-mono placeholder-[#555] focus:outline-none focus:border-[#8b5cf6] transition"
          />
          <button
            onClick={() => navigateTo(inputUrl)}
            title="Navigate"
            className="absolute right-2 text-[#666] hover:text-[#8b5cf6] p-1"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Native Webview Button: 100% works for ANY website */}
          <button
            onClick={handleOpenNativeWindow}
            title="Open in Native Webview Window (100% site compatibility without X-Frame-Options blocks)"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-[#8b5cf6]/20 hover:bg-[#8b5cf6]/30 border border-[#8b5cf6]/40 text-[#a78bfa] transition font-medium"
          >
            <Zap className="w-3 h-3 text-[#a78bfa]" />
            <span>Native Window</span>
          </button>

          {/* Reader Mode Toggle */}
          <button
            onClick={() => {
              if (viewMode === "reader") {
                setViewMode("embedded");
              } else {
                loadReaderContent(activeUrl);
              }
            }}
            title={viewMode === "reader" ? "Switch to Embedded View" : "Extract Clean Reader Mode"}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition ${
              viewMode === "reader"
                ? "bg-[#222222] text-white border border-[#333]"
                : "text-[#777] hover:text-white hover:bg-[#161616]"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reader</span>
          </button>

          <button
            onClick={copyUrl}
            title="Copy URL"
            className="p-1.5 text-[#777] hover:text-white rounded hover:bg-[#161616] transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#10b981]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => window.open(activeUrl, "_blank")}
            title="Open in System Browser"
            className="p-1.5 text-[#777] hover:text-white rounded hover:bg-[#161616] transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ─── Bookmarks Bar ───────────────────────────────────────────── */}
      <div className="h-7 bg-[#050505] border-b border-[#141414] px-3 flex items-center justify-between overflow-x-auto text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-[#555] font-mono text-[10px] uppercase">Quick:</span>
          {quickBookmarks.map((bm) => (
            <button
              key={bm.label}
              onClick={() => navigateTo(bm.url)}
              className="px-2 py-0.5 rounded text-[#888] hover:text-[#e0e0e0] hover:bg-[#121212] transition"
            >
              {bm.label}
            </button>
          ))}
        </div>

        {viewMode === "reader" && onSaveAsNote && (
          <button
            onClick={() => {
              const title = `Web - ${inputUrl.split("/").pop() || "Article"}`;
              onSaveAsNote(title, `# Source: ${activeUrl}\n\n${readerHtml.replace(/<[^>]*>?/gm, "")}`);
            }}
            className="flex items-center gap-1 text-[11px] text-[#a78bfa] hover:text-white"
          >
            <Download className="w-3 h-3" />
            <span>Save to Vault</span>
          </button>
        )}
      </div>

      {/* ─── Web Content Pane ────────────────────────────────────────── */}
      <div className="flex-1 w-full h-full relative bg-[#0a0a0a] overflow-hidden">
        {viewMode === "reader" ? (
          <iframe
            srcDoc={readerHtml}
            title="Onyx Dark Reader"
            className="w-full h-full border-none bg-black"
            sandbox="allow-same-origin allow-popups"
          />
        ) : (
          <>
            <iframe
              ref={iframeRef}
              src={activeUrl}
              title="Web Page"
              onError={() => setIframeError(true)}
              className="w-full h-full border-none bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />

            {/* Informative Floating Banner for sites that block frames */}
            {iframeError && (
              <div className="absolute inset-x-8 top-8 z-30 p-5 rounded-xl bg-[#0e0e0e]/95 border border-[#2a2a2a] backdrop-blur-md shadow-2xl flex flex-col items-center text-center max-w-lg mx-auto space-y-3">
                <div className="w-10 h-10 rounded-full bg-[#ef4444]/10 text-[#f87171] flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    This site restricts in-app iframe embedding
                  </h4>
                  <p className="text-xs text-[#888] mt-1 leading-relaxed">
                    Websites like Google, GitHub, and Twitter send security headers (<code className="text-[#a78bfa]">X-Frame-Options</code>) that prevent browser iframes.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleOpenNativeWindow}
                    className="px-4 py-2 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition shadow-lg shadow-[#8b5cf6]/20"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Open in Native Webview Window</span>
                  </button>
                  <button
                    onClick={() => loadReaderContent(activeUrl)}
                    className="px-3.5 py-2 bg-[#1c1c1c] hover:bg-[#282828] text-[#e0e0e0] text-xs font-medium rounded-lg transition flex items-center gap-1.5"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Reader Mode</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
