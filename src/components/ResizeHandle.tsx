import React, { useState, useEffect, useCallback } from "react";

interface ResizeHandleProps {
  onResize: (newWidth: number) => void;
  direction: "left" | "right"; // 'left' means dragging affects the element to the left
  minWidth?: number;
  maxWidth?: number;
  initialWidth: number;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  onResize,
  direction,
  minWidth = 180,
  maxWidth = 600,
  initialWidth,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentWidth, setCurrentWidth] = useState(initialWidth);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setStartX(e.clientX);
    setCurrentWidth(initialWidth);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - startX;
      let newWidth = direction === "left" ? currentWidth + deltaX : currentWidth - deltaX;
      if (newWidth < minWidth) newWidth = minWidth;
      if (newWidth > maxWidth) newWidth = maxWidth;
      onResize(newWidth);
    },
    [isDragging, startX, currentWidth, direction, minWidth, maxWidth, onResize]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`w-1 hover:w-1.5 transition-all cursor-col-resize z-20 shrink-0 select-none ${
        isDragging
          ? "bg-[#8b5cf6] w-1.5"
          : "bg-transparent hover:bg-[#8b5cf6]/50"
      }`}
      title="Drag to resize sidebar"
    />
  );
};
