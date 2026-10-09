CREATE TABLE IF NOT EXISTS projects (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(80)  NOT NULL,
    description VARCHAR(300) NOT NULL DEFAULT '',
    tags        JSON         NOT NULL,            -- JSON array of strings
    link        VARCHAR(500) NOT NULL DEFAULT '',
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_projects_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
