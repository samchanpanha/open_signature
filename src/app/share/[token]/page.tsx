'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileSignature, FileText, Clock, Shield, Loader2, AlertTriangle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [document, setDocument] = useState<any>(null);
  const [pages, setPages] = useState<{ dataUrl: string; pageNumber: number }[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    const loadDocument = async () => {
      try {
        const res = await fetch(`/api/share/${token}`);
        if (res.ok) {
          const data = await res.json();
          setDocument(data.document || data);

          setPdfLoading(true);
          const pdfRes = await fetch(`/api/share/${token}/file`);
          if (pdfRes.ok) {
            const blob = await pdfRes.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const pagePromises = Array.from({ length: pdf.numPages }, async (_, i) => {
              const page = await pdf.getPage(i + 1);
              const viewport = page.getViewport({ scale: 1.5 });
              const canvas = document!.createElement('canvas');
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              const ctx = canvas.getContext('2d')!;
              await page.render({ canvasContext: ctx, viewport }).promise;
              return { dataUrl: canvas.toDataURL('image/jpeg', 0.8), pageNumber: i + 1 };
            });
            setPages(await Promise.all(pagePromises));
          }
          setPdfLoading(false);
        } else {
          setError('Invalid or expired share link');
        }
      } catch {
        setError('Failed to load document');
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Link Invalid</h2>
            <p className="text-muted-foreground text-sm">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
              <FileSignature className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold">OpenSign</span>
          </div>
          <Badge variant="outline" className="gap-1">
            <Shield className="w-3 h-3" /> View Only
          </Badge>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{document?.title || 'Shared Document'}</h1>
            <p className="text-sm text-muted-foreground">Shared via link</p>
          </div>
        </div>

        {pdfLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {pages.map((page) => (
              <div key={page.pageNumber} className="space-y-1">
                <p className="text-xs text-muted-foreground text-center">Page {page.pageNumber}</p>
                <div className="mx-auto border rounded-lg overflow-hidden shadow-sm bg-white" style={{ maxWidth: 612 }}>
                  <img src={page.dataUrl} alt={`Page ${page.pageNumber}`} className="w-full h-auto" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t py-3 text-center text-xs text-muted-foreground">
        Secured by OpenSign - Cryptographically sealed document
      </footer>
    </div>
  );
}
