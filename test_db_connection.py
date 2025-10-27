# 测试数据库连接脚本
print("开始测试数据库连接...")

# 尝试导入必要的包
try:
    import pymysql
    print("✓ pymysql 包已安装")
except ImportError:
    print("✗ pymysql 包未安装")

try:
    from sqlalchemy import create_engine
    print("✓ sqlalchemy 包已安装")
except ImportError:
    print("✗ sqlalchemy 包未安装")

# 数据库连接参数
DB_USER = 'root@localhost'
DB_PASSWORD = 'z494TZjcdg?u'
DB_HOST = 'localhost'
DB_NAME = 'star_map'

# 尝试直接使用pymysql连接
try:
    print("\n尝试使用pymysql直接连接...")
    # 注意：对于root@localhost格式，我们需要分离用户名和主机
    conn = pymysql.connect(
        user='root',
        password=DB_PASSWORD,
        host=DB_HOST,
        database=DB_NAME,
        charset='utf8mb4'
    )
    print("✓ pymysql 连接成功!")
    conn.close()
except Exception as e:
    print(f"✗ pymysql 连接失败: {str(e)}")

# 尝试使用SQLAlchemy连接
try:
    print("\n尝试使用SQLAlchemy连接...")
    # 注意：对于root@localhost格式，我们需要调整连接字符串
    engine = create_engine(f'mysql+pymysql://root:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}')
    # 测试连接
    with engine.connect() as connection:
        result = connection.execute("SELECT 1")
        print("✓ SQLAlchemy 连接成功!")
except Exception as e:
    print(f"✗ SQLAlchemy 连接失败: {str(e)}")

print("\n测试完成。")