// Training 離線快取：程式用「網路優先」（有網路就拿最新版），圖片用「快取優先」（看過一次就離線可用）
const VER = '43935a6440';
const CORE = ['./', 'index.html', 'manifest.json', 'icon-180.png', 'icon-512.png'];
const IMGS = ["img/barbell-squat-1.png", "img/barbell-squat-2.png", "img/bench-dips-1.png", "img/bench-dips-2.png", "img/bench-press-1.png", "img/bench-press-2.png", "img/bench-press-dumbbell-1.png", "img/bench-press-dumbbell-2.png", "img/bicep-curl-with-machine-1.png", "img/bicep-curl-with-machine-2.png", "img/bicep-hammer-curl-with-dumbbell-1.png", "img/bicep-hammer-curl-with-dumbbell-2.png", "img/biceps-curl-with-dumbbell-1.png", "img/biceps-curl-with-dumbbell-2.png", "img/butterfly-machine-1.png", "img/butterfly-machine-2.png", "img/cable-crossover-1.png", "img/cable-crossover-2.png", "img/calves-press-on-leg-machine-1.png", "img/calves-press-on-leg-machine-2.png", "img/chest-dips-1.png", "img/chest-dips-2.png", "img/crunches-1.png", "img/crunches-2.png", "img/dumbbell-incline-bench-press-1.png", "img/dumbbell-incline-bench-press-2.png", "img/dumbbell-shoulder-press-1.png", "img/dumbbell-shoulder-press-2.png", "img/fe-Ab_Crunch_Machine-1.jpg", "img/fe-Ab_Crunch_Machine-2.jpg", "img/fe-Barbell_Hip_Thrust-1.jpg", "img/fe-Barbell_Hip_Thrust-2.jpg", "img/fe-Bent_Over_Barbell_Row-1.jpg", "img/fe-Bent_Over_Barbell_Row-2.jpg", "img/fe-Cable_Rear_Delt_Fly-1.jpg", "img/fe-Cable_Rear_Delt_Fly-2.jpg", "img/fe-Cable_Rope_Overhead_Triceps_Extension-1.jpg", "img/fe-Cable_Rope_Overhead_Triceps_Extension-2.jpg", "img/fe-Cable_Seated_Lateral_Raise-1.jpg", "img/fe-Cable_Seated_Lateral_Raise-2.jpg", "img/fe-Dip_Machine-1.jpg", "img/fe-Dip_Machine-2.jpg", "img/fe-Face_Pull-1.jpg", "img/fe-Face_Pull-2.jpg", "img/fe-Hack_Squat-1.jpg", "img/fe-Hack_Squat-2.jpg", "img/fe-Hanging_Leg_Raise-1.jpg", "img/fe-Hanging_Leg_Raise-2.jpg", "img/fe-Leverage_Iso_Row-1.jpg", "img/fe-Leverage_Iso_Row-2.jpg", "img/fe-One-Arm_Dumbbell_Row-1.jpg", "img/fe-One-Arm_Dumbbell_Row-2.jpg", "img/fe-Plank-1.jpg", "img/fe-Plank-2.jpg", "img/fe-Reverse_Machine_Flyes-1.jpg", "img/fe-Reverse_Machine_Flyes-2.jpg", "img/fe-Smith_Machine_Bench_Press-1.jpg", "img/fe-Smith_Machine_Bench_Press-2.jpg", "img/fe-Smith_Machine_Incline_Bench_Press-1.jpg", "img/fe-Smith_Machine_Incline_Bench_Press-2.jpg", "img/fe-Split_Squat_with_Dumbbells-1.jpg", "img/fe-Split_Squat_with_Dumbbells-2.jpg", "img/fe-T-Bar_Row_with_Handle-1.jpg", "img/fe-T-Bar_Row_with_Handle-2.jpg", "img/front-dumbbell-raise-1.png", "img/front-dumbbell-raise-2.png", "img/hammer-curls-with-rope-and-cable-1.png", "img/hammer-curls-with-rope-and-cable-2.png", "img/hyperextensions-1.png", "img/hyperextensions-2.png", "img/incline-chest-press-1.png", "img/incline-chest-press-2.png", "img/lateral-dumbbell-raises-1.png", "img/lateral-dumbbell-raises-2.png", "img/leg-extensions-1.png", "img/leg-extensions-2.png", "img/leg-press-1.png", "img/leg-press-2.png", "img/lying-leg-curl-machine-1.png", "img/lying-leg-curl-machine-2.png", "img/machine-bench-press-1.png", "img/machine-bench-press-2.png", "img/preacher-curl-with-machine-1.png", "img/preacher-curl-with-machine-2.png", "img/pull-ups-1.png", "img/pull-ups-2.png", "img/push-ups-1.png", "img/push-ups-2.png", "img/romanian-dead-lift-1.png", "img/romanian-dead-lift-2.png", "img/seated-ab-crunch-with-cable-1.png", "img/seated-ab-crunch-with-cable-2.png", "img/seated-cable-rows-1.png", "img/seated-cable-rows-2.png", "img/seated-leg-curl-1.png", "img/seated-leg-curl-2.png", "img/seated-shoulder-press-machine-1.png", "img/seated-shoulder-press-machine-2.png", "img/shoulder-shrugs-1.png", "img/shoulder-shrugs-2.png", "img/smith-machine-bench-press-1.png", "img/smith-machine-bench-press-2.png", "img/smith-machine-squats-1.png", "img/smith-machine-squats-2.png", "img/standing-biceps-curl-with-cable-1.png", "img/standing-biceps-curl-with-cable-2.png", "img/standing-calf-raises-using-machine-1.png", "img/standing-calf-raises-using-machine-2.png", "img/straight-arm-push-down-1.png", "img/straight-arm-push-down-2.png", "img/thigh-abductor-1.png", "img/thigh-abductor-2.png", "img/thigh-adductor-1.png", "img/thigh-adductor-2.png", "img/triceps-extensions-using-machine-1.png", "img/triceps-extensions-using-machine-2.png", "img/triceps-pushdown-with-cable-1.png", "img/triceps-pushdown-with-cable-2.png", "img/triceps-pushdown-with-rope-and-cable-1.png", "img/triceps-pushdown-with-rope-and-cable-2.png", "img/underhand-pull-down-1.png", "img/underhand-pull-down-2.png", "img/v-bar-pull-down-1.png", "img/v-bar-pull-down-2.png", "img/walking-lunges-1.png", "img/walking-lunges-2.png", "img/wide-grip-lat-pull-down-1.png", "img/wide-grip-lat-pull-down-2.png"];
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open('core-' + VER);
    await c.addAll(CORE);
    const ic = await caches.open('img-v1');
    for (const u of IMGS) { try { if (!(await ic.match(u))) await ic.add(u); } catch (err) { } }
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('core-') && k !== 'core-' + VER) await caches.delete(k);
    const ic = await caches.open('img-v1');
    for (const req of await ic.keys()) { const p = new URL(req.url).pathname; if (!IMGS.some(u => p.endsWith('/' + u))) await ic.delete(req); }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin && (url.pathname.includes('/img/') || url.pathname.includes('/lib/'))) {
    e.respondWith((async () => {
      const c = await caches.open('img-v1');
      const hit = await c.match(req); if (hit) return hit;
      const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res;
    })());
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const c = await caches.open('core-' + VER);
      try { const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; }
      catch (err) { return (await c.match(req)) || (await c.match('index.html')) || Response.error(); }
    })());
    return;
  }
  if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith((async () => {
      const c = await caches.open('font-v1');
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })());
  }
});
