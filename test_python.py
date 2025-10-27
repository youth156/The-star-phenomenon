# 简单的Python测试脚本
print("Python环境测试")
print("当前工作目录:")
import os
print(os.getcwd())
print("\nPython版本:")
import sys
print(sys.version)
print("\n已安装的模块:")
import pkg_resources
try:
    for dist in pkg_resources.working_set:
        print(f"- {dist.project_name} ({dist.version})")
except Exception as e:
    print(f"无法获取已安装模块: {e}")
print("\n测试完成。")