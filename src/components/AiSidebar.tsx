import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Send,
  X,
  FileText,
  Database,
  Copy,
  Check,
  PlusCircle,
  RotateCcw,
  Bot,
  User,
  ChevronDown,
} from "lucide-react";
import { marked } from "marked";
import hljs from "highlight.js";
import { invoke } from "@tauri-apps/api/core";
import { ChatMessage, VaultNoteItem } from "../types";

interface AiSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeNoteTitle: string;
  activeNotePath: string | null;
  activeNoteContent: string;
  vaultPath: string;
  onInsertIntoNote: (text: string) => void;
}

export const AiSidebar: React.FC<AiSidebarProps> = ({
  isOpen,
  onClose,
  activeNoteTitle,
  activeNotePath,
  activeNoteContent,
  vaultPath,
  onInsertIntoNote,
}) => {
  const [model, setModel] = useState("gemma4:31b-cloud");
  const [availableModels, setAvailableModels] = useState<string[]>(["gemma4:31b-cloud"]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [includeActiveNote, setIncludeActiveNote] = useState(true);
  const [includeVaultKnowledge, setIncludeVaultKnowledge] = useState(true);
  const [vaultNotes, setVaultNotes] = useState<VaultNoteItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load available Ollama models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const models = await invoke<string[]>("get_ollama_models");
        setAvailableModels(models);
        if (models.includes("gemma4:31b-cloud")) {
          setModel("gemma4:31b-cloud");
        } else if (models.length > 0) {
          setModel(models[0]);
        }
      } catch (e) {
        console.warn("Failed to load models list:", e);
      }
    };
    if (isOpen) {
      loadModels();
    }
  }, [isOpen]);

  // Load all vault notes for context
  useEffect(() => {
    const loadVaultNotes = async () => {
      try {
        const notes = await invoke<VaultNoteItem[]>("get_vault_all_notes", { vaultPath });
        setVaultNotes(notes);
      } catch (e) {
        console.warn("Failed to load vault notes for AI:", e);
      }
    };
    if (isOpen && includeVaultKnowledge) {
      loadVaultNotes();
    }
  }, [isOpen, vaultPath, includeVaultKnowledge]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputText;
    if (!query.trim() || isGenerating) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: query.trim(),
      timestamp: Date.now(),
      referencedNotes: includeActiveNote && activeNotePath ? [activeNotePath] : [],
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText("");
    setIsGenerating(true);

    // Prepare System Prompt with Notes Context
    let systemContext =
      "You are Gemma 4, an intelligent AI assistant integrated natively into Onyx, a pitch-black Markdown note-taking app. You provide direct, elegant, well-structured Markdown answers, code snippets, summaries, and notes.\n";

    if (includeActiveNote && activeNotePath && activeNoteContent) {
      systemContext += `\n--- CURRENT ACTIVE NOTE CONTEXT ---\nTitle: ${activeNoteTitle}\nPath: ${activeNotePath}\nContent:\n${activeNoteContent}\n--- END CURRENT NOTE ---\n`;
    }

    if (includeVaultKnowledge && vaultNotes.length > 0) {
      systemContext += `\n--- USER VAULT NOTES INDEX (${vaultNotes.length} notes available) ---\n`;
      // Include summary list of vault notes
      for (const n of vaultNotes.slice(0, 15)) {
        if (n.path !== activeNotePath) {
          systemContext += `Note: ${n.path}\nSnippet: ${n.content.slice(0, 300).replace(/\n/g, " ")}\n\n`;
        }
      }
      systemContext += `--- END VAULT NOTES ---\n`;
    }

    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    setMessages([...newMessages, assistantMsg]);

    try {
      const ollamaMessages = [
        { role: "system", content: systemContext },
        ...newMessages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const res = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: ollamaMessages,
          stream: true,
        }),
      });

      if (!res.ok) {
        throw new Error(`Ollama error: HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulatedText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.message?.content) {
                accumulatedText += parsed.message.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: accumulatedText } : m
                  )
                );
              }
            } catch {
              // ignore partial line parsing
            }
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: `Error communicating with Ollama (${model}): ${err.message}` }
            : m
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderMarkdownMessage = (content: string) => {
    try {
      const raw = marked.parse(content) as string;
      const div = document.createElement("div");
      div.innerHTML = raw;
      div.querySelectorAll("pre code").forEach((b) => {
        hljs.highlightElement(b as HTMLElement);
      });
      return { __html: div.innerHTML };
    } catch {
      return { __html: content };
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="h-full bg-[#050505] border-l border-[#181818] flex flex-col shrink-0 select-none overflow-hidden relative">
      {/* ─── AI Header ──────────────────────────────────────────────── */}
      <div className="h-11 bg-[#080808] border-b border-[#181818] px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-[#8b5cf6]/10 text-[#a78bfa]">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="relative flex items-center">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-[#121212] border border-[#222] text-[#e0e0e0] font-mono text-[11px] rounded px-2 py-1 pr-6 focus:outline-none focus:border-[#8b5cf6] appearance-none cursor-pointer"
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-[#666] absolute right-1.5 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setMessages([])}
            title="Clear Chat History"
            className="p-1.5 text-[#666] hover:text-white rounded hover:bg-[#161616] transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            title="Close AI Assistant"
            className="p-1.5 text-[#666] hover:text-white rounded hover:bg-[#161616] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── Context Toggles ────────────────────────────────────────── */}
      <div className="px-3 py-2 bg-[#060606] border-b border-[#141414] flex items-center gap-3 text-[11px]">
        <label className="flex items-center gap-1.5 cursor-pointer text-[#888] hover:text-white">
          <input
            type="checkbox"
            checked={includeActiveNote}
            onChange={(e) => setIncludeActiveNote(e.target.checked)}
            className="rounded bg-[#121212] border-[#2a2a2a] text-[#8b5cf6] focus:ring-0"
          />
          <FileText className="w-3 h-3 text-[#a78bfa]" />
          <span className="truncate max-w-[110px]" title={activeNoteTitle}>
            {activeNoteTitle || "Active Note"}
          </span>
        </label>

        <label className="flex items-center gap-1.5 cursor-pointer text-[#888] hover:text-white">
          <input
            type="checkbox"
            checked={includeVaultKnowledge}
            onChange={(e) => setIncludeVaultKnowledge(e.target.checked)}
            className="rounded bg-[#121212] border-[#2a2a2a] text-[#8b5cf6] focus:ring-0"
          />
          <Database className="w-3 h-3 text-[#38bdf8]" />
          <span>Vault ({vaultNotes.length})</span>
        </label>
      </div>

      {/* ─── Messages Thread ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 select-text">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-[#555]">
            <div className="w-10 h-10 rounded-xl bg-[#0d0d0d] border border-[#1f1f1f] flex items-center justify-center text-[#8b5cf6] mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-semibold text-[#888] mb-1">Gemma 4 AI Note Assistant</h4>
            <p className="text-[11px] text-[#555] max-w-xs mb-4">
              Ask questions about your notes, summarize documents, or generate new markdown.
            </p>

            {/* Quick Prompt Chips */}
            <div className="w-full space-y-1.5 text-left">
              <button
                onClick={() => handleSendMessage(`Summarize the current note "${activeNoteTitle}" with key takeaways.`)}
                className="w-full text-left p-2 rounded-lg bg-[#0d0d0d] hover:bg-[#141414] border border-[#1c1c1c] text-[11px] text-[#aaa] hover:text-white transition flex items-center gap-2"
              >
                <span>⚡</span>
                <span className="truncate">Summarize this note</span>
              </button>
              <button
                onClick={() => handleSendMessage(`Extract actionable todos and checklist from "${activeNoteTitle}".`)}
                className="w-full text-left p-2 rounded-lg bg-[#0d0d0d] hover:bg-[#141414] border border-[#1c1c1c] text-[11px] text-[#aaa] hover:text-white transition flex items-center gap-2"
              >
                <span>📋</span>
                <span className="truncate">Extract action items & checklist</span>
              </button>
              <button
                onClick={() => handleSendMessage(`Explain the key concepts discussed in "${activeNoteTitle}" in simple terms.`)}
                className="w-full text-left p-2 rounded-lg bg-[#0d0d0d] hover:bg-[#141414] border border-[#1c1c1c] text-[11px] text-[#aaa] hover:text-white transition flex items-center gap-2"
              >
                <span>💡</span>
                <span className="truncate">Explain key concepts</span>
              </button>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-[#666] font-mono">
                {m.role === "user" ? (
                  <>
                    <User className="w-3 h-3 text-[#a78bfa]" />
                    <span>You</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-3 h-3 text-[#38bdf8]" />
                    <span>Gemma 4</span>
                  </>
                )}
              </div>

              <div
                className={`p-3 rounded-lg text-xs leading-relaxed ${
                  m.role === "user"
                    ? "bg-[#111111] border border-[#1f1f1f] text-[#e0e0e0]"
                    : "bg-[#090909] border border-[#1a1a1a] text-[#d4d4d4]"
                }`}
              >
                {m.role === "user" ? (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                ) : (
                  <div>
                    <div
                      className="markdown-body text-xs"
                      dangerouslySetInnerHTML={renderMarkdownMessage(m.content)}
                    />

                    {/* Message Actions */}
                    {m.content && !isGenerating && (
                      <div className="mt-2.5 pt-2 border-t border-[#1a1a1a] flex items-center justify-end gap-2">
                        <button
                          onClick={() => onInsertIntoNote(`\n\n${m.content}\n`)}
                          title="Insert this response into the current note"
                          className="flex items-center gap-1 text-[10px] text-[#a78bfa] hover:text-white px-2 py-1 rounded bg-[#8b5cf6]/10 hover:bg-[#8b5cf6]/20 transition"
                        >
                          <PlusCircle className="w-3 h-3" />
                          <span>Insert to Note</span>
                        </button>

                        <button
                          onClick={() => handleCopy(m.id, m.content)}
                          title="Copy response"
                          className="flex items-center gap-1 text-[10px] text-[#777] hover:text-white px-2 py-1 rounded hover:bg-[#181818] transition"
                        >
                          {copiedId === m.id ? (
                            <Check className="w-3 h-3 text-[#10b981]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>Copy</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ─── Input Bar ──────────────────────────────────────────────── */}
      <div className="p-3 bg-[#080808] border-t border-[#181818] shrink-0">
        <div className="relative flex items-center">
          <textarea
            ref={inputRef}
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${model} about your notes...`}
            className="w-full bg-[#121212] border border-[#222] rounded-lg p-2.5 pr-10 text-xs text-[#e0e0e0] placeholder-[#555] focus:outline-none focus:border-[#8b5cf6] resize-none"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isGenerating}
            title="Send Message"
            className="absolute right-2 p-1.5 text-white bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:opacity-40 rounded-md transition shadow-md"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
