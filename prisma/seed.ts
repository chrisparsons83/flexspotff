import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seed() {
  const discordId = "1111";
  const discordName = "JoshGordon";
  const discordAvatar = "";

  // cleanup the existing database
  await prisma.user.delete({ where: { discordId } }).catch(() => {
    // no worries if it doesn't exist yet
  });

  const user = await prisma.user.create({
    data: {
      discordId,
      discordName,
      discordAvatar,
    },
  });

  await prisma.note.create({
    data: {
      title: "My first note",
      body: "Hello, world!",
      userId: user.id,
    },
  });

  await prisma.note.create({
    data: {
      title: "My second note",
      body: "Hello, world!",
      userId: user.id,
    },
  });

  console.log(`Database has been seeded. 🌱`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
