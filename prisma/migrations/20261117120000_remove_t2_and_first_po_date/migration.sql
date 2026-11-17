-- DropForeignKey
ALTER TABLE "StyleT2" DROP CONSTRAINT "StyleT2_companyId_fkey";

-- DropForeignKey
ALTER TABLE "StyleT2" DROP CONSTRAINT "StyleT2_styleId_fkey";

-- AlterTable
ALTER TABLE "Style" DROP COLUMN "firstPoDate";

-- DropTable
DROP TABLE "StyleT2";

