'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

const STORAGE_KEY = 'moodcast:companion-pos';
const MARGIN = 16;
const PANEL_W = 320;
const MIN_VISIBLE_H = 80; // keep at least this many px visible at bottom

interface Pos { x: number; y: number }

function maxX() { return window.innerWidth - PANEL_W - MARGIN; }
function maxY() { return window.innerHeight - MIN_VISIBLE_H; }

function clamp(pos: Pos): Pos {
  return {
    x: Math.max(0, Math.min(pos.x, maxX())),
    y: Math.max(0, Math.min(pos.y, maxY())),
  };
}

function defaultPos(): Pos {
  return { x: maxX(), y: window.innerHeight - 500 };
}

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return clamp(JSON.parse(raw) as Pos);
  } catch { /* ignore */ }
  return defaultPos();
}

export function useDraggableCompanion() {
  const [pos, setPos] = useState<Pos | null>(null);
  const dragging = useRef(false);
  const offset = useRef<Pos>({ x: 0, y: 0 });

  useEffect(() => {
    // Hydrate from localStorage once on mount; can't run during render (SSR has no window).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPos(loadPos());
  }, []);

  // Re-clamp when window is resized (e.g. orientation change, browser resize)
  useEffect(() => {
    let rafId: number;
    const onResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setPos((p) => (p ? clamp(p) : defaultPos()));
      });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || !pos) return;
    e.preventDefault();
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  }, [pos]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos(clamp({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y }));
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setPos((p) => {
        if (!p) return p;
        const clamped = clamp(p);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped)); } catch { /* ignore */ }
        return clamped;
      });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  return { pos, onHeaderMouseDown };
}
