import { AssignmentManager } from '@/components/assignments/assignment-manager';

export default function AssignmentsPage() {
  // In a real app, you'd get this from auth context or URL params
  const orgId = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || 'default-org';

  return (
    <div className="container mx-auto py-8">
      <AssignmentManager orgId={orgId} />
    </div>
  );
}
