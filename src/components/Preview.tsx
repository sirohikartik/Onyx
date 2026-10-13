import React, { useEffect, useState, useMemo } from "react";
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import { invoke } from "@tauri-apps/api/core";
import { X } from "lucide-react";

interface PreviewProps {
  content: string;
  vaultPath: string;
  onToggleTask?: (taskIndex: number) => void;
}

export const Preview: React.FC<PreviewProps> = ({
  content,
  vaultPath,
  onToggleTask,
}) => {
  const [imageCache, setImageCache] = useState<Record<string, string>>({});
  const [lightboxImg, setLightboxImg] = useState<{ src: string; alt: string } | null>(null);

  // Configure marked
  useEffect(() => {
    marked.setOptions({
      gfm: true,
      breaks: true,
    });
  }, []);

  // Parse markdown into HTML
  const rawHtml = useMemo(() => {
    try {
      return marked.parse(content) as string;
    } catch {
      return "<p>Error rendering markdown</p>";
    }
  }, [content]);

  // Extract all image sources from content to preload them via Rust
  useEffect(() => {
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    const pathsToLoad: string[] = [];

    while ((match = imgRegex.exec(content)) !== null) {
      const src = match[2].trim();
      if (!src.startsWith("http://") && !src.startsWith("https://") && !src.startsWith("data:")) {
        pathsToLoad.push(src);
      }
    }

    pathsToLoad.forEach(async (path) => {
      // Decode URI components if URL encoded
      const cleanPath = decodeURIComponent(path);
      if (!imageCache[cleanPath]) {
        try {
          const b64 = await invoke<string>("read_image_base64", {
            relativePath: cleanPath,
            vaultPath,
          });
          setImageCache((prev) => ({ ...prev, [cleanPath]: b64 }));
        } catch (err) {
          console.warn("Could not load image:", cleanPath, err);
        }
      }
    });
  }, [content, vaultPath]);

  // Replace relative image srcs in HTML with base64 cached versions
  const processedHtml = useMemo(() => {
    let html = rawHtml;

    // Syntax highlight code blocks
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    tempDiv.querySelectorAll("pre code").forEach((block) => {
      hljs.highlightElement(block as HTMLElement);
    });

    // Replace images with cached base64
    tempDiv.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src") || "";
      const decodedSrc = decodeURIComponent(src);
      if (imageCache[decodedSrc]) {
        img.src = imageCache[decodedSrc];
      }
      img.setAttribute("loading", "lazy");
      img.style.cursor = "zoom-in";
    });

    return tempDiv.innerHTML;
  }, [rawHtml, imageCache]);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // Handle Image Click -> Lightbox
    if (target.tagName.toLowerCase() === "img") {
      const img = target as HTMLImageElement;
      setLightboxImg({ src: img.src, alt: img.alt });
      return;
    }

    // Handle Task Checkbox Click
    if (target.tagName.toLowerCase() === "input" && (target as HTMLInputElement).type === "checkbox") {
      if (onToggleTask) {
        // Find which checkbox index was clicked
        const container = e.currentTarget;
        const allCheckboxes = Array.from(container.querySelectorAll('input[type="checkbox"]'));
        const index = allCheckboxes.indexOf(target as HTMLInputElement);
        if (index !== -1) {
          onToggleTask(index);
        }
      }
    }
  };

  return (
    <div className="w-full h-full bg-[#000000] overflow-y-auto py-6 px-10 text-[#d4d4d4] select-text">
      <div
        className="markdown-body max-w-4xl mx-auto pb-24"
        dangerouslySetInnerHTML={{ __html: processedHtml }}
        onClick={handleContainerClick}
      />

      {/* Lightbox Modal */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
          onClick={() => setLightboxImg(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setLightboxImg(null)}
              className="absolute -top-10 right-0 p-1.5 text-[#aaaaaa] hover:text-white rounded-full bg-[#1c1c1c] hover:bg-[#2c2c2c] transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImg.src}
              alt={lightboxImg.alt}
              className="max-w-full max-h-[85vh] object-contain rounded-md shadow-2xl border border-[#222]"
            />
            {lightboxImg.alt && (
              <p className="mt-3 text-xs text-[#888888] font-mono">{lightboxImg.alt}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
