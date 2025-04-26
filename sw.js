// 缓存名称和版本
const CACHE_NAME = 'meditation-app-v1.1';
const STATIC_CACHE_NAME = 'meditation-static-v1.1';
const DYNAMIC_CACHE_NAME = 'meditation-dynamic-v1.1';

// 需要缓存的静态资源
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.json',
  './particles.js',
  './favicon/favicon.ico',
  './favicon/favicon.svg',
  './favicon/favicon-96x96.png',
  './favicon/apple-touch-icon.png',
  './favicon/site.webmanifest'
];

// 需要缓存但可能会更新的资源
const DYNAMIC_ASSETS = [
  './sounds/meditation-music.mp3'
];

// 最大缓存大小（字节）
const MAX_DYNAMIC_CACHE_SIZE = 30 * 1024 * 1024; // 30MB

// 安装Service Worker并缓存静态资源
self.addEventListener('install', event => {
  console.log('[Service Worker] 安装中...');
  
  event.waitUntil(
    // 缓存静态资源
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] 预缓存静态资源');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // 缓存动态资源
        return caches.open(DYNAMIC_CACHE_NAME)
          .then(cache => {
            console.log('[Service Worker] 预缓存动态资源');
            return cache.addAll(DYNAMIC_ASSETS);
          });
      })
      .then(() => {
        // 立即激活，不等待旧的Service Worker终止
        return self.skipWaiting();
      })
  );
});

// 激活Service Worker时，清理旧的缓存
self.addEventListener('activate', event => {
  console.log('[Service Worker] 激活中...');
  
  const currentCaches = [STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME];
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => !currentCaches.includes(cacheName))
            .map(cacheName => {
              console.log('[Service Worker] 删除旧缓存:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        // 接管所有客户端，包括未受控制的
        return self.clients.claim();
      })
  );
});

// 限制动态缓存大小
async function trimCache(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length <= 10) return; // 不要删除太多文件
  
  let cacheSize = 0;
  const keysWithSize = [];
  
  // 计算缓存大小
  for (const request of keys) {
    const response = await cache.match(request);
    const blob = await response.blob();
    cacheSize += blob.size;
    keysWithSize.push({ request, size: blob.size, timestamp: response.headers.get('sw-fetched-on') || 0 });
  }
  
  // 如果缓存超过限制大小，则删除旧的和大的文件
  if (cacheSize > maxSize) {
    console.log(`[Service Worker] 缓存大小(${cacheSize}字节)超过限制(${maxSize}字节)`);
    
    // 按时间戳排序，最旧的在前面
    keysWithSize.sort((a, b) => a.timestamp - b.timestamp);
    
    // 删除旧文件直到缓存小于最大大小的80%
    let deletedSize = 0;
    while (deletedSize < cacheSize - (maxSize * 0.8) && keysWithSize.length > 0) {
      const { request, size } = keysWithSize.shift();
      await cache.delete(request);
      deletedSize += size;
      console.log(`[Service Worker] 从缓存中删除: ${request.url} (${size}字节)`);
    }
  }
}

// 缓存优先，回退到网络的策略
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    // 添加时间戳头部，用于缓存管理
    const modifiedResponse = new Response(networkResponse.clone().body, {
      headers: new Headers(networkResponse.headers),
      status: networkResponse.status,
      statusText: networkResponse.statusText
    });
    modifiedResponse.headers.set('sw-fetched-on', Date.now().toString());
    
    // 只缓存成功的响应
    if (networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      await cache.put(request, modifiedResponse);
      
      // 限制缓存大小
      await trimCache(DYNAMIC_CACHE_NAME, MAX_DYNAMIC_CACHE_SIZE);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] 获取资源失败:', error);
    // 如果是HTML请求，则返回离线页面
    if (request.headers.get('Accept').includes('text/html')) {
      return caches.match('./index.html');
    }
    
    // 对于其他资源，无法处理
    throw error;
  }
}

// 网络优先，回退到缓存的策略
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    // 添加时间戳头部，用于缓存管理
    const modifiedResponse = new Response(networkResponse.clone().body, {
      headers: new Headers(networkResponse.headers),
      status: networkResponse.status,
      statusText: networkResponse.statusText
    });
    modifiedResponse.headers.set('sw-fetched-on', Date.now().toString());
    
    // 只缓存成功的响应
    if (networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      await cache.put(request, modifiedResponse);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] 回退到缓存:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // 如果是HTML请求，则返回离线页面
    if (request.headers.get('Accept').includes('text/html')) {
      return caches.match('./index.html');
    }
    
    // 对于其他资源，无法处理
    throw error;
  }
}

// 拦截获取请求
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // 跳过不支持缓存的请求，如Chrome扩展
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // 静态资源使用缓存优先策略
  if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset)) || 
      url.pathname.includes('/icons/')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }
  
  // 音频和视频文件使用缓存优先策略
  if (url.pathname.includes('/sounds/') || url.pathname.includes('/video/')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }
  
  // API请求使用网络优先策略
  if (url.pathname.includes('/api/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  
  // 所有其他请求使用网络优先策略
  event.respondWith(networkFirst(event.request));
});

// 后台同步功能 - 适用于存储冥想数据
self.addEventListener('sync', event => {
  console.log('[Service Worker] 后台同步:', event.tag);
  
  if (event.tag === 'sync-meditation-data') {
    event.waitUntil(
      // 在这里实现数据同步逻辑
      console.log('[Service Worker] 正在执行冥想数据同步')
    );
  }
});

// 推送通知功能 - 用于冥想提醒
self.addEventListener('push', event => {
  console.log('[Service Worker] 推送消息收到:', event);
  
  const data = event.data.json();
  const options = {
    body: data.body || '是时候冥想了，保持专注和平静。',
    icon: './icons/icon-192x192.png',
    badge: './icons/favicon-32x32.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || './'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('每日冥想提醒', options)
  );
});

// 点击通知打开应用
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(windowClients => {
        // 检查是否有已打开的窗口
        for (const client of windowClients) {
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        // 如果没有打开的窗口，则打开一个新窗口
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
  );
}); 