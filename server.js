// Node.js Express后端服务
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8000;

// 中间件
app.use(cors());
app.use(express.json());

// 数据库配置
const DB_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: 'ZNN101012',
  database: 'star_map'
};

// 数据库初始化函数
async function initializeDatabase() {
  try {
    // 首先尝试连接数据库
    const connection = await mysql.createConnection({
      host: DB_CONFIG.host,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password
    });
    
    // 创建数据库（如果不存在）
    await connection.execute(`CREATE DATABASE IF NOT EXISTS ${DB_CONFIG.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.execute(`USE ${DB_CONFIG.database}`);
    
    // 创建用户表
    await connection.execute(`
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
      )
    `);
    
    // 创建位置表
    await connection.execute(`
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
      )
    `);
    
    // 创建内容表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS contents (
        id VARCHAR(50) PRIMARY KEY,
        location_id INTEGER,
        user_id INTEGER,
        message TEXT,
        image_path TEXT,
        image_url TEXT,
        likes_count INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        is_featured BOOLEAN DEFAULT FALSE,
        status VARCHAR(20) DEFAULT 'published',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // 创建点赞表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS likes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        content_id VARCHAR(50),
        user_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(content_id, user_id)
      )
    `);
    
    // 创建统计表
    await connection.execute(`
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
      )
    `);
    
    // 添加外键约束
    try {
      await connection.execute(`ALTER TABLE locations ADD CONSTRAINT IF NOT EXISTS fk_locations_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`);
      await connection.execute(`ALTER TABLE contents ADD CONSTRAINT IF NOT EXISTS fk_contents_locations FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE`);
      await connection.execute(`ALTER TABLE contents ADD CONSTRAINT IF NOT EXISTS fk_contents_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`);
      await connection.execute(`ALTER TABLE likes ADD CONSTRAINT IF NOT EXISTS fk_likes_contents FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE`);
      await connection.execute(`ALTER TABLE likes ADD CONSTRAINT IF NOT EXISTS fk_likes_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`);
    } catch (fkError) {
      console.log('外键约束添加失败，可能已存在:', fkError.message);
    }
    
    // 添加索引
    await connection.execute(`CREATE INDEX IF NOT EXISTS idx_locations_user_id ON locations(user_id)`);
    await connection.execute(`CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city)`);
    await connection.execute(`CREATE INDEX IF NOT EXISTS idx_contents_user_id ON contents(user_id)`);
    await connection.execute(`CREATE INDEX IF NOT EXISTS idx_contents_location_id ON contents(location_id)`);
    await connection.execute(`CREATE INDEX IF NOT EXISTS idx_contents_created_at ON contents(created_at)`);
    
    // 插入默认数据
    await connection.execute(`INSERT IGNORE INTO users (username, nickname) VALUES ('anonymous', '匿名用户')`);
    await connection.execute(`INSERT IGNORE INTO statistics (id, total_markers, total_cities, total_photos, total_comments) VALUES (1, 0, 0, 0, 0)`);
    
    // 更新统计信息
    await connection.execute(`
      UPDATE statistics SET 
        total_markers = (SELECT COUNT(*) FROM contents),
        total_cities = (SELECT COUNT(DISTINCT city) FROM locations WHERE city IS NOT NULL AND city != ''),
        total_photos = (SELECT COUNT(*) FROM contents WHERE image_url IS NOT NULL),
        total_comments = (SELECT COUNT(*) FROM contents)
      WHERE id = 1
    `);
    
    await connection.end();
    console.log('✓ 数据库初始化完成');
    return true;
  } catch (error) {
    console.error('✗ 数据库初始化失败:', error.message);
    return false;
  }
}

// 文件存储作为备选
const DATA_FILE = 'data.json';

// 确保数据文件存在
function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      markers: [],
      stats: {
        totalMarkers: 0,
        totalCities: 0,
        totalPhotos: 0,
        totalComments: 0
      }
    }, null, 2));
  }
}

// 初始化示例数据
function initSampleData() {
  ensureDataFile();
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  
  if (data.markers.length === 0) {
    const sampleMarkers = [
      {
        id: Date.now().toString() + '1',
        nickname: '旅行者小明',
        location: '北京',
        latitude: 39.9042,
        longitude: 116.4074,
        message: '故宫的雪景真美！',
        image: 'https://picsum.photos/id/1015/800/600',
        likes: 0,
        date: new Date().toISOString().slice(0, 19).replace('T', ' ')
      },
      {
        id: Date.now().toString() + '2',
        nickname: '摄影爱好者',
        location: '上海',
        latitude: 31.2304,
        longitude: 121.4737,
        message: '外滩夜景，灯火辉煌',
        image: 'https://picsum.photos/id/1016/800/600',
        likes: 0,
        date: new Date().toISOString().slice(0, 19).replace('T', ' ')
      },
      {
        id: Date.now().toString() + '3',
        nickname: '城市探险家',
        location: '广州',
        latitude: 23.1291,
        longitude: 113.2644,
        message: '广州塔下的美食街',
        image: 'https://picsum.photos/id/1019/800/600',
        likes: 0,
        date: new Date().toISOString().slice(0, 19).replace('T', ' ')
      }
    ];
    
    data.markers = sampleMarkers;
    data.stats.totalMarkers = sampleMarkers.length;
    data.stats.totalPhotos = sampleMarkers.filter(m => m.image).length;
    data.stats.totalCities = new Set(sampleMarkers.map(m => m.location)).size;
    data.stats.totalComments = sampleMarkers.length;
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('示例数据初始化完成');
  }
}

// 数据库连接测试
async function testDatabaseConnection() {
  try {
    // 首先初始化数据库
    await initializeDatabase();
    
    // 然后测试连接
    const connection = await mysql.createConnection(DB_CONFIG);
    await connection.end();
    console.log('✓ MySQL数据库连接成功');
    return true;
  } catch (error) {
    console.error('✗ MySQL数据库连接失败:', error.message);
    console.log('将使用文件存储模式');
    return false;
  }
}

// 获取标记列表 - 支持MySQL和文件存储
app.get('/api/markers', async (req, res) => {
  try {
    // 尝试使用数据库
    try {
      const connection = await mysql.createConnection(DB_CONFIG);
      // 使用更简单的查询以避免潜在的JOIN问题
      const [rows] = await connection.execute(`
        SELECT 
          c.id, 
          u.nickname, 
          IF(l.city IS NULL OR l.city = '', l.address, l.city) AS location, 
          l.latitude, 
          l.longitude, 
          c.message, 
          c.image_url AS image, 
          (SELECT COUNT(*) FROM likes WHERE content_id = c.id) AS likes, 
          c.created_at AS date
        FROM contents c
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN locations l ON c.location_id = l.id
        ORDER BY c.created_at DESC
      `);
      await connection.end();
      return res.json(rows);
    } catch (dbError) {
      console.log('数据库查询失败，使用文件存储:', dbError.message);
    }
    
    // 使用文件存储
    ensureDataFile();
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    res.json(data.markers);
  } catch (error) {
    console.error('获取标记错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 添加新标记
app.post('/api/markers', async (req, res) => {
  try {
    const { nickname, location, latitude, longitude, message, image } = req.body;
    const newMarker = {
      id: Date.now().toString(),
      nickname: nickname || '匿名用户',
      location: location || '',
      latitude: latitude || 35.86166,
      longitude: longitude || 104.195397,
      message: message || '',
      image: image || null,
      likes: 0,
      date: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };
    
    // 尝试使用数据库
    try {
      const connection = await mysql.createConnection(DB_CONFIG);
      
      // 创建或获取用户
      let [users] = await connection.execute(
        'SELECT id FROM users WHERE nickname = ?',
        [newMarker.nickname]
      );
      let userId;
      
      if (users.length === 0) {
        // 简化用户创建，确保有username字段
        const username = 'user_' + Date.now();
        const [result] = await connection.execute(
          'INSERT INTO users (username, nickname, created_at) VALUES (?, ?, NOW())',
          [username, newMarker.nickname]
        );
        userId = result.insertId;
      } else {
        userId = users[0].id;
      }
      
      // 创建位置
      const [locationResult] = await connection.execute(
        'INSERT INTO locations (latitude, longitude, city, address, user_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [newMarker.latitude, newMarker.longitude, newMarker.location, newMarker.location, userId]
      );
      const locationId = locationResult.insertId;
      
      // 创建内容
      await connection.execute(
        'INSERT INTO contents (id, user_id, location_id, message, image_url, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [newMarker.id, userId, locationId, newMarker.message, newMarker.image]
      );
      
      // 更新统计信息
      await connection.execute(`
        UPDATE statistics SET 
          total_markers = (SELECT COUNT(*) FROM contents),
          total_cities = (SELECT COUNT(DISTINCT city) FROM locations WHERE city IS NOT NULL AND city != ''),
          total_photos = (SELECT COUNT(*) FROM contents WHERE image_url IS NOT NULL),
          total_comments = (SELECT COUNT(*) FROM contents)
        WHERE id = 1
      `);
      
      await connection.end();
      console.log('标记已添加到数据库');
    } catch (dbError) {
      console.log('数据库写入失败，使用文件存储:', dbError.message);
    }
    
    // 使用文件存储（作为备份）
    ensureDataFile();
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    data.markers.push(newMarker);
    
    // 更新统计
    data.stats.totalMarkers++;
    if (newMarker.image) data.stats.totalPhotos++;
    data.stats.totalComments++;
    
    // 更新城市统计
    const cities = new Set(data.markers.map(m => m.location));
    data.stats.totalCities = cities.size;
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    
    res.json({ success: true, marker: newMarker });
  } catch (error) {
    console.error('添加标记错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取统计信息
app.get('/api/stats', async (req, res) => {
  try {
    // 尝试使用数据库
    try {
      const connection = await mysql.createConnection(DB_CONFIG);
      const [rows] = await connection.execute(
        'SELECT total_markers, total_cities, total_photos, total_comments FROM statistics LIMIT 1'
      );
      await connection.end();
      
      if (rows.length > 0) {
        return res.json({
          totalMarkers: rows[0].total_markers,
          totalCities: rows[0].total_cities,
          totalPhotos: rows[0].total_photos,
          totalComments: rows[0].total_comments
        });
      }
    } catch (dbError) {
      console.log('统计查询失败，使用文件存储:', dbError.message);
    }
    
    // 使用文件存储
    ensureDataFile();
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    res.json(data.stats);
  } catch (error) {
    console.error('获取统计错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取精选内容
app.get('/api/featured', async (req, res) => {
  try {
    // 尝试使用数据库
    try {
      const connection = await mysql.createConnection(DB_CONFIG);
      const [rows] = await connection.execute(`
        SELECT c.id, u.nickname, l.city AS location, l.latitude, l.longitude, 
               c.message, c.image_url AS image, 
               COUNT(lk.id) AS likes, c.created_at AS date
        FROM contents c
        JOIN users u ON c.user_id = u.id
        JOIN locations l ON c.location_id = l.id
        LEFT JOIN likes lk ON c.id = lk.content_id
        WHERE c.image_url IS NOT NULL
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT 10
      `);
      await connection.end();
      return res.json(rows);
    } catch (dbError) {
      console.log('精选内容查询失败，使用文件存储:', dbError.message);
    }
    
    // 使用文件存储
    ensureDataFile();
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const imageMarkers = data.markers.filter(m => m.image);
    const sortedMarkers = imageMarkers
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);
    
    res.json(sortedMarkers);
  } catch (error) {
    console.error('获取精选内容错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 点赞功能
app.post('/api/markers/:markerId/like', async (req, res) => {
  try {
    const { markerId } = req.params;
    let likes = 0;
    
    // 尝试使用数据库
    try {
      const connection = await mysql.createConnection(DB_CONFIG);
      await connection.execute(
        'INSERT INTO likes (content_id, created_at) VALUES (?, NOW())',
        [markerId]
      );
      
      const [result] = await connection.execute(
        'SELECT COUNT(*) as likes FROM likes WHERE content_id = ?',
        [markerId]
      );
      likes = result[0].likes;
      await connection.end();
    } catch (dbError) {
      console.log('点赞操作失败，返回默认值:', dbError.message);
      likes = 1; // 默认返回1个赞
    }
    
    res.json({ success: true, likes });
  } catch (error) {
    console.error('点赞错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// 启动服务器
async function startServer() {
  console.log('=== 启动 Star Map Node.js 后端服务 ===');
  
  // 测试数据库连接
  const dbConnected = await testDatabaseConnection();
  
  // 初始化文件存储和示例数据
  ensureDataFile();
  initSampleData();
  
  // 启动HTTP服务器
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`数据库模式: ${dbConnected ? '已启用' : '未启用，使用文件存储'}`);
    console.log('可用API端点:');
    console.log(`  - GET    http://localhost:${PORT}/api/markers      # 获取所有标记`);
    console.log(`  - POST   http://localhost:${PORT}/api/markers      # 添加新标记`);
    console.log(`  - GET    http://localhost:${PORT}/api/stats        # 获取统计信息`);
    console.log(`  - GET    http://localhost:${PORT}/api/featured     # 获取精选内容`);
    console.log(`  - POST   http://localhost:${PORT}/api/markers/:id/like  # 点赞标记`);
    console.log(`  - GET    http://localhost:${PORT}/health           # 健康检查`);
  });
}

// 启动应用
startServer().catch(error => {
  console.error('服务器启动失败:', error);
});