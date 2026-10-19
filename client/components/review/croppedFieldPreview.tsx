'use client';

import React from 'react';

// ---------------------------------------------------------------------------
// Sprint D: Cropped field preview.
//
// Renders a small (e.g. 64x64) thumbnail of the source image, cropped to
// the field's bbox. Uses CSS background-position/size — no server work
// needed (no image cropping endpoint).
//
// Math:
//   bbox { x, y, width, height } are 0-1 fractions of the image.
//   background-size:    `${100 / width}% ${100 / height}%`
//   background-position: `${(x / (1 - width)) * 100}% ${((y / (1 - height)) * 100}%`
//   (the standard CSS sprite-sheet crop formula).
//
// When width or height is 0/missing we just show the full image at the
// preview size — better than nothing.
// ---------------------------------------------------------------------------

interface CroppedFieldPreviewProps {
  imageUrl: string;
  /** Bounding box in 0-1 normalised coordinates. */
  bbox?: { x: number; y: number; width: number; height: number } | null;
  /** Square preview size in px. Default 64. */
  size?: number;
}

export const CroppedFieldPreview: React.FC<CroppedFieldPreviewProps> = ({
  imageUrl,
  bbox,
  size = 64,
}) => {
  if (!imageUrl) {
    return (
      <div
        className="border border-slate-200 rounded bg-slate-50"
        style={{ width: size, height: size }}
        aria-label="No preview"
      />
    );
  }

  // If we have a valid bbox, do the CSS sprite-crop math.
  let bgSize = '100% 100%';
  let bgPos = '0% 0%';
  if (
    bbox &&
    typeof bbox.x === 'number' &&
    typeof bbox.y === 'number' &&
    typeof bbox.width === 'number' &&
    typeof bbox.height === 'number' &&
    bbox.width > 0 &&
    bbox.height > 0 &&
    bbox.width < 1 &&
    bbox.height < 1
  ) {
    bgSize = `${(100 / bbox.width).toFixed(2)}% ${(100 / bbox.height).toFixed(2)}%`;
    // Standard sprite-sheet crop formula. Avoid division by 0 by guarding above.
    const posX = bbox.x === 0 ? 0 : (bbox.x / (1 - bbox.width)) * 100;
    const posY = bbox.y === 0 ? 0 : (bbox.y / (1 - bbox.height)) * 100;
    bgPos = `${posX.toFixed(2)}% ${posY.toFixed(2)}%`;
  }

  return (
    <div
      className="border border-slate-300 rounded bg-slate-100 shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${imageUrl})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: bgSize,
        backgroundPosition: bgPos,
      }}
      aria-label="Cropped preview of the field's bounding box"
      title="Cropped preview from the source image"
    />
  );
};

export default CroppedFieldPreview;
