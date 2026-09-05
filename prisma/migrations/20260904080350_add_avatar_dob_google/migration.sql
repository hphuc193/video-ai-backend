-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "dob" TIMESTAMP(3),
ALTER COLUMN "password" DROP NOT NULL;
