import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const roles: Array<{
  name: UserRole;
  description: string;
  permissions: string[];
}> = [
  {
    name: UserRole.CANDIDATE,
    description: 'Candidate — owns and edits their talent profile.',
    permissions: ['talent:read', 'talent:write'],
  },
  {
    name: UserRole.RECRUITER,
    description: 'Recruiter — discovers talent, reviews profiles and spends TalentCredits.',
    permissions: [
      'talent:read',
      'talent:unlock',
      'recruiter:read',
      'recruiter:write',
      'engagement:swipe',
      'engagement:review',
      'rewards:read',
      'rewards:spend',
      'analytics:read',
    ],
  },
  {
    name: UserRole.ADMIN,
    description: 'Platform administrator — full access to every bounded context.',
    permissions: [
      'talent:read',
      'talent:write',
      'talent:unlock',
      'recruiter:read',
      'recruiter:write',
      'engagement:swipe',
      'engagement:review',
      'rewards:read',
      'rewards:spend',
      'analytics:read',
    ],
  },
];

async function main(): Promise<void> {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {
        description: role.description,
        permissions: role.permissions,
      },
      create: {
        name: role.name,
        description: role.description,
        permissions: role.permissions,
      },
    });
    console.log(`seeded role ${role.name} (${role.permissions.length} permissions)`);
  }
}

main()
  .catch((error: unknown) => {
    console.error('failed to seed auth roles', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
