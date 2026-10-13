import React, { useState, useEffect, useRef } from "react";
import {
  Globe,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Search,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface WebTabProps {
  url: string;
  onUrlChange: (url: string) => void;
  onTitleChange?: (title: string) => void;
}

export const WebTab: React.FC<WebTabProps> = ({
  url,
  onUrlChange,
  onTitleChange,
}) => {
  const [inputUrl, setInputUrl] = useState(url);
  const [activeUrl, setActiveUrl] = useState(url);
  const [copied, setCopied] = useState(false);
  const [useProxy, setUseProxy] = useState(false);
  const [proxyHtml, setProxyHtml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([url]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setInputUrl(url);
    setActiveUrl(url);
  }, [url]);

  const normalizeUrl = (raw: string): string => {
    let clean = raw.trim();
    if (!clean) return "https://google.com";
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      if (clean.includes(".") && !clean.includes(" ")) {
        clean = `https://${clean}`;
      } else {
        clean = `https://duckduckgo.com/?q=${encodeURIComponent(clean)}`;
      }
    }
    return clean;
  };

  const navigateTo = async (targetUrl: string) => {
    const finalUrl = normalizeUrl(targetUrl);
    setInputUrl(finalUrl);
    setActiveUrl(finalUrl);
    onUrlChange(finalUrl);

    // Update history
    const nextHistory = [...history.slice(0, historyIndex + 1), finalUrl];
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);

    if (onTitleChange) {
      try {
        const host = new URL(finalUrl).hostname;
        onTitleChange(host);
      } catch {
        onTitleChange(finalUrl);
      }
    }

    if (useProxy) {
      loadProxyContent(finalUrl);
    }
  };

  const loadProxyContent = async (target: string) => {
    setLoading(true);
    try {
      const html = await invoke<string>("fetch_web_page", { url: target });
      setProxyHtml(html);
    } catch (e) {
      setProxyHtml(`<div style="color:red;padding:20px;">Failed to fetch webpage: ${e}</div>`);
    } finally {
      setLoading(false);
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
    if (useProxy) {
      loadProxyContent(activeUrl);
    } else if (iframeRef.current) {
      iframeRef.current.src = activeUrl;
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openExternal = async () => {
    try {
      await invoke("plugin:opener|open_url", { url: activeUrl });
    } catch {
      window.open(activeUrl, "_blank");
    }
  };

  const quickBookmarks = [
    { label: "Google", url: "https://google.com" },
    { label: "GitHub", url: "https://github.com" },
    { label: "Rust Docs", url: "https://docs.rs" },
    { label: "Wikipedia", url: "https://en.wikipedia.org" },
    { label: "ArXiv", url: "https://arxiv.org" },
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
            placeholder="Paste URL or search the web..."
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

        {/* Right Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const next = !useProxy;
              setUseProxy(next);
              if (next) loadProxyContent(activeUrl);
            }}
            title={useProxy ? "Using Rust Web Proxy (bypasses CSP/CORS)" : "Using Direct Webview"}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded transition ${
              useProxy
                ? "bg-[#8b5cf6]/20 text-[#a78bfa] border border-[#8b5cf6]/40"
                : "text-[#777] hover:text-white hover:bg-[#161616]"
            }`}
          >
            <ShieldCheck className="w-3 h-3" />
            <span>Proxy</span>
          </button>

          <button
            onClick={copyUrl}
            title="Copy URL to clipboard"
            className="p-1.5 text-[#777] hover:text-white rounded hover:bg-[#161616] transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#10b981]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={openExternal}
            title="Open in System Browser"
            className="p-1.5 text-[#777] hover:text-white rounded hover:bg-[#161616] transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ─── Bookmarks Bar ───────────────────────────────────────────── */}
      <div className="h-7 bg-[#050505] border-b border-[#141414] px-3 flex items-center gap-2 overflow-x-auto text-[11px]">
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

      {/* ─── Webview Content Frame ───────────────────────────────────── */}
      <div className="flex-1 w-full h-full relative bg-[#0a0a0a]">
        {useProxy ? (
          <iframe
            srcDoc={proxyHtml}
            title="Web Page Proxy"
            className="w-full h-full border-none bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <iframe
            ref={iframeRef}
            src={activeUrl}
            title="Web Page"
            className="w-full h-full border-none bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        )}
      </div>
    </div>
  );
};
