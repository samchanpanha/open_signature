import { NextRequest, NextResponse } from 'next/server';
import { ExcelImporter } from '@/lib/importers/excel-importer';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';
import { hashPassword } from '@/lib/auth';
import crypto from 'crypto';

// POST /api/import - Import data from Excel/CSV files
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const importType = formData.get('type') || 'documents';
    const orgId = formData.get('orgId');

    if (!file) {
      return NextResponse.json({ error: 'File required' }, { status: 400 });
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Check permissions
    const member = await prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId: user.id, orgId: orgId as string } },
    });

    if (member?.role !== 'owner' && member?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin permissions required for imports' },
        { status: 403 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Excel file
    const result = await ExcelImporter.import(buffer);

    if (result.errors.length > 0) {
      return NextResponse.json(
        { error: 'Failed to parse file', details: result.errors },
        { status: 400 }
      );
    }

    let importedCount = 0;
    const errors: string[] = [];

    // Process based on import type
    switch (importType) {
      case 'documents':
        // Import documents from first sheet
        if (result.sheets[0]) {
          for (const row of result.sheets[0].rows) {
            try {
              if (!row.title) {
                errors.push('Missing title field');
                continue;
              }

              await prisma.document.create({
                data: {
                  title: row.title,
                  ownerId: user.id,
                  organizationId: orgId as string,
                  status: row.status || 'Draft',
                  originalPdfPath: row.pdfPath || '',
                },
              });
              importedCount++;
            } catch (error) {
              errors.push(`Failed to import "${row.title}": ${error instanceof Error ? error.message : 'Unknown'}`);
            }
          }
        }
        break;

      case 'users':
        // Import users
        if (result.sheets[0]) {
          for (const row of result.sheets[0].rows) {
            try {
              if (!row.email || !row.name) {
                errors.push('Missing email or name field');
                continue;
              }

              // Create or update user
              let existingUser = await prisma.user.findUnique({
                where: { email: row.email },
              });

              if (!existingUser) {
                const tempPassword = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
                const hashedPassword = await hashPassword(tempPassword);
                existingUser = await prisma.user.create({
                  data: {
                    email: row.email,
                    name: row.name,
                    password: hashedPassword,
                  },
                });
              }

              // Add to organization if not already a member
              const existingMember = await prisma.organizationMember.findUnique({
                where: { userId_orgId: { userId: existingUser.id, orgId: orgId as string } },
              });

              if (!existingMember) {
                await prisma.organizationMember.create({
                  data: {
                    userId: existingUser.id,
                    orgId: orgId as string,
                    role: row.role || 'member',
                  },
                });
              }

              importedCount++;
            } catch (error) {
              errors.push(`Failed to import "${row.email}": ${error instanceof Error ? error.message : 'Unknown'}`);
            }
          }
        }
        break;

      default:
        return NextResponse.json(
          { error: `Unsupported import type: ${importType}. Use: documents or users` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      importedCount,
      errors,
      message: `Successfully imported ${importedCount} ${importType}${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
    });
  } catch (error) {
    console.error('Error importing file:', error);
    return NextResponse.json(
      { error: 'Failed to import file' },
      { status: 500 }
    );
  }
}
