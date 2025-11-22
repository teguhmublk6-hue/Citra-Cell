
"use client";

import { useState, useRef, type TouchEvent, type MouseEvent } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function FloatingBackButton() {
  const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 150 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const nodeRef = useRef<HTMLButtonElement>(null);

  const handleDragStart = (clientX: number, clientY: number) => {
    if (!nodeRef.current) return;
    setIsDragging(true);
    const { left, top } = nodeRef.current.getBoundingClientRect();
    dragStartPos.current = {
      x: clientX - left,
      y: clientY - top,
    };
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;

    let newX = clientX - dragStartPos.current.x;
    let newY = clientY - dragStartPos.current.y;

    // Clamp position to be within the viewport
    newX = Math.max(16, Math.min(newX, window.innerWidth - (nodeRef.current?.offsetWidth || 0) - 16));
    newY = Math.max(16, Math.min(newY, window.innerHeight - (nodeRef.current?.offsetHeight || 0) - 16));

    setPosition({ x: newX, y: newY });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleClick = () => {
    if (!isDragging) {
        // Only navigate if it wasn't a drag
        setTimeout(() => {
            if (!isDragging) window.history.back();
        }, 10);
    }
  }

  // Touch Events
  const onTouchStart = (e: TouchEvent<HTMLButtonElement>) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
  const onTouchMove = (e: TouchEvent<HTMLButtonElement>) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY);

  // Mouse Events
  const onMouseDown = (e: MouseEvent<HTMLButtonElement>) => handleDragStart(e.clientX, e.clientY);
  const onMouseMove = (e: MouseEvent<HTMLButtonElement>) => handleDragMove(e.clientX, e.clientY);
  const onMouseUp = () => handleDragEnd();
  const onMouseLeave = () => handleDragEnd();


  return (
    <Button
      ref={nodeRef}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className={cn(
        'fixed z-[100] h-14 w-14 rounded-full shadow-2xl p-0 cursor-grab active:cursor-grabbing',
        'bg-card text-card-foreground border-2 border-primary/50 hover:bg-muted',
        isDragging && 'scale-105 shadow-inner'
      )}
      onClick={handleClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={handleDragEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      <ArrowLeft size={24} />
    </Button>
  );
}
