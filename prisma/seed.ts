import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  // Create an array of user data
  const users = [
    { discordId: '1111', discordName: 'UserOne', discordAvatar: '' },
    { discordId: '2222', discordName: 'UserTwo', discordAvatar: '' },
    { discordId: '3333', discordName: 'UserThree', discordAvatar: '' },
  ];

  // Cleanup the existing users
  await Promise.all(
    users.map(user =>
      prisma.user.delete({ where: { discordId: user.discordId } }).catch(() => {
        // no worries if it doesn't exist yet
      }),
    ),
  );

  // Create new users
  await Promise.all(
    users.map(user =>
      prisma.user.create({
        data: user,
      }),
    ),
  );

  console.log(`Database has been seeded with ${users.length} users. 🌱`);
}

seed()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
