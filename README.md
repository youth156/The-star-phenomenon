# 星光地图 - 粉丝共创互动平台

星光地图是一个基于React和Leaflet构建的粉丝互动地图应用，用户可以在地图上标记自己的位置，分享故事和照片，连接全国各地的粉丝。

## 技术栈

- **前端框架**: React 18
- **地图库**: Leaflet + react-leaflet
- **样式处理**: Tailwind CSS
- **构建工具**: Vite
- **HTTP客户端**: Axios

## 功能特性

- 🗺️ 交互式地图显示，支持缩放、平移和定位
- ⭐ 自定义星星形状标记，带有悬停动画效果
- 📝 用户可以添加标记，包含位置、昵称、留言和照片
- 📊 统计信息展示（标记数量、覆盖城市、分享照片、留言互动）
- 🎯 精选内容展示和过滤功能
- 📱 响应式设计，适配各种设备尺寸

## 安装与运行

### 前置要求

- Node.js (v14 或更高版本)
- npm 或 yarn

### 安装步骤

1. 克隆项目或下载代码

2. 安装依赖
```bash
npm install
# 或
yarn install
```

3. 启动开发服务器
```bash
npm run dev
# 或
yarn dev
```

4. 构建生产版本
```bash
npm run build
# 或
yarn build
```

5. 预览生产构建
```bash
npm run preview
# 或
yarn preview
```

## 项目结构

```
├── public/          # 静态资源
├── src/             # 源代码
│   ├── components/  # React组件
│   ├── assets/      # 图片、字体等资源
│   ├── App.jsx      # 主应用组件
│   ├── main.jsx     # 应用入口
│   ├── index.css    # 全局样式
│   └── App.css      # 应用样式
├── .gitignore       # Git忽略文件
├── package.json     # 项目配置和依赖
├── vite.config.js   # Vite配置
└── README.md        # 项目说明
```

## 开发说明

### 添加新组件
在 `src/components` 目录下创建新的组件文件，并在需要的地方导入使用。

### 自定义样式
- 全局样式在 `src/index.css` 中定义
- 组件特定样式在组件文件中或 `src/App.css` 中定义
- 使用 Tailwind CSS 类进行快速样式开发

### 数据处理
- 示例数据在 `sample-data.json` 文件中
- 实际应用中应连接到后端API获取数据

## 部署

### Vercel 部署
1. 连接 GitHub 仓库到 Vercel
2. 选择构建命令: `npm run build`
3. 选择输出目录: `dist`
4. 点击部署

### Netlify 部署
1. 连接 GitHub 仓库到 Netlify
2. 构建命令: `npm run build`
3. 发布目录: `dist`
4. 点击部署

## 许可证

本项目采用 MIT 许可证。

## 联系方式

如有任何问题或建议，欢迎联系我们！