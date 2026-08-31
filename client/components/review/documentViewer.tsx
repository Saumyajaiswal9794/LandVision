'use client';

import React from 'react';
import { BoundingBox } from '@landvision/types';

interface DocumentViewerProps {
  documentUrl: string;
  activeBoundingBox: BoundingBox | null;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentUrl,
  activeBoundingBox,
}) => {
  return (
    <div className="relative border border-slate-200 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center min-h-[500px] h-full">
      {documentUrl ? (
        <div className="relative max-w-full max-h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={documentUrl} alt="Scanned Land Document" className="object-contain max-h-[600px]" />
          
          {/* Overlay active OCR bounding box indicator if active */}
          {activeBoundingBox && (
            <div
              className="absolute border-2 border-amber-500 bg-amber-500/20 transition-all pointer-events-none"
              style={{
                left: `${activeBoundingBox.x}%`,
                top: `${activeBoundingBox.y}%`,
                width: `${activeBoundingBox.width}%`,
                height: `${activeBoundingBox.height}%`,
              }}
            />
          )}
        </div>
      ) : (
        <div className="text-slate-400 text-sm">No document loaded</div>
      )}
    </div>
  );
};

export default DocumentViewer;
