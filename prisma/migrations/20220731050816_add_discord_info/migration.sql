/*
  Warnings:

  - You are about to drop the `Password` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `discordAvatar` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `discordId` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `discordName` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Password" DROP CONSTRAINT "Password_userId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "discordAvatar" TEXT NOT NULL,
ADD COLUMN     "discordId" TEXT NOT NULL,
ADD COLUMN     "discordName" TEXT NOT NULL;

-- DropTable
DROP TABLE "Password";
