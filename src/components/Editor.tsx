import React, { useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface EditorProps {
  content: string;
  onChange: (newContent: string) => void;
  onSave: () => void;
  onImageInserted: () => void;
  vaultPath: string;
  onCursorChange?: (line: number, col: number) => void;
}

export const Editor: React.FC<EditorProps> = ({
  content,
  onChange,
  onSave,
  onImageInserted,
  vaultPath,
  onCursorChange,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // Sync gutter scroll with textarea
  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const lineCount = Math.max(1, content.split("\n").length);
  const linesArray = Array.from({ length: lineCount }, (_, i) => i + 1);

  const updateCursorPosition = () => {
    if (!textareaRef.current || !onCursorChange) return;
    const text = textareaRef.current.value;
    const selStart = textareaRef.current.selectionStart;
    const linesBefore = text.substring(0, selStart).split("\n");
    const currentLine = linesBefore.length;
    const currentCol = linesBefore[linesBefore.length - 1].length + 1;
    onCursorChange(currentLine, currentCol);
  };

  const insertTextAtCursor = (textToInsert: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const newText = text.substring(0, start) + textToInsert + text.substring(end);
    onChange(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
      updateCursorPosition();
    }, 10);
  };

  const wrapSelection = (prefix: string, suffix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    const newText = text.substring(0, start) + prefix + selected + suffix + text.substring(end);
    onChange(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
      updateCursorPosition();
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Cmd+S: Save
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      onSave();
      return;
    }

    // Cmd+B: Bold
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      wrapSelection("**", "**");
      return;
    }

    // Cmd+I: Italic
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
      e.preventDefault();
      wrapSelection("*", "*");
      return;
    }

    // Tab: 2 spaces
    if (e.key === "Tab") {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;

      if (e.shiftKey) {
        // Unindent line
        const lastLineStart = text.lastIndexOf("\n", start - 1) + 1;
        if (text.substring(lastLineStart, lastLineStart + 2) === "  ") {
          const newText = text.substring(0, lastLineStart) + text.substring(lastLineStart + 2);
          onChange(newText);
          setTimeout(() => {
            textarea.setSelectionRange(Math.max(0, start - 2), Math.max(0, end - 2));
          }, 0);
        }
      } else {
        // Indent 2 spaces
        const newText = text.substring(0, start) + "  " + text.substring(end);
        onChange(newText);
        setTimeout(() => {
          textarea.setSelectionRange(start + 2, start + 2);
        }, 0);
      }
      return;
    }
  };

  // Image Paste Handler
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64Data = reader.result as string;
            const relPath = await invoke<string>("save_pasted_image", {
              imageBase64: base64Data,
              filenameHint: null,
              vaultPath: vaultPath,
            });

            insertTextAtCursor(`\n![${relPath.replace("attachments/", "")}](${relPath})\n`);
            onImageInserted();
          } catch (err) {
            console.error("Failed to save pasted image:", err);
          }
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  // Drag and Drop Image Handler
  const handleDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64Data = reader.result as string;
            const relPath = await invoke<string>("save_pasted_image", {
              imageBase64: base64Data,
              filenameHint: file.name,
              vaultPath: vaultPath,
            });
            insertTextAtCursor(`\n![${file.name}](${relPath})\n`);
            onImageInserted();
          } catch (err) {
            console.error("Failed to save dropped image:", err);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  useEffect(() => {
    updateCursorPosition();
  }, [content]);

  return (
    <div className="flex w-full h-full bg-[#000000] overflow-hidden relative">
      {/* Line Numbers Gutter */}
      <div
        ref={gutterRef}
        className="w-12 py-6 select-none bg-[#020202] text-[#333333] text-right pr-3 font-mono text-[13px] leading-[1.65] overflow-hidden border-r border-[#121212]"
      >
        {linesArray.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>

      {/* Editor Body */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onKeyUp={updateCursorPosition}
        onClick={updateCursorPosition}
        onScroll={handleScroll}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        placeholder="Start typing markdown, or paste images with Cmd+V..."
        spellCheck={false}
        className="editor-textarea flex-1 h-full py-6 px-6 bg-[#000000] text-[#e0e0e0] font-mono text-[14px] leading-[1.65] outline-none border-none resize-none overflow-y-auto selection:bg-[#33334d]"
      />
    </div>
  );
};
