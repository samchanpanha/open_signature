'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AssignmentManager } from '@/components/assignments/assignment-manager';

export default function AssignmentsPage() {
  const router = useRouter();
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    const storedOrgId = localStorage.getItem('currentOrgId');
    if (storedOrgId) {
      setOrgId(storedOrgId);
    } else {
      // Redirect to main app if no org is selected
      router.push('/');
    }
  }, [router]);

  if (!orgId) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <AssignmentManager orgId={orgId} />
    </div>
  );
}
