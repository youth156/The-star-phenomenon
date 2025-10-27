import React, { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import './App.css'

// 星星标记组件
const StarMarker = ({ position, color, onClick, children }) => {
  return (
    <Marker position={position} icon={
      L.divIcon({
        html: `<i class="fa fa-star text-${color === '#6366F1' ? 'indigo-500' : 'pink-500'} text-2xl custom-star-marker"></i>`,
        className: 'custom-star-marker-div',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      })
    } onClick={onClick}>
      {children}
    </Marker>
  )
}

function App() {
  const [markers, setMarkers] = useState([])
  const [selectedMarker, setSelectedMarker] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    location: '',
    nickname: '',
    message: '',
    image: null
  })
  const [stats, setStats] = useState({
    totalMarkers: 0,
    totalCities: 0,
    totalPhotos: 0,
    totalComments: 0
  })
  const mapRef = useRef(null)

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('sample-data.json')
        const data = await response.json()
        setMarkers(data.markers)
        setStats(data.stats)
      } catch (error) {
        console.error('Failed to load data:', error)
      }
    }
    loadData()
  }, [])

  // 处理表单提交
  const handleSubmit = (e) => {
    e.preventDefault()
    // 模拟地理编码 - 实际应用中应该使用地理编码API
    const newMarker = {
      id: Date.now(),
      nickname: formData.nickname,
      location: formData.location,
      position: [35 + Math.random() * 20, 105 + Math.random() * 30], // 随机中国境内位置
      message: formData.message,
      image: formData.image ? URL.createObjectURL(formData.image) : null,
      likes: 0,
      date: new Date().toISOString().split('T')[0]
    }
    
    setMarkers([...markers, newMarker])
    setStats(prev => ({
      ...prev,
      totalMarkers: prev.totalMarkers + 1,
      totalPhotos: formData.image ? prev.totalPhotos + 1 : prev.totalPhotos
    }))
    
    setShowModal(false)
    setFormData({ location: '', nickname: '', message: '', image: null })
  }

  // 处理图片上传
  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setFormData(prev => ({ ...prev, image: file }))
    }
  }

  return (
    <div className="App">
      {/* 导航栏 */}
      <nav className="fixed top-0 left-0 w-full bg-white/80 backdrop-blur-md shadow-sm z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <i className="fa fa-map-marker text-primary text-2xl mr-2 animate-pulse"></i>
              <span className="text-xl font-bold text-dark">星光地图</span>
            </div>
            <button 
              onClick={() => setShowModal(true)}
              className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-full font-medium flex items-center"
            >
              <i className="fa fa-plus mr-2"></i>
              标记我的位置
            </button>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="pt-20 pb-10">
        <div className="container mx-auto px-4">
          {/* 统计信息 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-4 rounded-xl shadow-sm">
              <div className="text-2xl font-bold text-primary">{stats.totalMarkers}</div>
              <div className="text-sm text-gray-500">标记数量</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm">
              <div className="text-2xl font-bold text-secondary">{stats.totalCities}</div>
              <div className="text-sm text-gray-500">覆盖城市</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm">
              <div className="text-2xl font-bold text-accent">{stats.totalPhotos}</div>
              <div className="text-sm text-gray-500">分享照片</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm">
              <div className="text-2xl font-bold text-green-500">{stats.totalComments}</div>
              <div className="text-sm text-gray-500">留言互动</div>
            </div>
          </div>

          {/* 地图区域 */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="h-[600px]" ref={mapRef}>
              <MapContainer 
                center={[35.8617, 104.1954]} 
                zoom={4} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap contributors"
                />
                {markers.map(marker => (
                  <StarMarker 
                    key={marker.id} 
                    position={marker.position} 
                    color="#6366F1"
                    onClick={() => setSelectedMarker(marker)}
                  >
                    <Popup>
                      <div className="min-w-[250px]">
                        <h3 className="font-bold text-lg">{marker.nickname}</h3>
                        <p className="text-sm text-gray-500 mb-2">{marker.location}</p>
                        <p className="mb-3">{marker.message}</p>
                        {marker.image && (
                          <img src={marker.image} alt="分享图片" className="w-full h-32 object-cover rounded-md mb-2" />
                        )}
                        <div className="flex justify-between items-center text-xs text-gray-500">
                          <span>{marker.date}</span>
                          <div className="flex items-center">
                            <i className="fa fa-heart-o mr-1"></i>
                            {marker.likes}
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </StarMarker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>
      </main>

      {/* 添加标记模态框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-dark">标记我的位置</h3>
                <button 
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <i className="fa fa-times text-xl"></i>
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">位置</label>
                  <input 
                    type="text" 
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="城市，例如：北京"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">昵称</label>
                  <input 
                    type="text" 
                    value={formData.nickname}
                    onChange={(e) => setFormData(prev => ({ ...prev, nickname: e.target.value }))}
                    placeholder="你的昵称"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">留言</label>
                  <textarea 
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    rows="4"
                    placeholder="分享你的故事或感受..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  ></textarea>
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">上传照片（可选）</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-lg font-medium"
                >
                  提交标记
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App