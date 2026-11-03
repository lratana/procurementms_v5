-- ====================================================
-- Database: procurement_db
-- Cambodian Public Procurement Management System
-- MySQL 8.0+ / utf8mb4 / InnoDB
-- ====================================================

CREATE DATABASE IF NOT EXISTS `procurement_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `procurement_db`;

-- Drop tables if exists in reverse dependency order
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `user_sessions`;
DROP TABLE IF EXISTS `devices`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `warranties`;
DROP TABLE IF EXISTS `handovers`;
DROP TABLE IF EXISTS `contracts`;
DROP TABLE IF EXISTS `bidding_process`;
DROP TABLE IF EXISTS `bidders`;
DROP TABLE IF EXISTS `project_requests`;
DROP TABLE IF EXISTS `projects`;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Projects Table
CREATE TABLE `projects`(
    `project_id` VARCHAR(50) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `fiscal_year` YEAR NULL,
    `procurement_type` VARCHAR(100) NULL,
    `budget_type` VARCHAR(50) NULL DEFAULT 'មូលធន',
    `procurement_method` VARCHAR(100) NULL,
    `plan_date` DATE NULL,
    `plan_amount` DECIMAL(18, 2) NULL,
    PRIMARY KEY(`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Project Requests Table
CREATE TABLE `project_requests`(
    `request_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `project_id` VARCHAR(50) NOT NULL,
    `request_date` DATE NULL,
    `fiscal_year` YEAR NULL,
    `request_amount` DECIMAL(18, 2) NULL,
    `approval_date` DATE NULL,
    `approved_amount` DECIMAL(18, 2) NULL,
    UNIQUE KEY `project_requests_project_id_unique`(`project_id`),
    CONSTRAINT `fk_project_requests_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Bidding Process Table
CREATE TABLE `bidding_process`(
    `bid_process_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `project_id` VARCHAR(50) NOT NULL,
    `prepare_bid` DATE NULL,
    `moh_approval` DATE NULL,
    `mef_submit` DATE NULL,
    `mef_approval` DATE NULL,
    `advertise_date` DATE NULL,
    `bid_opening` DATE NULL,
    `validity_days` INT NULL,
    `expiry_days` INT NULL,
    `valid_until` DATE NULL,
    `status` VARCHAR(100) NULL,
    UNIQUE KEY `bidding_process_project_id_unique`(`project_id`),
    CONSTRAINT `fk_bidding_process_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Bidders Table
CREATE TABLE `bidders`(
    `bidder_id` VARCHAR(100) NOT NULL,
    `company_name` VARCHAR(255) NOT NULL,
    `company_director` VARCHAR(255) NULL,
    `phone_number` VARCHAR(50) NULL,
    `tax_identification_number` VARCHAR(100) NULL,
    `address` TEXT NULL,
    `status` VARCHAR(100) NULL,
    PRIMARY KEY(`bidder_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Contracts Table
CREATE TABLE `contracts`(
    `contract_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `project_id` VARCHAR(50) NOT NULL,
    `contract_submit_mef` DATE NULL,
    `contract_amount` DECIMAL(18, 2) NULL,
    `approval_date` DATE NULL,
    `end_date` DATE NULL,
    `contract_validity` INT NULL,
    `expiry_days` INT NULL,
    `status` VARCHAR(100) NULL,
    `handover` VARCHAR(100) NULL,
    UNIQUE KEY `contracts_project_id_unique`(`project_id`),
    CONSTRAINT `fk_contracts_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Handovers Table
CREATE TABLE `handovers`(
    `handover_id` VARCHAR(100) NOT NULL,
    `project_id` VARCHAR(50) NOT NULL,
    `contract_amount` DECIMAL(18, 2) NULL,
    `handover_amount` DECIMAL(18, 2) NULL,
    `stage_1` DECIMAL(18, 2) NULL,
    `stage_2` DECIMAL(18, 2) NULL,
    `stage_3` DECIMAL(18, 2) NULL,
    `stage_4` DECIMAL(18, 2) NULL,
    `progress_percent` DECIMAL(5, 2) NULL,
    `handover_status` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    PRIMARY KEY(`handover_id`),
    UNIQUE KEY `handovers_project_id_unique`(`project_id`),
    CONSTRAINT `fk_handovers_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Warranties Table
CREATE TABLE `warranties`(
    `warranty_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `project_id` VARCHAR(50) NOT NULL,
    `existing_handover_date` DATE NULL,
    `handover_date` DATE NULL,
    `warranty_period_days` INT NULL,
    `expired_years` YEAR NULL,
    `expired_date` DATE NULL,
    `warranty_remaining_days` INT NULL,
    `expired_days` INT NULL,
    `status` VARCHAR(100) NULL,
    UNIQUE KEY `warranties_project_id_unique`(`project_id`),
    CONSTRAINT `fk_warranties_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Users Table
CREATE TABLE `users`(
    `user_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NULL,
    `phone_number` VARCHAR(50) NULL,
    `role` VARCHAR(50) NOT NULL DEFAULT 'viewer',
    `department` VARCHAR(255) NULL,
    `position` VARCHAR(255) NULL,
    `profile_photo` VARCHAR(500) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'active',
    `last_login_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    UNIQUE KEY `users_username_unique`(`username`),
    UNIQUE KEY `users_email_unique`(`email`),
    INDEX `users_role_index`(`role`),
    INDEX `users_status_index`(`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Devices Table
CREATE TABLE `devices`(
    `device_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `device_name` VARCHAR(255) NULL,
    `device_type` VARCHAR(50) NULL,
    `operating_system` VARCHAR(100) NULL,
    `browser` VARCHAR(100) NULL,
    `device_identifier` VARCHAR(255) NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `first_login_at` DATETIME NULL,
    `last_login_at` DATETIME NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'active',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    INDEX `devices_user_id_index`(`user_id`),
    UNIQUE KEY `devices_device_identifier_unique`(`device_identifier`),
    INDEX `devices_status_index`(`status`),
    CONSTRAINT `fk_devices_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. User Sessions Table
CREATE TABLE `user_sessions`(
    `session_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `device_id` BIGINT UNSIGNED NULL,
    `session_token` VARCHAR(500) NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `login_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    `logout_at` DATETIME NULL,
    `expires_at` DATETIME NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'active',
    INDEX `user_sessions_user_id_index`(`user_id`),
    INDEX `user_sessions_device_id_index`(`device_id`),
    UNIQUE KEY `user_sessions_session_token_unique`(`session_token`),
    CONSTRAINT `fk_user_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Audit Logs Table
CREATE TABLE `audit_logs`(
    `audit_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NULL,
    `device_id` BIGINT UNSIGNED NULL,
    `action` VARCHAR(100) NOT NULL,
    `module` VARCHAR(100) NULL,
    `table_name` VARCHAR(100) NULL,
    `record_id` VARCHAR(100) NULL,
    `old_data` JSON NULL,
    `new_data` JSON NULL,
    `ip_address` VARCHAR(45) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    INDEX `audit_logs_user_id_index`(`user_id`),
    INDEX `audit_logs_device_id_index`(`device_id`),
    INDEX `audit_logs_action_index`(`action`),
    INDEX `audit_logs_module_index`(`module`),
    INDEX `audit_logs_created_at_index`(`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
