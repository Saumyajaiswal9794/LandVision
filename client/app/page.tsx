import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../components/table';

export default function DashboardPage() {
  // Static placeholder data for layout visualization
  const mockRecords = [
    { id: '1', khata: '102', khasra: '403/12', village: 'Rampur', status: 'APPROVED', date: '2026-08-29' },
    { id: '2', khata: '44', khasra: '12', village: 'Gopalpur', status: 'PENDING', date: '2026-08-28' },
    { id: '3', khata: '89', khasra: '39', village: 'Haripur', status: 'UNDER_REVIEW', date: '2026-08-27' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Records Digitization Dashboard</h1>
        <p className="text-slate-500 mt-1">
          Monitor incoming scans, verify accuracy metrics, and review spatial GIS alignment.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Uploaded Scans</CardTitle>
            <CardDescription>All scanned land records in pipeline</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-4xl font-extrabold text-brand-600">1,248</span>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Pending HITL Review</CardTitle>
            <CardDescription>Low-confidence OCR or structural mismatches</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-4xl font-extrabold text-amber-600">34</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Digitized Records</CardTitle>
            <CardDescription>Verified and uploaded to PostgreSQL</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-4xl font-extrabold text-emerald-600">1,214</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Land Records</CardTitle>
            <CardDescription>A list of latest processed registers</CardDescription>
          </div>
          <Link href="/upload" className="text-sm font-semibold text-brand-500 hover:text-brand-600">
            Upload New +
          </Link>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Khata No.</TableHead>
                <TableHead>Khasra No.</TableHead>
                <TableHead>Village</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Processed Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockRecords.map((rec) => (
                <TableRow key={rec.id}>
                  <TableCell className="font-mono text-xs">{rec.id}</TableCell>
                  <TableCell>{rec.khata}</TableCell>
                  <TableCell>{rec.khasra}</TableCell>
                  <TableCell>{rec.village}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                        rec.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : rec.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}
                    >
                      {rec.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-500">{rec.date}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/review?id=${rec.id}`} className="text-sm text-brand-500 hover:underline">
                      Review
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
