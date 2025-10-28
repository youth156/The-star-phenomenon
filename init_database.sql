-- 星光地图数据库表结构设计（MySQL兼容版）

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS star_map CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 使用数据库
USE star_map;

-- 用户信息表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    nickname VARCHAR(50) NOT NULL,
    avatar_url TEXT,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 位置信息表
CREATE TABLE IF NOT EXISTS locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INTEGER,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address VARCHAR(255),
    city VARCHAR(100),
    province VARCHAR(100),
    country VARCHAR(100) DEFAULT '中国',
    timezone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_latitude_longitude (latitude, longitude)
);

-- 添加外键约束
ALTER TABLE locations ADD CONSTRAINT fk_locations_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 内容信息表
CREATE TABLE IF NOT EXISTS contents (
    id VARCHAR(50) PRIMARY KEY, -- 使用字符串ID以匹配前端生成的ID
    location_id INTEGER,
    user_id INTEGER,
    message TEXT,
    image_path TEXT,
    image_url TEXT,
    likes_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'published', -- published, pending, rejected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 添加外键约束
ALTER TABLE contents ADD CONSTRAINT fk_contents_locations FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;
ALTER TABLE contents ADD CONSTRAINT fk_contents_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 点赞记录表
CREATE TABLE IF NOT EXISTS likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    content_id VARCHAR(50),
    user_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- 确保一个用户只能点赞一次
    UNIQUE(content_id, user_id)
);

-- 添加外键约束
ALTER TABLE likes ADD CONSTRAINT fk_likes_contents FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE;
ALTER TABLE likes ADD CONSTRAINT fk_likes_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 统计信息表
CREATE TABLE IF NOT EXISTS statistics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    total_users INTEGER DEFAULT 0,
    total_locations INTEGER DEFAULT 0,
    total_contents INTEGER DEFAULT 0,
    total_photos INTEGER DEFAULT 0,
    total_likes INTEGER DEFAULT 0,
    total_cities INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    total_markers INT DEFAULT 0,
    total_comments INT DEFAULT 0
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_locations_user_id ON locations(user_id);
CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);
CREATE INDEX IF NOT EXISTS idx_contents_user_id ON contents(user_id);
CREATE INDEX IF NOT EXISTS idx_contents_location_id ON contents(location_id);
CREATE INDEX IF NOT EXISTS idx_contents_created_at ON contents(created_at);
CREATE INDEX IF NOT EXISTS idx_contents_is_featured ON contents(is_featured);

-- 添加初始统计记录
INSERT INTO statistics (id, total_markers, total_cities, total_photos, total_comments) 
VALUES (1, 0, 0, 0, 0) 
ON DUPLICATE KEY UPDATE id = id;

-- 创建视图：用户位置内容联合视图
CREATE OR REPLACE VIEW user_location_contents AS
SELECT 
    u.id as user_id,
    u.username,
    u.nickname,
    l.id as location_id,
    l.latitude,
    l.longitude,
    l.address,
    l.city,
    c.id as content_id,
    c.message,
    c.image_url,
    c.likes_count,
    c.created_at
FROM 
    users u
JOIN 
    contents c ON u.id = c.user_id
JOIN 
    locations l ON c.location_id = l.id;

-- 插入默认匿名用户
INSERT INTO users (username, nickname) 
VALUES ('anonymous', '匿名用户') 
ON DUPLICATE KEY UPDATE nickname = nickname;

-- 初始化统计数据的存储过程
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS update_statistics()
BEGIN
    UPDATE statistics SET 
        total_users = (SELECT COUNT(*) FROM users),
        total_locations = (SELECT COUNT(*) FROM locations),
        total_contents = (SELECT COUNT(*) FROM contents),
        total_photos = (SELECT COUNT(*) FROM contents WHERE image_url IS NOT NULL),
        total_likes = (SELECT COUNT(*) FROM likes),
        total_cities = (SELECT COUNT(DISTINCT city) FROM locations WHERE city IS NOT NULL AND city != ''),
        total_markers = (SELECT COUNT(*) FROM contents),
        total_comments = (SELECT COUNT(*) FROM contents)
    WHERE id = 1;
END //
DELIMITER ;

-- 执行初始统计更新
CALL update_statistics();

SELECT '数据库初始化完成' AS result;