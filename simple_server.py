# 简单的Flask服务器示例
from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import os
import uuid
from datetime import datetime

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 文件存储配置
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

# 初始化示例数据
def init_sample_data():
    data = load_data()
    if len(data['markers']) > 0:
        print("已有数据，跳过示例数据初始化")
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
    print("示例数据初始化完成")

# API端点
@app.route('/api/markers', methods=['GET'])
def get_markers():
    data = load_data()
    return jsonify(data['markers'])

@app.route('/api/markers', methods=['POST'])
def add_marker():
    marker_data = request.json
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

@app.route('/api/stats', methods=['GET'])
def get_stats():
    data = load_data()
    return jsonify(data['stats'])

@app.route('/api/featured', methods=['GET'])
def get_featured():
    data = load_data()
    # 筛选带图片的标记，按创建时间排序，取最新的10个
    image_markers = [m for m in data['markers'] if m.get('image')]
    sorted_markers = sorted(
        image_markers,
        key=lambda x: x['date'],
        reverse=True
    )[:10]
    return jsonify(sorted_markers)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat()
    })

# 主入口
if __name__ == '__main__':
    print("=== 启动简单服务器 ===")
    ensure_data_file()
    init_sample_data()
    print("服务器启动中...")
    app.run(host='0.0.0.0', port=8000, debug=True)