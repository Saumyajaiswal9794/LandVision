'use client';

import React from 'react';
import { BoundingBox } from '@landvision/types';

interface EditableFieldProps {
  label: string;
  value: string;
  confidence: number;
  boundingBox: BoundingBox | null;
  onChange: (newValue: string) => void;
  onFocus: (box: BoundingBox | null) => void;
}

export const EditableField: React.FC<EditableFieldProps> = ({
  label,
  value,
  confidence,
  boundingBox,
  onChange,
  onFocus,
}) => {
  const isLowConfidence = confidence < 0.85;

  return (
    <div 
      className="p-3 border rounded-lg bg-white shadow-sm flex flex-col space-y-2 transition-shadow hover:shadow"
      onMouseEnter={() => onFocus(boundingBox)}
      onMouseLeave={() => onFocus(null)}
    >
      <div className="flex justify-between items-center">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {label}
        </label>
        <span 
          className={`text-xs px-2 py-0.5 rounded font-mono ${
            isLowConfidence 
              ? 'bg-red-50 text-red-700 border border-red-200' 
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}
        >
          Conf: {(confidence * 100).toFixed(0)}%
        </span>
      </div>
      
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => onFocus(boundingBox)}
        className="w-full text-sm border border-slate-200 rounded px-3 py-2 focus:outline-none focus:border-brand-500 transition-colors"
      />
    </div>
  );
};

export default EditableField;
