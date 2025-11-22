
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
  const movementRef = useRef(0);

  const handleDragStart = (clientX: number, clientY: number) => {
    if (!nodeRef.current) return;
    dragStartPos.current = {
      x: clientX - position.x,
      y: clientY - position.y,
    };
    movementRef.current = 0; // Reset movement tracker
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (dragStartPos.current.x === 0 && dragStartPos.current.y === 0) return;

    const deltaX = Math.abs(clientX - (dragStartPos.current.x + position.x));
    const deltaY = Math.abs(clientY - (dragStartPos.current.y + position.y));
    movementRef.current += deltaX + deltaY;

    // Only start dragging visually after a small movement threshold
    if (movementRef.current > 5 && !isDragging) {
        setIsDragging(true);
    }

    if (isDragging) {
        let newX = clientX - dragStartPos.current.x;
        let newY = clientY - dragStartPos.current.y;

        // Clamp position to be within the viewport
        newX = Math.max(16, Math.min(newX, window.innerWidth - (nodeRef.current?.offsetWidth || 0) - 16));
        newY = Math.max(16, Math.min(newY, window.innerHeight - (nodeRef.current?.offsetHeight || 0) - 16));

        setPosition({ x: newX, y: newY });
    }
  };

  const handleDragEnd = () => {
    if (movementRef.current < 5) {
        // If movement is negligible, treat as a click
        window.history.back();
    }
    setIsDragging(false);
    dragStartPos.current = { x: 0, y: 0 };
    movementRef.current = 0;
  };
  

  // Mouse Events
  const onMouseDown = (e: MouseEvent<HTMLButtonElement>) => handleDragStart(e.clientX, e.clientY);
  const onMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
    if (e.buttons !== 1) {
        // If mouse button is not pressed, end drag
        if (isDragging) handleDragEnd();
        return;
    }
    handleDragMove(e.clientX, e.clientY);
  };
  const onMouseUp = () => handleDragEnd();
  const onMouseLeave = () => {
    if(isDragging) handleDragEnd();
  };

  // Touch Events
  const onTouchStart = (e: TouchEvent<HTMLButtonElement>) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
  const onTouchMove = (e: TouchEvent<HTMLButtonElement>) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY);

  return (
    <Button
      ref={nodeRef}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className={cn(
        'fixed z-[100] h-14 w-14 rounded-full shadow-2xl p-0 cursor-grab active:cursor-grabbing',
        'bg-card text-card-foreground border-2 border-primary/50 hover:bg-muted',
        isDragging && 'scale-105 shadow-inner'
      )}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={handleDragEnd}
    >
      <ArrowLeft size={24} />
    </Button>
  );
}
