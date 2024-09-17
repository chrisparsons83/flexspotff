-- AlterTable
ALTER TABLE "TeamGame" ADD COLUMN     "isRegularSeason" BOOLEAN NOT NULL DEFAULT true;

UPDATE "TeamGame" tg SET "isRegularSeason" = false FROM "Team" t JOIN "League" l ON t."leagueId" = l.id WHERE tg."teamId" = t.id AND tg."week" >= 14 AND l."year" <= 2020;
UPDATE "TeamGame" tg SET "isRegularSeason" = false FROM "Team" t JOIN "League" l ON t."leagueId" = l.id WHERE tg."teamId" = t.id AND tg."week" >= 15 AND l."year" >= 2021;