import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SAFE_BOTTOM } from './mobileTokens';

export type SheetState = 'collapsed' | 'expanded';

interface Props {
  state: SheetState;
  onStateChange: (state: SheetState) => void;
  /** Always-visible strip: a handle, a summary, whatever the screen needs. */
  peek: ReactNode;
  children: ReactNode;
  collapsedHeight?: number;
  /** Clearance for a tab bar underneath, so the sheet never hides behind it. */
  bottomInset?: number;
}

/**
 * A draggable bottom sheet over a full-screen map.
 *
 * Drag is implemented with pointer events rather than a library: it is one
 * gesture, and adding a dependency for it would be the larger change. The
 * sheet follows the finger while dragging and settles to the nearer state on
 * release, so a short flick still works.
 *
 * `touch-action: none` on the grab area stops the browser scrolling the page
 * while dragging; the scrollable list inside keeps its own normal touch
 * behaviour so the sheet never steals a list scroll.
 */
export default function MobileBottomSheet({
  state, onStateChange, peek, children, collapsedHeight = 148, bottomInset = 0,
}: Props) {
  const [dragOffset, setDragOffset] = useState(0);
  const dragStart = useRef<number | null>(null);
  const [expandedHeight, setExpandedHeight] = useState(() =>
    typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.72) : 480);

  useEffect(() => {
    const onResize = () => setExpandedHeight(Math.round(window.innerHeight * 0.72));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const restingHeight = state === 'expanded' ? expandedHeight : collapsedHeight;
  // Dragging up increases height; clamped so it can never exceed either bound.
  const height = Math.max(
    collapsedHeight,
    Math.min(expandedHeight, restingHeight + dragOffset),
  );

  const onPointerDown = (event: React.PointerEvent) => {
    dragStart.current = event.clientY;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (dragStart.current === null) return;
    setDragOffset(dragStart.current - event.clientY);
  };

  const onPointerUp = () => {
    if (dragStart.current === null) return;
    // Settle to whichever state the sheet ended up closer to.
    const midpoint = (collapsedHeight + expandedHeight) / 2;
    onStateChange(height > midpoint ? 'expanded' : 'collapsed');
    dragStart.current = null;
    setDragOffset(0);
  };

  const dragging = dragStart.current !== null;

  return (
    <section
      data-testid="mobile-sheet"
      data-state={state}
      aria-label="Nearby mechanics"
      className="absolute left-0 right-0 z-[350] flex flex-col rounded-t-[24px] border-t border-white/12 overflow-hidden"
      style={{
        bottom: bottomInset,
        height,
        paddingBottom: SAFE_BOTTOM,
        background: 'rgba(12,13,14,0.94)',
        backdropFilter: 'blur(28px) saturate(160%)',
        WebkitBackdropFilter: 'blur(28px) saturate(160%)',
        boxShadow: '0 -18px 48px rgba(0,0,0,0.5)',
        transition: dragging ? 'none' : 'height 260ms cubic-bezier(.32,.72,0,1)',
      }}
    >
      {/* Grab area: the handle and the peek content both drag the sheet. */}
      <div
        data-testid="mobile-sheet-handle"
        role="button"
        tabIndex={0}
        aria-expanded={state === 'expanded'}
        aria-label={state === 'expanded' ? 'Collapse list' : 'Expand list'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => !dragging &&
          onStateChange(state === 'expanded' ? 'collapsed' : 'expanded')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onStateChange(state === 'expanded' ? 'collapsed' : 'expanded');
          }
        }}
        className="shrink-0 cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
      >
        <div className="flex justify-center pt-3 pb-2">
          <span className="block w-9 h-1 rounded-full bg-white/25" />
        </div>
        {peek}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4">
        {children}
      </div>
    </section>
  );
}
