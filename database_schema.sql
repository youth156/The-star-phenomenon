-- 星光地图数据库表结构设计

-- 用户信息表
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    nickname VARCHAR(50) NOT NULL,
    avatar_url TEXT,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 位置信息表
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address VARCHAR(255),
    city VARCHAR(100),
    province VARCHAR(100),
    country VARCHAR(100) DEFAULT '中国',
    timezone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- 添加地理空间索引以优化地理位置查询
    SPATIAL INDEX (latitude, longitude)
);

-- 内容信息表
CREATE TABLE contents (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,
    image_path TEXT,
    image_url TEXT,
    likes_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'published', -- published, pending, rejected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 点赞记录表
CREATE TABLE likes (
    id SERIAL PRIMARY KEY,
    content_id INTEGER REFERENCES contents(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- 确保一个用户只能点赞一次
    UNIQUE(content_id, user_id)
);

-- 统计信息表
CREATE TABLE statistics (
    id SERIAL PRIMARY KEY,
    total_users INTEGER DEFAULT 0,
    total_locations INTEGER DEFAULT 0,
    total_contents INTEGER DEFAULT 0,
    total_photos INTEGER DEFAULT 0,
    total_likes INTEGER DEFAULT 0,
    total_cities INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以优化查询性能
CREATE INDEX idx_locations_user_id ON locations(user_id);
CREATE INDEX idx_locations_city ON locations(city);
CREATE INDEX idx_contents_user_id ON contents(user_id);
CREATE INDEX idx_contents_location_id ON contents(location_id);
CREATE INDEX idx_contents_created_at ON contents(created_at);
CREATE INDEX idx_contents_is_featured ON contents(is_featured);

-- 添加初始统计记录
INSERT INTO statistics (id) VALUES (1) ON CONFLICT DO NOTHING;

-- 创建视图：用户位置内容联合视图
CREATE VIEW user_location_contents AS
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
    locations l ON u.id = l.user_id
JOIN 
    contents c ON l.id = c.location_id;

-- 创建触发器：更新统计信息
CREATE OR REPLACE FUNCTION update_statistics()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE statistics SET
        total_users = (SELECT COUNT(*) FROM users),
        total_locations = (SELECT COUNT(*) FROM locations),
        total_contents = (SELECT COUNT(*) FROM contents),
        total_photos = (SELECT COUNT(*) FROM contents WHERE image_url IS NOT NULL),
        total_likes = (SELECT SUM(likes_count) FROM contents),
        total_cities = (SELECT COUNT(DISTINCT city) FROM locations WHERE city IS NOT NULL),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 1;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 为相关表创建触发器
CREATE TRIGGER after_user_change
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH STATEMENT EXECUTE FUNCTION update_statistics();

CREATE TRIGGER after_location_change
AFTER INSERT OR UPDATE OR DELETE ON locations
FOR EACH STATEMENT EXECUTE FUNCTION update_statistics();

CREATE TRIGGER after_content_change
AFTER INSERT OR UPDATE OR DELETE ON contents
FOR EACH STATEMENT EXECUTE FUNCTION update_statistics();