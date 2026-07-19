import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = payload.userId || payload.id;
    const q = req.nextUrl.searchParams.get('q') || '';
    const type = req.nextUrl.searchParams.get('type') || 'all';

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const searchTerm = q.trim();
    const results: any[] = [];

    if (type === 'all' || type === 'documents') {
      const docs = await db.document.findMany({
        where: {
          AND: [
            { userId },
            {
              OR: [
                { title: { contains: searchTerm } },
                { signers: { some: { OR: [{ email: { contains: searchTerm } }, { name: { contains: searchTerm } }] } } },
              ],
            },
          ],
        },
        include: {
          signers: { select: { id: true, email: true, name: true, status: true } },
        },
        take: 10,
      });
      results.push(...docs.map(d => ({ ...d, type: 'document' })));
    }

    if (type === 'all' || type === 'templates') {
      const templates = await db.documentTemplate.findMany({
        where: {
          name: { contains: searchTerm },
          ownerId: userId,
        },
        take: 5,
      });
      results.push(...templates.map(t => ({ ...t, type: 'template' })));
    }

    if (type === 'all' || type === 'contacts') {
      const contacts = await db.contact.findMany({
        where: {
          userId,
          OR: [
            { email: { contains: searchTerm } },
            { name: { contains: searchTerm } },
            { company: { contains: searchTerm } },
          ],
        },
        take: 5,
      });
      results.push(...contacts.map(c => ({ ...c, type: 'contact' })));
    }

    return NextResponse.json({ results, query: searchTerm });
  } catch (error) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
