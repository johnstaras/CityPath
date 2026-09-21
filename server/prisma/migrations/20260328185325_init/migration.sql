-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "google_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobility_profiles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "max_incline" DOUBLE PRECISION,
    "avoid_stairs" BOOLEAN NOT NULL DEFAULT false,
    "avoid_cobblestone" BOOLEAN NOT NULL DEFAULT false,
    "min_sidewalk_width" DOUBLE PRECISION,
    "requires_ramps" BOOLEAN NOT NULL DEFAULT false,
    "requires_tactile_paving" BOOLEAN NOT NULL DEFAULT false,
    "max_route_distance_km" DOUBLE PRECISION,
    "rest_stop_interval_meters" INTEGER,
    "speed_factor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "mobility_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "age_group" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_mobility_profiles" (
    "user_id" TEXT NOT NULL,
    "mobility_profile_id" INTEGER NOT NULL,

    CONSTRAINT "user_mobility_profiles_pkey" PRIMARY KEY ("user_id","mobility_profile_id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "estimated_duration_minutes" INTEGER NOT NULL,
    "distance_meters" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "created_by" TEXT NOT NULL DEFAULT 'admin',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pois" (
    "id" SERIAL NOT NULL,
    "osm_id" BIGINT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "photo_url" TEXT,
    "wheelchair" TEXT NOT NULL DEFAULT 'unknown',
    "surface" TEXT,
    "has_ramp" BOOLEAN NOT NULL DEFAULT false,
    "has_tactile_paving" BOOLEAN NOT NULL DEFAULT false,
    "has_rest_area" BOOLEAN NOT NULL DEFAULT false,
    "opening_hours" TEXT,
    "data_source" TEXT NOT NULL DEFAULT 'admin',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pois_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_pois" (
    "route_id" INTEGER NOT NULL,
    "poi_id" INTEGER NOT NULL,
    "order_index" INTEGER NOT NULL,
    "estimated_arrival_minutes" INTEGER NOT NULL,

    CONSTRAINT "route_pois_pkey" PRIMARY KEY ("route_id","poi_id")
);

-- CreateTable
CREATE TABLE "poi_ratings" (
    "id" SERIAL NOT NULL,
    "poi_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "accessibility_rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poi_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "user_id" TEXT NOT NULL,
    "route_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("user_id","route_id")
);

-- CreateTable
CREATE TABLE "route_sessions" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "route_id" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "actual_duration_minutes" INTEGER NOT NULL DEFAULT 0,
    "distance_walked_meters" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "route_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_mobility_profiles" ADD CONSTRAINT "user_mobility_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_mobility_profiles" ADD CONSTRAINT "user_mobility_profiles_mobility_profile_id_fkey" FOREIGN KEY ("mobility_profile_id") REFERENCES "mobility_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_pois" ADD CONSTRAINT "route_pois_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_pois" ADD CONSTRAINT "route_pois_poi_id_fkey" FOREIGN KEY ("poi_id") REFERENCES "pois"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poi_ratings" ADD CONSTRAINT "poi_ratings_poi_id_fkey" FOREIGN KEY ("poi_id") REFERENCES "pois"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poi_ratings" ADD CONSTRAINT "poi_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_sessions" ADD CONSTRAINT "route_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_sessions" ADD CONSTRAINT "route_sessions_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
