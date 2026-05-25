CREATE DATABASE IF NOT EXISTS `ashiato_singapore_mrt`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `ashiato_singapore_mrt`;

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(64) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `physical_stations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name_en` VARCHAR(128) NOT NULL,
  `name_zh` VARCHAR(128) NULL,
  `name_ms` VARCHAR(128) NULL,
  `name_ta` VARCHAR(128) NULL,
  `lat` DECIMAL(10, 7) NULL,
  `lng` DECIMAL(10, 7) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_physical_stations_name_en` (`name_en`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `lines` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(24) NOT NULL,
  `name_en` VARCHAR(128) NOT NULL,
  `name_zh` VARCHAR(128) NULL,
  `name_ms` VARCHAR(128) NULL,
  `name_ta` VARCHAR(128) NULL,
  `color` CHAR(7) NOT NULL DEFAULT '#64748b',
  `is_loop` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `display_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_lines_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `line_stations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `line_id` BIGINT UNSIGNED NOT NULL,
  `physical_station_id` BIGINT UNSIGNED NOT NULL,
  `station_code` VARCHAR(24) NOT NULL,
  `display_name_en` VARCHAR(128) NOT NULL,
  `display_name_zh` VARCHAR(128) NULL,
  `display_name_ms` VARCHAR(128) NULL,
  `display_name_ta` VARCHAR(128) NULL,
  `branch_code` VARCHAR(32) NOT NULL DEFAULT 'main',
  `sequence_index` INT NOT NULL,
  `diagram_x` DECIMAL(10, 3) NULL,
  `diagram_y` DECIMAL(10, 3) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_line_stations_code` (`station_code`),
  UNIQUE KEY `uq_line_stations_order` (`line_id`, `branch_code`, `sequence_index`),
  KEY `ix_line_stations_physical_station_id` (`physical_station_id`),
  CONSTRAINT `fk_line_stations_line` FOREIGN KEY (`line_id`) REFERENCES `lines` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_line_stations_physical_station` FOREIGN KEY (`physical_station_id`) REFERENCES `physical_stations` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `segments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `line_id` BIGINT UNSIGNED NOT NULL,
  `from_line_station_id` BIGINT UNSIGNED NOT NULL,
  `to_line_station_id` BIGINT UNSIGNED NOT NULL,
  `distance_km` DECIMAL(8, 3) NULL,
  `direction_hint` VARCHAR(64) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `is_counted` BOOLEAN NOT NULL DEFAULT TRUE,
  `geometry_json` JSON NULL,
  `display_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_segments_pair` (`line_id`, `from_line_station_id`, `to_line_station_id`),
  KEY `ix_segments_from` (`from_line_station_id`),
  KEY `ix_segments_to` (`to_line_station_id`),
  CONSTRAINT `fk_segments_line` FOREIGN KEY (`line_id`) REFERENCES `lines` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_segments_from_station` FOREIGN KEY (`from_line_station_id`) REFERENCES `line_stations` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_segments_to_station` FOREIGN KEY (`to_line_station_id`) REFERENCES `line_stations` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `station_transfers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `from_line_station_id` BIGINT UNSIGNED NOT NULL,
  `to_line_station_id` BIGINT UNSIGNED NOT NULL,
  `transfer_type` ENUM('same_station', 'paid_link', 'out_of_station', 'virtual') NOT NULL DEFAULT 'same_station',
  `walk_minutes` INT NULL,
  `notes` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_station_transfers_pair` (`from_line_station_id`, `to_line_station_id`),
  CONSTRAINT `fk_station_transfers_from` FOREIGN KEY (`from_line_station_id`) REFERENCES `line_stations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_station_transfers_to` FOREIGN KEY (`to_line_station_id`) REFERENCES `line_stations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ride_records` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `ride_date` DATE NOT NULL,
  `title` VARCHAR(160) NULL,
  `comment` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_ride_records_user_date` (`user_id`, `ride_date`),
  CONSTRAINT `fk_ride_records_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ride_legs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ride_record_id` BIGINT UNSIGNED NOT NULL,
  `line_id` BIGINT UNSIGNED NOT NULL,
  `from_line_station_id` BIGINT UNSIGNED NOT NULL,
  `to_line_station_id` BIGINT UNSIGNED NOT NULL,
  `sequence_index` INT NOT NULL,
  `direction_mode` ENUM('auto', 'forward', 'backward', 'clockwise', 'anticlockwise', 'manual') NOT NULL DEFAULT 'auto',
  `comment` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ride_legs_record_order` (`ride_record_id`, `sequence_index`),
  CONSTRAINT `fk_ride_legs_record` FOREIGN KEY (`ride_record_id`) REFERENCES `ride_records` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ride_legs_line` FOREIGN KEY (`line_id`) REFERENCES `lines` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_ride_legs_from_station` FOREIGN KEY (`from_line_station_id`) REFERENCES `line_stations` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_ride_legs_to_station` FOREIGN KEY (`to_line_station_id`) REFERENCES `line_stations` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ride_leg_segments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ride_leg_id` BIGINT UNSIGNED NOT NULL,
  `segment_id` BIGINT UNSIGNED NOT NULL,
  `sequence_index` INT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ride_leg_segments_order` (`ride_leg_id`, `sequence_index`),
  UNIQUE KEY `uq_ride_leg_segments_segment` (`ride_leg_id`, `segment_id`),
  CONSTRAINT `fk_ride_leg_segments_leg` FOREIGN KEY (`ride_leg_id`) REFERENCES `ride_legs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ride_leg_segments_segment` FOREIGN KEY (`segment_id`) REFERENCES `segments` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `display_preferences` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NULL,
  `preference_key` VARCHAR(64) NOT NULL,
  `value_json` JSON NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_display_preferences_scope` (`user_id`, `preference_key`),
  CONSTRAINT `fk_display_preferences_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
