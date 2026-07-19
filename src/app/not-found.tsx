'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileQuestion className="w-5 h-5" />
            Page not found
          </CardTitle>
          <CardDescription>
            The page you&apos;re looking for doesn&apos; exist or has been moved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/">
            <Button className="w-full">Go to Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
