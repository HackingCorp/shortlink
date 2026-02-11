-- CreateIndex
CREATE INDEX IF NOT EXISTS "Click_link_id_idx" ON "Click"("link_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Click_clicked_at_idx" ON "Click"("clicked_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Click_user_id_idx" ON "Click"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Click_country_idx" ON "Click"("country");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Click_link_id_clicked_at_idx" ON "Click"("link_id", "clicked_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Link_user_id_idx" ON "Link"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Link_team_id_idx" ON "Link"("team_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Link_created_at_idx" ON "Link"("created_at");

-- DropEnum (orphan)
-- ReferentialAction enum was removed from schema
