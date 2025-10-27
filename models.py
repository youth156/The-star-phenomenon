from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Numeric, func, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

# 创建基类
Base = declarative_base()

# 用户信息表
class User(Base):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False, unique=True)
    nickname = db.Column(db.String(50), nullable=False)
    avatar_url = db.Column(db.Text)
    registration_date = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系定义
    locations = db.relationship('Location', backref='user', lazy=True, cascade='all, delete-orphan')
    contents = db.relationship('Content', backref='user', lazy=True, cascade='all, delete-orphan')
    likes = db.relationship('Like', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'nickname': self.nickname,
            'avatar_url': self.avatar_url,
            'registration_date': self.registration_date.isoformat() if self.registration_date else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'is_active': self.is_active
        }

# 位置信息表
class Location(Base):
    __tablename__ = 'locations'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    latitude = db.Column(db.Numeric(10, 8), nullable=False)
    longitude = db.Column(db.Numeric(11, 8), nullable=False)
    address = db.Column(db.String(255))
    city = db.Column(db.String(100))
    province = db.Column(db.String(100))
    country = db.Column(db.String(100), default='中国')
    timezone = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系定义
    contents = db.relationship('Content', backref='location', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'latitude': float(self.latitude),
            'longitude': float(self.longitude),
            'address': self.address,
            'city': self.city,
            'province': self.province,
            'country': self.country,
            'created_at': self.created_at.isoformat()
        }

# 内容信息表
class Content(Base):
    __tablename__ = 'contents'
    
    id = db.Column(db.Integer, primary_key=True)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    message = db.Column(db.Text)
    image_path = db.Column(db.Text)
    image_url = db.Column(db.Text)
    likes_count = db.Column(db.Integer, default=0)
    view_count = db.Column(db.Integer, default=0)
    is_featured = db.Column(db.Boolean, default=False)
    status = db.Column(db.String(20), default='published')  # published, pending, rejected
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系定义
    likes = db.relationship('Like', backref='content', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'location_id': self.location_id,
            'user_id': self.user_id,
            'message': self.message,
            'image_url': self.image_url,
            'likes_count': self.likes_count,
            'view_count': self.view_count,
            'is_featured': self.is_featured,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            # 关联的位置信息
            'latitude': float(self.location.latitude) if self.location else None,
            'longitude': float(self.location.longitude) if self.location else None,
            'city': self.location.city if self.location else None,
            'address': self.location.address if self.location else None,
            # 关联的用户信息
            'nickname': self.user.nickname if self.user else '匿名用户'
        }

# 点赞记录表
class Like(Base):
    __tablename__ = 'likes'
    
    id = db.Column(db.Integer, primary_key=True)
    content_id = db.Column(db.Integer, db.ForeignKey('contents.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 添加联合唯一约束，确保一个用户只能点赞一次
    __table_args__ = (db.UniqueConstraint('content_id', 'user_id', name='_content_user_uc'),)

# 统计信息表
class Statistics(Base):
    __tablename__ = 'statistics'
    
    id = db.Column(db.Integer, primary_key=True)
    total_users = db.Column(db.Integer, default=0)
    total_locations = db.Column(db.Integer, default=0)
    total_contents = db.Column(db.Integer, default=0)
    total_photos = db.Column(db.Integer, default=0)
    total_likes = db.Column(db.Integer, default=0)
    total_cities = db.Column(db.Integer, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'total_users': self.total_users,
            'total_locations': self.total_locations,
            'total_contents': self.total_contents,
            'total_photos': self.total_photos,
            'total_likes': self.total_likes,
            'total_cities': self.total_cities,
            'updated_at': self.updated_at.isoformat()
        }

# 数据库初始化函数不再需要，已在start-server.py中实现

# 更新统计信息函数
def update_statistics(session):
    stats = session.query(Statistics).first()
    if stats:
        # 使用SQLAlchemy的func来获取计数
        stats.total_users = session.query(func.count(User.id)).scalar()
        stats.total_locations = session.query(func.count(Location.id)).scalar()
        stats.total_contents = session.query(func.count(Content.id)).scalar()
        stats.total_photos = session.query(func.count(Content.id)).filter(Content.image_url.isnot(None)).scalar()
        stats.total_likes = session.query(func.count(Like.id)).scalar()
        stats.total_cities = session.query(func.count(func.distinct(Location.city))).filter(Location.city.isnot(None) & Location.city != '').scalar()
        stats.updated_at = datetime.now()
        
        # 更新总标记数（向后兼容）
        stats.total_markers = stats.total_contents
        
        session.commit()
        return stats
    return None

# 创建示例数据函数已在start-server.py中实现
        Location(user_id=users[2].id, latitude=23.1291, longitude=113.2644, city='广州', address='广州市天河区')
    ]
    db.session.add_all(locations)
    db.session.commit()
    
    # 创建示例内容
    contents = [
        Content(location_id=locations[0].id, user_id=users[0].id, message='大家好！北京欢迎你！', likes_count=32),
        Content(location_id=locations[1].id, user_id=users[1].id, message='魔都打卡！', likes_count=28),
        Content(location_id=locations[2].id, user_id=users[2].id, message='广州塔下的问候！', likes_count=25)
    ]
    db.session.add_all(contents)
    db.session.commit()
    
    # 更新统计信息
    update_statistics()