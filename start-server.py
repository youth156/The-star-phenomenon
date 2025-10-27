from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import uuid
from datetime import datetime
import json
import os

# 添加错误处理，确保即使缺少数据库相关包也能启动
HAS_DATABASE = False
try:
    from sqlalchemy import create_engine, func
    from sqlalchemy.orm import sessionmaker
    from models import User, Location, Content, Like, Statistics, Base, update_statistics
    HAS_DATABASE = True
    print("✓ 数据库相关包导入成功")
except ImportError as e:
    print(f"✗ 数据库相关包导入失败: {str(e)}")
    print("将使用文件存储模式作为备选")

app = Flask(__name__, static_folder='dist')
CORS(app)  # 允许跨域请求

# 数据库配置
if HAS_DATABASE:
    # MySQL数据库配置 - 注意：用户名应为root，主机名已单独指定
    DB_USER = 'root'  # 用户名
    DB_PASSWORD = 'z494TZjcdg?u'  # 密码
    DB_HOST = 'localhost'
    DB_NAME = 'star_map'
    
    try:
        # 创建数据库引擎
        engine = create_engine(f'mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}', echo=True)
        # 创建会话工厂
        Session = sessionmaker(bind=engine)
        print("✓ 数据库引擎创建成功")
    except Exception as e:
        print(f"✗ 数据库引擎创建失败: {str(e)}")
        HAS_DATABASE = False

# 文件存储作为备选方案
DATA_FILE = 'data.json'

# 确保数据文件存在
def ensure_data_file():
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump({
                'markers': [],
                'stats': {
                    'totalMarkers': 0,
                    'totalCities': 0,
                    'totalPhotos': 0,
                    'totalComments': 0
                }
            }, f, ensure_ascii=False, indent=2)

# 读取数据
def load_data():
    ensure_data_file()
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

# 保存数据
def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# 初始化数据库
def init_db():
    if HAS_DATABASE:
        try:
            # 创建所有表
            Base.metadata.create_all(engine)
            print("✓ 数据库表创建成功")
            
            # 初始化统计信息
            session = Session()
            try:
                # 检查统计信息是否存在
                stats = session.query(Statistics).first()
                if not stats:
                    # 创建初始统计信息
                    stats = Statistics(
                        total_markers=0,
                        total_cities=0,
                        total_photos=0,
                        total_comments=0,
                        last_updated=datetime.now()
                    )
                    session.add(stats)
                    session.commit()
                    print("✓ 统计信息初始化成功")
            except Exception as e:
                print(f"初始化统计信息时出错: {e}")
                session.rollback()
            finally:
                session.close()
        except Exception as e:
            print(f"初始化数据库时出错: {e}")
    else:
        # 初始化文件存储
        ensure_data_file()
        print("✓ 文件存储初始化成功")

# 获取数据库会话
def get_db():
    if HAS_DATABASE:
        session = Session()
        try:
            yield session
        finally:
            session.close()
    else:
        # 对于文件存储，返回None
        yield None

# 获取所有标记
@app.route('/api/markers', methods=['GET'])
def get_markers():
    db = next(get_db())
    
    if HAS_DATABASE and db:
        try:
            # 过滤选项
            with_images = request.args.get('withImages', 'true').lower() == 'true'
            recent_only = request.args.get('recent', 'false').lower() == 'true'
            
            # 构建查询
            query = db.query(Content).join(User).join(Location)
            
            if with_images:
                query = query.filter(Content.image_url.isnot(None))
            
            if recent_only:
                query = query.order_by(Content.created_at.desc()).limit(20)
            else:
                query = query.order_by(Content.created_at.desc())
            
            # 执行查询
            contents = query.all()
            
            # 转换为JSON格式
            markers = []
            for content in contents:
                # 计算点赞数
                like_count = db.query(func.count(Like.id)).filter(Like.content_id == content.id).scalar()
                
                marker = {
                    'id': content.id,
                    'nickname': content.user.nickname,
                    'location': content.location.city,
                    'latitude': content.location.latitude,
                    'longitude': content.location.longitude,
                    'message': content.message,
                    'image': content.image_url,
                    'likes': like_count,
                    'date': content.created_at.strftime('%Y-%m-%d %H:%M:%S')
                }
                markers.append(marker)
            
            return jsonify(markers)
        except Exception as e:
            print(f"数据库查询错误: {e}")
            # 失败时回退到文件模式
    
    # 文件模式
    try:
        data = load_data()
        return jsonify(data['markers'])
    except Exception as e:
        print(f"文件读取错误: {e}")
        return jsonify([])

# 添加新标记
@app.route('/api/markers', methods=['POST'])
def add_marker():
    marker_data = request.json
    db = next(get_db())
    
    if HAS_DATABASE and db:
        try:
            # 创建用户（如果不存在）
            nickname = marker_data.get('nickname', '匿名用户')
            user = db.query(User).filter(User.nickname == nickname).first()
            if not user:
                user = User(
                    nickname=nickname,
                    created_at=datetime.now()
                )
                db.add(user)
                db.flush()  # 获取用户ID
            
            # 创建位置
            location = Location(
                latitude=marker_data.get('latitude', 35.86166),
                longitude=marker_data.get('longitude', 104.195397),
                city=marker_data.get('location', ''),
                created_at=datetime.now()
            )
            db.add(location)
            db.flush()  # 获取位置ID
            
            # 创建内容
            content = Content(
                id=str(uuid.uuid4()),
                user_id=user.id,
                location_id=location.id,
                message=marker_data.get('message', ''),
                image_url=marker_data.get('image', None),
                created_at=datetime.now()
            )
            db.add(content)
            
            # 提交事务
            db.commit()
            
            # 更新统计信息
            update_statistics(db)
            
            # 返回创建的标记
            marker = {
                'id': content.id,
                'nickname': user.nickname,
                'location': location.city,
                'latitude': location.latitude,
                'longitude': location.longitude,
                'message': content.message,
                'image': content.image_url,
                'likes': 0,
                'date': content.created_at.strftime('%Y-%m-%d %H:%M:%S')
            }
            
            return jsonify({'success': True, 'marker': marker})
        except Exception as e:
            print(f"数据库写入错误: {e}")
            db.rollback()
            # 失败时回退到文件模式
    
    # 文件模式
    try:
        marker = {
            'id': str(uuid.uuid4()),
            'nickname': marker_data.get('nickname', '匿名用户'),
            'location': marker_data.get('location', ''),
            'latitude': marker_data.get('latitude', 35.86166),
            'longitude': marker_data.get('longitude', 104.195397),
            'message': marker_data.get('message', ''),
            'image': marker_data.get('image', None),
            'likes': 0,
            'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        all_data = load_data()
        all_data['markers'].append(marker)
        
        # 更新统计
        all_data['stats']['totalMarkers'] += 1
        all_data['stats']['totalPhotos'] += 1 if marker['image'] else 0
        
        # 更新城市统计
        cities = set(m['location'] for m in all_data['markers'] if m['location'])
        all_data['stats']['totalCities'] = len(cities)
        
        save_data(all_data)
        return jsonify({'success': True, 'marker': marker})
    except Exception as e:
        print(f"文件写入错误: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# 获取统计信息
@app.route('/api/stats', methods=['GET'])
def get_stats():
    db = next(get_db())
    
    if HAS_DATABASE and db:
        try:
            # 获取统计信息
            stats = db.query(Statistics).first()
            if stats:
                return jsonify({
                    'totalMarkers': stats.total_markers,
                    'totalCities': stats.total_cities,
                    'totalPhotos': stats.total_photos,
                    'totalComments': stats.total_comments
                })
        except Exception as e:
            print(f"统计查询错误: {e}")
    
    # 文件模式
    try:
        data = load_data()
        return jsonify(data['stats'])
    except Exception as e:
        print(f"统计读取错误: {e}")
    
    return jsonify({
        'totalMarkers': 0,
        'totalCities': 0,
        'totalPhotos': 0,
        'totalComments': 0
    })

# 获取精选内容
@app.route('/api/featured', methods=['GET'])
def get_featured():
    db = next(get_db())
    
    if HAS_DATABASE and db:
        try:
            # 获取最新的10个带图片的标记
            query = db.query(Content).join(User).join(Location)
            query = query.filter(Content.image_url.isnot(None))
            query = query.order_by(Content.created_at.desc()).limit(10)
            
            contents = query.all()
            
            # 转换为JSON格式
            featured = []
            for content in contents:
                # 计算点赞数
                like_count = db.query(func.count(Like.id)).filter(Like.content_id == content.id).scalar()
                
                marker = {
                    'id': content.id,
                    'nickname': content.user.nickname,
                    'location': content.location.city,
                    'latitude': content.location.latitude,
                    'longitude': content.location.longitude,
                    'message': content.message,
                    'image': content.image_url,
                    'likes': like_count,
                    'date': content.created_at.strftime('%Y-%m-%d %H:%M:%S')
                }
                featured.append(marker)
            
            return jsonify(featured)
        except Exception as e:
            print(f"精选内容查询错误: {e}")
    
    # 文件模式：返回最新的10个带图片的标记
    try:
        data = load_data()
        # 筛选带图片的标记，按创建时间排序，取最新的10个
        image_markers = [m for m in data['markers'] if m.get('image')]
        sorted_markers = sorted(
            image_markers,
            key=lambda x: x['date'],
            reverse=True
        )[:10]
        return jsonify(sorted_markers)
    except Exception as e:
        print(f"精选内容读取错误: {e}")
    
    return jsonify([])

# 为标记点赞
@app.route('/api/markers/<marker_id>/like', methods=['POST'])
def like_marker(marker_id):
    db = next(get_db())
    
    if HAS_DATABASE and db:
        try:
            # 检查内容是否存在
            content = db.query(Content).filter(Content.id == marker_id).first()
            if not content:
                return jsonify({'success': False, 'error': '标记不存在'}), 404
            
            # 创建点赞记录
            like = Like(
                content_id=content.id,
                created_at=datetime.now()
            )
            db.add(like)
            db.commit()
            
            # 计算最新点赞数
            like_count = db.query(func.count(Like.id)).filter(Like.content_id == marker_id).scalar()
            
            return jsonify({'success': True, 'likes': like_count})
        except Exception as e:
            print(f"点赞操作错误: {e}")
            db.rollback()
    
    # 文件模式暂不支持点赞持久化，但仍返回成功以保持前端兼容性
    return jsonify({'success': True, 'likes': 1})

# 静态文件服务
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_static(path):
    if path != '' and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

# 健康检查端点
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'database_enabled': HAS_DATABASE,
        'timestamp': datetime.now().isoformat()
    })

# 初始化示例数据
def init_sample_data():
    db = next(get_db())
    
    if HAS_DATABASE and db:
        try:
            # 检查是否已有数据
            content_count = db.query(func.count(Content.id)).scalar()
            if content_count > 0:
                print("数据库已有数据，跳过示例数据初始化")
                return
            
            # 创建示例用户
            users = [
                {'nickname': '旅行者小明'},
                {'nickname': '摄影爱好者'},
                {'nickname': '城市探险家'}
            ]
            
            # 创建用户对象
            user_objects = []
            for user_data in users:
                user = User(nickname=user_data['nickname'], created_at=datetime.now())
                db.add(user)
                user_objects.append(user)
            
            db.flush()  # 获取用户ID
            
            # 示例位置数据
            locations = [
                {'latitude': 39.9042, 'longitude': 116.4074, 'city': '北京'},
                {'latitude': 31.2304, 'longitude': 121.4737, 'city': '上海'},
                {'latitude': 23.1291, 'longitude': 113.2644, 'city': '广州'},
                {'latitude': 22.5431, 'longitude': 114.0579, 'city': '深圳'},
                {'latitude': 30.5728, 'longitude': 104.0668, 'city': '成都'}
            ]
            
            # 创建位置对象
            location_objects = []
            for loc_data in locations:
                location = Location(
                    latitude=loc_data['latitude'],
                    longitude=loc_data['longitude'],
                    city=loc_data['city'],
                    created_at=datetime.now()
                )
                db.add(location)
                location_objects.append(location)
            
            db.flush()  # 获取位置ID
            
            # 示例内容数据
            contents = [
                {
                    'user': user_objects[0],
                    'location': location_objects[0],
                    'message': '故宫的雪景真美！',
                    'image_url': 'https://picsum.photos/id/1015/800/600'
                },
                {
                    'user': user_objects[1],
                    'location': location_objects[1],
                    'message': '外滩夜景，灯火辉煌',
                    'image_url': 'https://picsum.photos/id/1016/800/600'
                },
                {
                    'user': user_objects[2],
                    'location': location_objects[2],
                    'message': '广州塔下的美食街',
                    'image_url': 'https://picsum.photos/id/1019/800/600'
                },
                {
                    'user': user_objects[0],
                    'location': location_objects[3],
                    'message': '深圳湾公园的日落',
                    'image_url': 'https://picsum.photos/id/1039/800/600'
                },
                {
                    'user': user_objects[1],
                    'location': location_objects[4],
                    'message': '成都火锅真是太香了！',
                    'image_url': 'https://picsum.photos/id/292/800/600'
                }
            ]
            
            # 创建内容对象
            for content_data in contents:
                content = Content(
                    id=str(uuid.uuid4()),
                    user_id=content_data['user'].id,
                    location_id=content_data['location'].id,
                    message=content_data['message'],
                    image_url=content_data['image_url'],
                    created_at=datetime.now()
                )
                db.add(content)
            
            # 提交事务
            db.commit()
            print("数据库示例数据初始化完成")
            
            # 更新统计信息
            update_statistics(db)
        except Exception as e:
            print(f"初始化数据库示例数据时出错: {e}")
            db.rollback()
    else:
        # 文件模式初始化示例数据
        try:
            data = load_data()
            if len(data['markers']) > 0:
                print("文件已有数据，跳过示例数据初始化")
                return
            
            # 示例标记数据
            sample_markers = [
                {
                    'id': str(uuid.uuid4()),
                    'nickname': '旅行者小明',
                    'location': '北京',
                    'latitude': 39.9042,
                    'longitude': 116.4074,
                    'message': '故宫的雪景真美！',
                    'image': 'https://picsum.photos/id/1015/800/600',
                    'likes': 0,
                    'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                },
                {
                    'id': str(uuid.uuid4()),
                    'nickname': '摄影爱好者',
                    'location': '上海',
                    'latitude': 31.2304,
                    'longitude': 121.4737,
                    'message': '外滩夜景，灯火辉煌',
                    'image': 'https://picsum.photos/id/1016/800/600',
                    'likes': 0,
                    'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                },
                {
                    'id': str(uuid.uuid4()),
                    'nickname': '城市探险家',
                    'location': '广州',
                    'latitude': 23.1291,
                    'longitude': 113.2644,
                    'message': '广州塔下的美食街',
                    'image': 'https://picsum.photos/id/1019/800/600',
                    'likes': 0,
                    'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                },
                {
                    'id': str(uuid.uuid4()),
                    'nickname': '旅行者小明',
                    'location': '深圳',
                    'latitude': 22.5431,
                    'longitude': 114.0579,
                    'message': '深圳湾公园的日落',
                    'image': 'https://picsum.photos/id/1039/800/600',
                    'likes': 0,
                    'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                },
                {
                    'id': str(uuid.uuid4()),
                    'nickname': '摄影爱好者',
                    'location': '成都',
                    'latitude': 30.5728,
                    'longitude': 104.0668,
                    'message': '成都火锅真是太香了！',
                    'image': 'https://picsum.photos/id/292/800/600',
                    'likes': 0,
                    'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }
            ]
            
            # 添加示例数据
            data['markers'] = sample_markers
            
            # 更新统计信息
            data['stats']['totalMarkers'] = len(sample_markers)
            data['stats']['totalPhotos'] = len([m for m in sample_markers if m['image']])
            data['stats']['totalCities'] = len(set(m['location'] for m in sample_markers))
            data['stats']['totalComments'] = len(sample_markers)
            
            save_data(data)
            print("文件示例数据初始化完成")
        except Exception as e:
            print(f"初始化文件示例数据时出错: {e}")

if __name__ == '__main__':
    print("=== 启动 Star Map 服务器 ===")
    
    # 初始化数据库
    print("正在初始化数据库...")
    init_db()
    
    # 初始化示例数据
    print("正在初始化示例数据...")
    init_sample_data()
    
    print("服务器配置完成，正在启动...")
    print(f"数据库模式: {'已启用' if HAS_DATABASE else '未启用，使用文件存储'}")
    
    # 启动服务器
    app.run(host='0.0.0.0', port=8000, debug=True)