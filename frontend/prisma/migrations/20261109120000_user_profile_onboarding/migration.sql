ALTER TABLE "User"
ADD COLUMN "surveyCompleted" BOOLEAN NOT NULL DEFAULT false;

-- Existing accounts predate this onboarding gate and should not be interrupted.
UPDATE "User" SET "surveyCompleted" = true;

CREATE TABLE "UserProfile" (
    "userId" TEXT NOT NULL,
    "companySize" VARCHAR(24) NOT NULL,
    "primaryApiType" VARCHAR(24) NOT NULL,
    "cicdTool" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "UserProfile"
ADD CONSTRAINT "UserProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
