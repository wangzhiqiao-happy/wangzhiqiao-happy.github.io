const CACHE='shici-app-v9';
const CORE=["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./audio-map.json","./audio/293028aa6ff9.m4a","./audio/98b9f3569789.m4a","./audio/3ce2e832336a.m4a","./audio/a473593df4b4.m4a","./audio/092d152e4446.m4a","./audio/c8158837c0d3.m4a","./audio/9c92ad25076f.m4a","./audio/36e473c8b75b.m4a","./audio/08c406094e33.m4a","./audio/3894e2077240.m4a","./audio/f26b63d628c9.m4a","./audio/540047a3d063.m4a","./audio/451e94b00ee0.m4a","./audio/5d9197ce0f68.m4a","./audio/69e9bba5cb84.m4a","./audio/37179c478b85.m4a","./audio/23b33a9e8268.m4a","./audio/619cda04595c.m4a","./audio/be70075e8ff2.m4a","./audio/287c8b8d25e7.m4a","./audio/7ab62d51d665.m4a","./audio/d70fb94f593b.m4a","./audio/2503013eeaa7.m4a","./audio/6e2366457272.m4a","./audio/57a5e7e3c23d.m4a","./audio/242f5f84eb55.m4a","./audio/ff196d878e67.m4a","./audio/a62879e46f90.m4a","./audio/13edbc1edb31.m4a","./audio/1b6d0571c586.m4a","./audio/0134b91dc083.m4a","./audio/be50ee372386.m4a","./audio/c4bb5c77ab40.m4a","./audio/8319380a0fe0.m4a","./audio/4012dc370a4d.m4a","./audio/198651e3dcbb.m4a"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));return response}).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response})));
});
