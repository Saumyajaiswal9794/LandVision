'use client';

import React, { useState } from 'react';
import { BoundingBox, ExtractedField } from '@landvision/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/card';
import { Button } from '../../components/button';
import { DocumentViewer } from '../../components/review/documentViewer';
import { EditableField } from '../../components/review/editableField';
import { Check, X, AlertTriangle } from 'lucide-react';

export default function ReviewPage() {
  const [activeBox, setActiveBox] = useState<BoundingBox | null>(null);
  
  // Mock record matching the schema definitions
  const [fields, setFields] = useState<ExtractedField[]>([
    {
      name: 'khataNumber',
      rawValue: '१२३/४५',
      inferredValue: '123/45',
      confidence: 0.98,
      boundingBox: { x: 15, y: 12, width: 25, height: 6 },
    },
    {
      name: 'khasraNumber',
      rawValue: '३४५/१२',
      inferredValue: '345/12',
      confidence: 0.72, // Low confidence trigger for review
      boundingBox: { x: 15, y: 20, width: 25, height: 6 },
    },
    {
      name: 'owners',
      rawValue: 'राम लाल, श्याम लाल',
      inferredValue: 'Ram Lal, Shyam Lal',
      confidence: 0.94,
      boundingBox: { x: 45, y: 30, width: 40, height: 10 },
    },
    {
      name: 'areaTotal',
      rawValue: '१.५ हेक्टेयर',
      inferredValue: '1.5',
      confidence: 0.65, // Low confidence
      boundingBox: { x: 15, y: 48, width: 20, height: 8 },
    },
  ]);

  const handleFieldChange = (index: number, val: string) => {
    const updated = [...fields];
    updated[index].inferredValue = val;
    updated[index].confidence = 1.0; // Overwritten by user input
    setFields(updated);
  };

  const handleApprove = () => {
    alert('Record approved and synchronized to PostGIS and MongoDB databases!');
  };

  const handleReject = () => {
    alert('Record rejected. Routed back to Digitizer queue.');
  };

  // Mock scan document image URL (Using a gray SVG placeholder style fallback)
  const mockDocumentUrl = 'https://placehold.co/600x800/e2eae7/2a3a37?text=Scanned+Khasra+Register';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review Record Verification</h1>
          <p className="text-slate-500 mt-1">
            Resolve warnings and verify bounding boxes for record: <span className="font-mono text-slate-800">rec_mock_102</span>
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={handleReject}>
            <X className="w-4 h-4 mr-2" /> Reject
          </Button>
          <Button variant="primary" onClick={handleApprove}>
            <Check className="w-4 h-4 mr-2" /> Approve & Save
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Side: Interactive Document View with coordinates mapping */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Source Document Scan</CardTitle>
            <CardDescription>
              Hover over form inputs to highlight parsed segments on the page.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <DocumentViewer
              documentUrl={mockDocumentUrl}
              activeBoundingBox={activeBox}
            />
          </CardContent>
        </Card>

        {/* Right Side: Fields Editor */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Extracted Entities</CardTitle>
            <CardDescription>
              Check highlighted fields. Modify values that contain reading inaccuracies.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4 flex-1">
            {fields.some(f => f.confidence < 0.85) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-start space-x-3 text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Verification Warning:</strong> Some fields were parsed with low confidence levels. Hover to double check alignment values.
                </div>
              </div>
            )}

            {fields.map((field, idx) => (
              <EditableField
                key={field.name}
                label={field.name.replace(/([A-Z])/g, ' $1')}
                value={field.inferredValue as string}
                confidence={field.confidence}
                boundingBox={field.boundingBox}
                onChange={(val) => handleFieldChange(idx, val)}
                onFocus={setActiveBox}
              />
            ))}
          </CardContent>
          
          <CardFooter className="border-t border-slate-100 pt-4 flex justify-between text-xs text-slate-400">
            <span>Last extracted: Just now via Claude LLM fallback</span>
            <span>Confidence index: 78.5% (Low)</span>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
