-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'BOOKING_RECEIVED';

-- DropIndex
DROP INDEX "Property_city_trgm_idx";

-- DropIndex
DROP INDEX "Property_name_trgm_idx";
