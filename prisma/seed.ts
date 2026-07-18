import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@opesign.com';
  const adminPassword = 'Admin123!';
  const adminName = 'Admin User';

  // Check if admin already exists
  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existing) {
    console.log('Admin user already exists:', adminEmail);
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      name: adminName,
      password: hashedPassword,
    },
  });

  console.log('Created admin user:', admin.email);

  // Create default organization
  const org = await prisma.organization.create({
    data: {
      name: 'Default Organization',
      slug: 'default',
      ownerId: admin.id,
      members: {
        create: {
          userId: admin.id,
          role: 'owner',
        },
      },
    },
  });

  console.log('Created organization:', org.name);

  // Create permissions for admin
  const resources = ['document', 'template', 'user', 'organization', 'report'];
  const actions = ['create', 'read', 'update', 'delete'];

  for (const resource of resources) {
    for (const action of actions) {
      await prisma.permission.create({
        data: {
          userId: admin.id,
          orgId: org.id,
          resource,
          action,
          granted: true,
        },
      });
    }
  }

  console.log('Created permissions for admin');

  // Print login credentials
  console.log('\n=== Default Admin Credentials ===');
  console.log('Email:', adminEmail);
  console.log('Password:', adminPassword);
  console.log('==================================\n');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
