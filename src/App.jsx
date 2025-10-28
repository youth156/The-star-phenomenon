import React, { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import './App.css'

// 星星标记组件
const StarMarker = ({ position, color, onClick, children }) => {
  return (
    <Marker position={position} icon={
      L.divIcon({
        html: `<div style="color: ${color}; font-size: 24px; text-shadow: 0 0 3px rgba(0,0,0,0.3);">✨</div>`,
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
    image: null,
    latitude: null,
    longitude: null
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
    // 从后端API加载数据
    const loadData = async () => {
      try {
        // 加载标记数据
        const markersResponse = await fetch('http://localhost:8000/api/markers');
        if (markersResponse.ok) {
          const markersData = await markersResponse.json();
          // 确保数据格式正确
          const formattedMarkers = Array.isArray(markersData) ? markersData.map(marker => ({
            ...marker,
            position: marker.position || [marker.latitude, marker.longitude]
          })) : [];
          setMarkers(formattedMarkers);
          // 同时保存到localStorage作为备份
          localStorage.setItem('markers', JSON.stringify(formattedMarkers));
          
          // 更新统计信息
          updateStats(formattedMarkers);
        } else {
          console.error('加载标记失败:', markersResponse.status);
          // 如果API失败，从localStorage加载
          loadFromLocalStorage();
        }
      } catch (error) {
        console.error('加载数据错误:', error);
        // 出现网络错误时，尝试从localStorage加载
        loadFromLocalStorage();
      }
    };

    const loadFromLocalStorage = () => {
      const storedMarkers = localStorage.getItem('markers');
      if (storedMarkers) {
        try {
          const markers = JSON.parse(storedMarkers);
          const formattedMarkers = Array.isArray(markers) ? markers.map(marker => ({
            ...marker,
            position: marker.position || [marker.latitude, marker.longitude]
          })) : [];
          setMarkers(formattedMarkers);
          updateStats(formattedMarkers);
        } catch (parseError) {
          console.error('解析localStorage数据失败:', parseError);
          setMarkers([]);
          setStats({ totalMarkers: 0, totalCities: 0, totalPhotos: 0, totalComments: 0 });
        }
      } else {
        // 最后尝试从sample-data.json加载
        fetch('sample-data.json')
          .then(response => response.json())
          .then((sampleData) => {
            if (sampleData.markers) {
              const formattedMarkers = sampleData.markers.map(marker => ({
                ...marker,
                position: [marker.latitude, marker.longitude]
              }));
              setMarkers(formattedMarkers);
              setStats(sampleData.stats || { totalMarkers: 0, totalCities: 0, totalPhotos: 0, totalComments: 0 });
              localStorage.setItem('markers', JSON.stringify(formattedMarkers));
            }
          })
          .catch(() => {
            setStats({ totalMarkers: 0, totalCities: 0, totalPhotos: 0, totalComments: 0 });
          });
      }
    };

    const updateStats = (markers) => {
      const stats = {
        totalMarkers: markers.length,
        totalCities: new Set(markers.map(m => m.location).filter(loc => loc && loc.trim())).size,
        totalPhotos: markers.filter(m => m.image).length,
        totalComments: markers.length
      };
      setStats(stats);
    };

    loadData();

    // 设置定期更新（每30秒）
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [])

  // 获取用户地理位置
  const getUserLocation = () => {
    if (!navigator.geolocation) {
      alert('您的浏览器不支持地理位置功能')
      return Promise.reject(new Error('Geolocation not supported'))
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords
          
          // 使用反向地理编码API获取位置名称（使用OpenStreetMap Nominatim）
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
              {
                headers: {
                  'User-Agent': 'StarMapApp/1.0'
                }
              }
            )
            
            if (!response.ok) throw new Error('Geocoding failed')
            
            const data = await response.json()
            let locationName = '未知位置'
            
            // 构建位置名称
            if (data.address) {
              const { city, town, village, state, country } = data.address
              locationName = [city || town || village, state, country]
                .filter(Boolean)
                .join(', ')
            }
            
            setFormData(prev => ({
              ...prev,
              location: locationName,
              latitude,
              longitude
            }))
            
            resolve({ latitude, longitude, locationName })
          } catch (error) {
            console.error('反向地理编码失败:', error)
            // 即使地理编码失败，也保存经纬度
            setFormData(prev => ({
              ...prev,
              location: `位置(${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
              latitude,
              longitude
            }))
            resolve({ latitude, longitude, locationName: '基于坐标的位置' })
          }
        },
        (error) => {
          console.error('获取位置失败:', error)
          let errorMessage = '获取位置失败'
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = '您拒绝了位置请求权限'
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = '位置信息不可用'
              break
            case error.TIMEOUT:
              errorMessage = '获取位置超时'
              break
          }
          alert(errorMessage)
          reject(error)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5分钟缓存
        }
      )
    })
  }

  // 处理打开模态框
  const handleOpenModal = async () => {
    // 尝试获取用户位置
    await getUserLocation().catch(() => {
      // 位置获取失败不阻止模态框打开
    })
    setShowModal(true)
  }

  // 处理表单提交
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // 使用用户位置或随机位置
    const position = formData.latitude && formData.longitude 
      ? [formData.latitude, formData.longitude]
      : [35 + Math.random() * 20, 105 + Math.random() * 30]
    
    // 对于图片，使用在线图片服务或占位符
    let imageUrl = null
    if (formData.image) {
      // 如果是新上传的文件，使用picsum.photos作为演示
      if (formData.image instanceof File) {
        // 使用随机图片作为演示
        const randomId = Math.floor(Math.random() * 1000)
        imageUrl = `https://picsum.photos/id/${randomId}/800/600`
        // 在实际应用中，这里应该上传文件到服务器
      } else {
        imageUrl = formData.image
      }
    }
    
    // 准备发送到后端的数据
    const newMarker = {
      nickname: formData.nickname || '匿名用户',
      location: formData.location || '未知位置',
      latitude: position[0],
      longitude: position[1],
      message: formData.message || '',
      image: imageUrl
    }
    
    try {
      // 发送数据到后端API
      const response = await fetch('http://localhost:8000/api/markers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newMarker)
      })
      
      if (response.ok) {
        const result = await response.json();
        const markerWithPosition = {
          ...result.marker,
          position: result.marker.position || [result.marker.latitude, result.marker.longitude]
        };
        // 更新本地状态
        const updatedMarkers = [...markers, markerWithPosition];
        setMarkers(updatedMarkers);
        // 保存到localStorage作为备份
        localStorage.setItem('markers', JSON.stringify(updatedMarkers));
        // 更新统计
        updateStats(updatedMarkers);
        // 显示成功消息
        alert('标记添加成功！其他用户现在可以看到您的标记了。')
      } else {
        console.error('提交失败:', response.status);
        // 如果API失败，直接添加到本地
        addLocalMarker(newMarker);
        alert('添加标记成功（本地模式）！');
      }
    } catch (error) {
      console.error('提交错误:', error);
      // 网络错误时也添加到本地
      addLocalMarker(newMarker);
      alert('添加标记成功（本地模式）！');
    }
    
    // 重置表单和模态框
    setShowModal(false)
    setFormData({ location: '', nickname: '', message: '', image: null, latitude: null, longitude: null })
  }
  
  const addLocalMarker = (markerData) => {
    const localMarker = {
      ...markerData,
      id: Date.now().toString(),
      likes: 0,
      date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      position: [markerData.latitude, markerData.longitude]
    };
    const updatedMarkers = [...markers, localMarker];
    setMarkers(updatedMarkers);
    localStorage.setItem('markers', JSON.stringify(updatedMarkers));
    // 更新统计
    updateStats(updatedMarkers);
  };

  const updateStats = (currentMarkers) => {
    const stats = {
      totalMarkers: currentMarkers.length,
      totalCities: new Set(currentMarkers.map(m => m.location || '').filter(loc => loc.trim())).size,
      totalPhotos: currentMarkers.filter(m => m.image).length,
      totalComments: currentMarkers.length
    };
    setStats(stats);
  }

  // 处理图片上传
  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setFormData(prev => ({ ...prev, image: file }))
    }
  }

  return (
    <>
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
                onClick={handleOpenModal}
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
            <div className="bg-white rounded-xl shadow-sm overflow-hidden w-full">
              <div className="w-full h-[600px] md:h-[700px] lg:h-[800px]" ref={mapRef} style={{ zIndex: 1 }}>
                <MapContainer 
                  center={[35.8617, 104.1954]} 
                  zoom={4} 
                  style={{ height: '100%', width: '100%', zIndex: 1 }}
                  attributionControl={true}
                  zoomControl={true}
                  scrollWheelZoom={true}
                  dragging={true}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap contributors"
                    maxZoom={19}
                    minZoom={3}
                    crossOrigin={true}
                    keepBuffer={1}
                    noWrap={true}
                    errorTileUrl="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256' viewBox='0 0 256 256'%3E%3Crect width='256' height='256' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='12' fill='%23999'%3ETile loading...%3C/text%3E%3C/svg%3E"
                    maxNativeZoom={19}
                  />
                  {/* 添加备用瓦片源作为回退 */}
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap contributors"
                    maxZoom={19}
                    minZoom={3}
                    crossOrigin={true}
                    opacity={0}
                    zIndex={-1}
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
                            <img src={marker.image} alt="分享图片" className="w-full max-h-64 object-contain rounded-md mb-2 mx-auto" />
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
      </div>
      
      {/* 添加标记模态框 - 设置更高z-index确保在地图上方 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] backdrop-blur-sm animate-fadeIn" style={{ zIndex: 10000, position: 'fixed' }}>
          <div className="bg-white rounded-xl max-w-md w-full mx-4 shadow-xl transform transition-all duration-300 scale-100 animate-slideIn">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-dark">标记我的位置</h3>
                <button 
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <i className="fa fa-times text-xl"></i>
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">位置</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="城市，例如：北京"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={getUserLocation}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gray-100 hover:bg-gray-200 p-2 rounded-md transition-colors"
                      title="获取当前位置"
                    >
                      <i className="fa fa-map-marker text-primary"></i>
                    </button>
                  </div>
                  {formData.latitude && formData.longitude && (
                    <p className="text-xs text-gray-500 mt-1">
                      已获取精确位置: {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}
                    </p>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">昵称</label>
                  <input 
                    type="text" 
                    value={formData.nickname}
                    onChange={(e) => setFormData(prev => ({ ...prev, nickname: e.target.value }))}
                    placeholder="你的昵称"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">留言</label>
                  <textarea 
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    rows="4"
                    placeholder="分享你的星光故事..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    required
                  ></textarea>
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">上传照片（可选）</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-primary/50"
                >
                  提交标记
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App