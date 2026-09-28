'use client';

import React from 'react';
import { BoundingBox } from '@landvision/types';

// ---------------------------------------------------------------------------
// Sprint D: bbox overlay component for the source image.
//
// Renders an <img> sized to fit its container, then overlays absolutely
// positioned <div> rectangles for each field's bbox. Coordinates are in
// PERCENT (0–100) so the overlay scales correctly when the image is
// resized by the layout.
//
// The "selected" row's boxes are drawn in amber; non-selected rows are
// drawn dimmed/greyed out. Clicking a box calls onSelectBox(fieldKey).
// ---------------------------------------------------------------------------

export interface BboxOverlayBox {
  fieldKey: string;
  label: string;
  bbox: BoundingBox;
  /** Confidence 0–1 — drives the colour saturation. */
  confidence: number;
  /** When true the box is drawn in amber (selected row). */
  highlighted?: boolean;
  /** When true the box is dimmed (non-selected row). */
  dimmed?: boolean;
}

interface BboxOverlayProps {
  imageUrl: string | null | undefined;
  boxes: BboxOverlayBox[];
  /** Called when the user clicks a bbox rectangle (mouse or keyboard). */
  onSelectBox?: (fieldKey: string) => void;
  /** Optional: minimal height of the image area, e.g. '500px'. */
  minHeight?: string;
}

export const BboxOverlay: React.FC<BboxOverlayProps> = ({
  imageUrl,
  boxes,
  onSelectBox,
  minHeight = '500px',
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  if (!imageUrl) {
    return (
      <div
        className="flex items-center justify-center bg-slate-50 border border-slate-200 rounded-md text-slate-400 text-sm"
        style={{ minHeight }}
      >
        No document image available
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-slate-50 border border-slate-200 rounded-md overflow-hidden"
      style={{ minHeight }}
    >
      <img
        src={imageUrl}
        alt="Source document"
        className="block max-w-full max-h-[600px] mx-auto object-contain select-none"
        draggable={false}
      />
      {/* Overlay layer — absolutely positioned over the image, percent-based so it scales. */}
      <div className="absolute inset-0 pointer-events-none">
        {boxes.map((box) => {
          // The image uses object-contain, so we can position the boxes
          // in percent coordinates relative to the image's visible
          // bounding rect (which IS the container, since the image fills
          // the width).
          const { x, y, width, height } = box.bbox;
          const isHighlighted = box.highlighted;
          const isDimmed = box.dimmed;

          const borderColor = isHighlighted
            ? 'rgb(245, 158, 11)' // amber-500
            : isDimmed
            ? 'rgba(100, 116, 139, 0.4)' // slate-500/40
            : 'rgba(59, 130, 246, 0.6)'; // blue-500/60

          const bgColor = isHighlighted
            ? 'rgba(245, 158, 11, 0.18)'
            : isDimmed
            ? 'rgba(100, 116, 139, 0.08)'
            : 'rgba(59, 130, 246, 0.10)';

          return (
            <div
              key={box.fieldKey}
              role="button"
              tabIndex={0}
              aria-label={box.label}
              title={`${box.label} — confidence ${(box.confidence * 100).toFixed(0)}%`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectBox?.(box.fieldKey);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectBox?.(box.fieldKey);
                }
              }}
              className="absolute border-2 transition-opacity pointer-events-auto cursor-pointer"
              style={{
                left: `${(x * 100).toFixed(2)}%`,
                top: `${(y * 100).toFixed(2)}%`,
                width: `${(width * 100).toFixed(2)}%`,
                height: `${(height * 100).toFixed(2)}%`,
                borderColor,
                backgroundColor: bgColor,
                opacity: isDimmed ? 0.5 : 1,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default BboxOverlay;
