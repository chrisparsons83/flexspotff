-- CreateTable
CREATE TABLE "MemberAlias" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alias" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "MemberAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberAlias_alias_key" ON "MemberAlias"("alias");

-- CreateIndex
CREATE INDEX "MemberAlias_userId_idx" ON "MemberAlias"("userId");

-- AddForeignKey
ALTER TABLE "MemberAlias" ADD CONSTRAINT "MemberAlias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
