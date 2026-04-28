import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const profile = await prisma.profile.findFirst();
  if (!profile) {
    await prisma.profile.create({
      data: {
        name: "",
        platforms: JSON.stringify([]),
      },
    });
  }

  const brand = await prisma.brand.findFirst();
  if (!brand) {
    await prisma.brand.create({
      data: {
        primaryColor: "#7c3aed",
        accentColor: "#3b82f6",
        bgColor: "#020617",
        fgColor: "#f8fafc",
        headingFont: "Inter",
        bodyFont: "Inter",
        logoEmoji: "✶",
        taglines: JSON.stringify([]),
        voiceRules: JSON.stringify([]),
        doNotUse: JSON.stringify([]),
      },
    });
  }

  console.log("✓ Seeded profile & brand singletons");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
