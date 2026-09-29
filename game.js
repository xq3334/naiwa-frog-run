'use strict';
(() => {
  const element = name => document.getElementById(name);
  if (!window.THREE) { element('loading').textContent = '3D引擎加载失败，请检查网络后刷新页面。'; return; }
  const maps = [
    { name: '金沙秘境', caption: '沙丘、棕榈与暖色小城', sky: 0xf5d9ac, ground: 0xd5ac76, road: 0xf3d9ad, building: 0xe2bc89, leaf: 0x64955e },
    { name: '樱色车站', caption: '粉色樱花与春日列车', sky: 0xdcebf1, ground: 0xa2bb97, road: 0xd7c9bd, building: 0xb3b9c9, leaf: 0xf0a9bb },
    { name: '薄荷海湾', caption: '海风、白墙与蓝色屋顶', sky: 0xbce5ee, ground: 0x7dbfb3, road: 0xe9e1c9, building: 0xf4f0e1, leaf: 0x62a887 }
  ];
  const outfits = [
    { name: '经典奶蛙', color: 0xe2ad48, scarf: 0xf3bb75, cost: 0 },
    { name: '草莓奶团', color: 0xeab0b6, scarf: 0xa65469, cost: 80 },
    { name: '海盐汽水', color: 0x8dc4d0, scarf: 0x487998, cost: 120 },
    { name: '柠檬奶蛙', color: 0xf2d04a, scarf: 0xc48142, cost: 160 },
    { name: '葡萄软糖', color: 0xb6a0d4, scarf: 0x71629b, cost: 200 },
    { name: '奶油小白', color: 0xe7e3ce, scarf: 0x689778, cost: 240 }
  ];
  const defaultSave = { wallet: 0, best: 0, coins: 0, jumps: 0, slides: 0, roof: 0, runs: 0, outfit: 0, map: 0, owned: [0], claimed: [], records: [], quality: 1.5 };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('frogVoyageV1') || '{}') || {}; } catch { saved = {}; }
  const progress = { ...defaultSave, ...saved };
  for (const key of ['wallet', 'best', 'coins', 'jumps', 'slides', 'roof', 'runs']) if (!Number.isFinite(progress[key]) || progress[key] < 0) progress[key] = 0;
  for (const key of ['owned', 'claimed', 'records']) if (!Array.isArray(progress[key])) progress[key] = defaultSave[key];
  if (!outfits[progress.outfit]) progress.outfit = 0;
  if (!maps[progress.map]) progress.map = 0;
  const save = () => { try { localStorage.setItem('frogVoyageV1', JSON.stringify(progress)); } catch { notify('浏览器无法保存进度'); } };
  let toastTimer;
  function notify(message) { element('toast').textContent = message; element('toast').style.opacity = 1; clearTimeout(toastTimer); toastTimer = setTimeout(() => element('toast').style.opacity = 0, 2200); }
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ canvas: element('canvas'), antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, progress.quality));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const camera = new THREE.PerspectiveCamera(48, 1, .1, 180);
  scene.add(new THREE.HemisphereLight(0xcce5ff, 0x544538, 1.4));
  const sunlight = new THREE.DirectionalLight(0xffe4ba, 3.2);
  sunlight.position.set(-10, 18, 10);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunlight.shadow.camera, { left: -18, right: 18, top: 20, bottom: -40, near: .5, far: 90 });
  sunlight.shadow.bias = -.0004;
  sunlight.shadow.normalBias = .035;
  scene.add(sunlight);
  const rimLight = new THREE.DirectionalLight(0xc7e4ff, 1.4);
  rimLight.position.set(8, 7, -10); scene.add(rimLight);
  function createSkyEnvironment() {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
    const context = canvas.getContext('2d');
    const skyGradient = context.createLinearGradient(0, 0, 0, 256);
    skyGradient.addColorStop(0, '#8fc4f2'); skyGradient.addColorStop(.47, '#fff0d2');
    skyGradient.addColorStop(.53, '#d9c29a'); skyGradient.addColorStop(1, '#6f6150');
    context.fillStyle = skyGradient; context.fillRect(0, 0, 512, 256);
    const sunGlow = context.createRadialGradient(150, 70, 0, 150, 70, 60);
    sunGlow.addColorStop(0, 'rgba(255,255,240,1)'); sunGlow.addColorStop(1, 'rgba(255,240,200,0)');
    context.fillStyle = sunGlow; context.fillRect(0, 0, 512, 256);
    const skyTexture = new THREE.CanvasTexture(canvas);
    skyTexture.mapping = THREE.EquirectangularReflectionMapping; skyTexture.colorSpace = THREE.SRGBColorSpace;
    const generator = new THREE.PMREMGenerator(renderer);
    const environment = generator.fromEquirectangular(skyTexture).texture;
    skyTexture.dispose(); generator.dispose();
    return environment;
  }
  scene.environment = createSkyEnvironment();
  function createSurfaceTexture(kind) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = kind === 'stone' ? '#bdb5a6' : '#aaa195'; context.fillRect(0, 0, 256, 256);
    let seed = 127;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let grain = 0; grain < 6000; grain++) {
      const value = 90 + Math.floor(random() * 110);
      context.fillStyle = `rgba(${value},${value},${value},.22)`;
      context.fillRect(random() * 256, random() * 256, 1 + random() * 2, 1 + random() * 2);
    }
    if (kind === 'stone') {
      context.strokeStyle = '#746f67'; context.lineWidth = 2;
      for (let row = 0; row < 4; row++) {
        context.beginPath(); context.moveTo(0, row * 64); context.lineTo(256, row * 64); context.stroke();
        for (let column = 0; column < 4; column++) {
          const position = column * 64 + row % 2 * 32;
          context.beginPath(); context.moveTo(position, row * 64); context.lineTo(position, (row + 1) * 64); context.stroke();
        }
      }
    }
    const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(kind === 'stone' ? 2 : 1, kind === 'stone' ? 3 : 1);
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }
  const pavingTexture = createSurfaceTexture('stone');
  const plasterTexture = createSurfaceTexture('plaster');
  const paintedPaving = new THREE.TextureLoader().load('../生成图片/frog-paving-texture.webp');
  paintedPaving.colorSpace = THREE.SRGBColorSpace;
  paintedPaving.wrapS = paintedPaving.wrapT = THREE.RepeatWrapping;
  paintedPaving.repeat.set(1, 1);
  paintedPaving.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const materialCache = new Map();
  const material = color => {
    if (!materialCache.has(color)) materialCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: .62 }));
    return materialCache.get(color);
  };
  const sphereGeometry = new THREE.SphereGeometry(1, 24, 16);
  const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 12);
  const coneGeometry = new THREE.ConeGeometry(1, 1, 10);
  function tube(parent, points, color, radius = .035) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    return shape(parent, new THREE.TubeGeometry(curve, 12, radius, 5, false), color, [0, 0, 0], [1, 1, 1]);
  }
  function shape(parent, geometry, color, position, scale) {
    const mesh = new THREE.Mesh(geometry, material(color));
    mesh.position.set(...position); mesh.scale.set(...scale);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  const surfaceMaterials = new Map();
  function surface(mesh, color, texture, strength = .08) {
    const key = `${color}-${texture.uuid}-${strength}`;
    if (!surfaceMaterials.has(key)) surfaceMaterials.set(key, new THREE.MeshStandardMaterial({ color, map: texture, bumpMap: texture, bumpScale: strength, roughness: .92 }));
    mesh.material = surfaceMaterials.get(key);
    return mesh;
  }
  function sphere(parent, color, position, scale) { return shape(parent, sphereGeometry, color, position, scale); }
  function box(parent, color, position, scale) { return shape(parent, cubeGeometry, color, position, scale); }
  function makeFrog() {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const skinColor = outfits[progress.outfit].color;
    // Profile measured from 参考图/奶蛙参考-2.png (see 参考图/奶蛙特征.md), total height 3.2:
    // legs fill the bottom ~30%, the pear-shaped belly is widest just above mid height,
    // shoulders slope into a narrow head about 0.43x the torso width with a flattened crown.
    const silhouetteCurve = new THREE.CatmullRomCurve3([
      [0, .9], [.3, .91], [.5, .96], [.62, 1.04], [.69, 1.16], [.74, 1.34], [.76, 1.56], [.76, 1.78], [.72, 1.96],
      [.66, 2.1], [.59, 2.22], [.52, 2.33], [.45, 2.43], [.39, 2.54], [.355, 2.66], [.335, 2.79], [.325, 2.91],
      [.315, 3.01], [.28, 3.1], [.2, 3.16], [.1, 3.19], [0, 3.2]
    ].map(([radius, height]) => new THREE.Vector3(radius, height, 0)));
    // Evenly spaced samples keep texture rows proportional to distance along the surface.
    const silhouettePoints = silhouetteCurve.getSpacedPoints(72).map(point => new THREE.Vector2(Math.max(point.x, 0), point.y));
    const bodyDepthScale = .88;
    function sampleSilhouette(height) {
      for (let index = 1; index < silhouettePoints.length; index++) {
        const lower = silhouettePoints[index - 1]; const upper = silhouettePoints[index];
        if (height >= lower.y && height <= upper.y) {
          const blend = (height - lower.y) / (upper.y - lower.y || 1);
          return { radius: THREE.MathUtils.lerp(lower.x, upper.x, blend), textureRow: (index - 1 + blend) / (silhouettePoints.length - 1) };
        }
      }
      return { radius: 0, textureRow: 1 };
    }
    const surfaceDepth = (sideOffset, height) => Math.sqrt(Math.max(sampleSilhouette(height).radius ** 2 - sideOffset ** 2, 0)) * bodyDepthScale;
    const skinCanvas = document.createElement('canvas'); skinCanvas.width = 1024; skinCanvas.height = 512;
    const skinContext = skinCanvas.getContext('2d');
    skinContext.fillStyle = `#${skinColor.toString(16).padStart(6, '0')}`; skinContext.fillRect(0, 0, 1024, 512);
    const bellyBottomRow = sampleSilhouette(1.28).textureRow; const bellyTopRow = sampleSilhouette(2.27).textureRow;
    const bellyHalfAngle = Math.asin(.52 / sampleSilhouette(1.78).radius);
    skinContext.filter = 'blur(5px)'; skinContext.fillStyle = '#e8cfa5'; skinContext.beginPath();
    // Texture u = 0.5 faces forward because the lathe below starts at the back (phiStart = PI).
    skinContext.ellipse(512, (1 - (bellyBottomRow + bellyTopRow) / 2) * 512, bellyHalfAngle / (Math.PI * 2) * 1024, (bellyTopRow - bellyBottomRow) / 2 * 512, 0, 0, Math.PI * 2);
    skinContext.fill();
    const skinTexture = new THREE.CanvasTexture(skinCanvas);
    skinTexture.colorSpace = THREE.SRGBColorSpace; skinTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const skinMaterial = new THREE.MeshPhysicalMaterial({
      map: skinTexture, roughness: .46, clearcoat: .35, clearcoatRoughness: .4,
      sheen: .4, sheenColor: new THREE.Color(0xfff0c8), sheenRoughness: .6
    });
    const limbSkinMaterial = new THREE.MeshPhysicalMaterial({ color: skinColor, roughness: .46, clearcoat: .35, clearcoatRoughness: .4 });
    const darkPawMaterial = new THREE.MeshPhysicalMaterial({ color: 0x3a2c1e, roughness: .5, clearcoat: .3 });
    const eyeWhiteMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .12, clearcoat: 1, clearcoatRoughness: .05 });
    const irisMaterial = new THREE.MeshPhysicalMaterial({ color: 0x74b556, roughness: .18, clearcoat: 1, clearcoatRoughness: .05 });
    const pupilMaterial = new THREE.MeshPhysicalMaterial({ color: 0x0d160c, roughness: .1, clearcoat: 1 });
    const smoothSphere = new THREE.SphereGeometry(1, 40, 28);
    const part = (parent, partMaterial, position, scale) => {
      const mesh = new THREE.Mesh(smoothSphere, partMaterial);
      mesh.position.set(...position); mesh.scale.set(...scale);
      mesh.castShadow = true; mesh.receiveShadow = true;
      parent.add(mesh); return mesh;
    };
    const torso = new THREE.Mesh(new THREE.LatheGeometry(silhouettePoints, 64, Math.PI), skinMaterial);
    torso.scale.set(1, 1, bodyDepthScale); torso.castShadow = true; torso.receiveShadow = true; body.add(torso);
    // Reference eyes: a green ring around a dark pupil with no white sclera, set near the crown.
    // They are thin discs pressed into the head surface so they stay flush instead of bulging out.
    const eyeHeight = 3.02; const eyeOffset = .16;
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(side * eyeOffset, eyeHeight, surfaceDepth(eyeOffset, eyeHeight) + .004);
      eye.rotation.set(-.12, side * .3, 0); body.add(eye);
      part(eye, irisMaterial, [0, 0, 0], [.095, .1, .028]);
      part(eye, pupilMaterial, [0, 0, .012], [.052, .058, .018]);
      part(eye, eyeWhiteMaterial, [-.025, .035, .03], [.016, .018, .006]);
    }
    // A short, almost straight brown mouth line sits just below the eyes.
    const mouthHeight = 2.85; const mouthHalfWidth = .085;
    const mouthPoints = [-1, -.5, 0, .5, 1].map(step => {
      const offset = step * mouthHalfWidth;
      const pointHeight = mouthHeight - .012 * (1 - step * step);
      return [offset, pointHeight, surfaceDepth(offset, pointHeight) + .008];
    });
    tube(body, mouthPoints, 0x7a5a2a, .011);
    const limbs = [];
    for (const side of [-1, 1]) {
      // Short, thick yellow legs end in dark feet.
      const leg = new THREE.Group(); leg.position.set(side * .33, .95, .02); body.add(leg);
      part(leg, limbSkinMaterial, [0, -.42, 0], [.25, .5, .26]);
      part(leg, darkPawMaterial, [0, -.85, .1], [.27, .1, .34]);
      limbs.push(leg);
      // Arms hang close to the body; the dark hands rest against the lower belly at about a third of the height.
      const arm = new THREE.Group(); arm.position.set(side * .68, 2, .06); body.add(arm);
      part(arm, limbSkinMaterial, [side * .1, -.44, .06], [.145, .46, .15]);
      part(arm, darkPawMaterial, [side * .06, -.9, .16], [.155, .14, .16]);
      limbs.push(arm);
    }
    const shadow = shape(root, new THREE.CircleGeometry(.85, 32), 0x899785, [0, .018, 0], [1, 1, 1]); shadow.rotation.x = -Math.PI / 2;
    scene.add(root);
    return { root, body, limbs, shadow };
  }
  function makeChaser(isDog) {
    const root = new THREE.Group();
    root.userData.legs = [];
    if (isDog) { scene.add(root); return root; }
    const hideMaterial = new THREE.MeshPhysicalMaterial({ color: 0x7a4a2c, roughness: .55, sheen: .6, sheenColor: new THREE.Color(0xd9a57a) });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x3a2518, roughness: .6 });
    const muzzleMaterial = new THREE.MeshStandardMaterial({ color: 0xe8b9a0, roughness: .5 });
    const hornMaterial = new THREE.MeshPhysicalMaterial({ color: 0xf6ead0, roughness: .3, clearcoat: .6 });
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .2, emissive: 0x551100, emissiveIntensity: .4 });
    const smoothSphere = new THREE.SphereGeometry(1, 32, 22);
    const part = (parent, partMaterial, position, scale) => {
      const mesh = new THREE.Mesh(smoothSphere, partMaterial);
      mesh.position.set(...position); mesh.scale.set(...scale);
      mesh.castShadow = true; parent.add(mesh); return mesh;
    };
    const body = new THREE.Group(); root.add(body); root.userData.body = body;
    part(body, hideMaterial, [0, 1.35, 0], [.95, .82, 1.45]);
    part(body, hideMaterial, [0, 1.6, .75], [1.02, .9, .8]);
    part(body, darkMaterial, [0, 2.15, .55], [.55, .25, .6]);
    const head = new THREE.Group(); head.position.set(0, 1.75, 1.75); head.rotation.x = .35; body.add(head);
    part(head, hideMaterial, [0, 0, 0], [.6, .55, .6]);
    part(head, muzzleMaterial, [0, -.25, .45], [.42, .3, .3]);
    for (const side of [-1, 1]) {
      part(head, darkMaterial, [side * .14, -.24, .72], [.06, .05, .03]);
      part(head, eyeMaterial, [side * .32, .15, .42], [.09, .08, .06]);
      part(head, darkMaterial, [side * .34, .15, .47], [.045, .05, .03]);
      part(head, hideMaterial, [side * .62, .12, -.05], [.22, .1, .14]);
      const hornCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * .42, .32, -.05), new THREE.Vector3(side * .78, .42, -.08),
        new THREE.Vector3(side * .95, .7, .05), new THREE.Vector3(side * .88, .98, .22)
      ]);
      const horn = new THREE.Mesh(new THREE.TubeGeometry(hornCurve, 16, .085, 10, false), hornMaterial);
      horn.castShadow = true; head.add(horn);
    }
    const ringCurve = new THREE.TorusGeometry(.12, .025, 8, 20);
    const noseRing = new THREE.Mesh(ringCurve, new THREE.MeshStandardMaterial({ color: 0xd8b04a, metalness: .9, roughness: .25 }));
    noseRing.position.set(0, -.38, .72); head.add(noseRing);
    for (const [sideX, depth] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const leg = new THREE.Group(); leg.position.set(sideX * .55, 1.05, depth * .85); body.add(leg);
      part(leg, hideMaterial, [0, -.3, 0], [.24, .45, .26]);
      part(leg, hideMaterial, [0, -.75, 0], [.17, .35, .18]);
      part(leg, darkMaterial, [0, -1.05, .02], [.19, .1, .22]);
      root.userData.legs.push(leg);
    }
    const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.75, -1.35), new THREE.Vector3(0, 1.4, -1.6), new THREE.Vector3(.1, 1, -1.62)
    ]), 12, .04, 6, false), hideMaterial);
    body.add(tail);
    part(body, darkMaterial, [.1, .95, -1.62], [.09, .14, .09]);
    root.scale.setScalar(.85);
    root.rotation.y = Math.PI; scene.add(root); return root;
  }
  let frog = makeFrog(); const bull = makeChaser(false); const dog = makeChaser(true);
  const scenery = new THREE.Group(); scene.add(scenery);
  const chunks = []; const obstacles = []; const coinGeometry = new THREE.CylinderGeometry(.23, .23, .065, 16);
  function clearGroup(group) { while (group.children.length) group.remove(group.children[0]); }
  function makeStreetDetails(chunk, index, side, theme) {
    const streetX = side * 5.65;
    const depth = -2 - (index * 5 % 8);
    const tree = new THREE.Group(); tree.position.set(streetX, 0, depth); chunk.add(tree);
    shape(tree, cylinderGeometry, 0x947256, [0, 1.36, 0], [.16, 2.72, .16]);
    if (progress.map === 0) {
      for (let leafIndex = 0; leafIndex < 6; leafIndex++) {
        const angle = leafIndex * Math.PI / 3;
        const leaf = sphere(tree, theme.leaf, [Math.cos(angle) * .82, 2.93, Math.sin(angle) * .82], [.95, .15, .36]);
        leaf.rotation.y = -angle;
      }
      box(tree, 0xd2b277, [0, .15, 0], [.9, .3, .9]);
    } else {
      for (const offset of [-.45, .45]) sphere(tree, theme.leaf, [offset, 3.05, 0], [.87, .86, .86]);
      sphere(tree, theme.leaf, [0, 3.55, 0], [.78, .72, .78]);
      box(tree, 0xb2a28c, [0, .18, 0], [.88, .36, .88]);
    }
    const lantern = new THREE.Group(); lantern.position.set(side * 4.7, 0, -9); chunk.add(lantern);
    shape(lantern, cylinderGeometry, 0x426d68, [0, 1.8, 0], [.055, 3.6, .055]);
    sphere(lantern, 0xffe2a1, [0, 3.58, 0], [.23, .28, .23]);
    shape(lantern, coneGeometry, 0x536e6e, [0, 3.91, 0], [.36, .26, .36]);
    if (index % 3 === 0) {
      const stall = new THREE.Group(); stall.position.set(side * 7.35, 0, -2.9); chunk.add(stall);
      box(stall, 0x8c6650, [0, .98, 0], [2.4, .15, 1.45]);
      for (const postX of [-1, 1]) shape(stall, cylinderGeometry, 0x88644d, [postX, 1.73, 0], [.065, 1.65, .065]);
      box(stall, index % 2 ? 0xe89990 : 0xf3c576, [0, 2.57, 0], [2.55, .14, 1.65]);
      for (let fruit = -1; fruit <= 1; fruit++) sphere(stall, 0xd8835e, [fruit * .55, 1.2, -.24], [.23, .19, .23]);
    }
    if (index % 2 === 0) {
      for (let flower = 0; flower < 3; flower++) {
        const flowerX = side * (4.7 + flower * .33);
        sphere(chunk, progress.map === 1 ? 0xf7d4df : 0xf6d58b, [flowerX, .13, -5.5 - flower * .42], [.13, .13, .13]);
      }
    }
  }
  function rebuildWorld() {
    clearGroup(scenery); chunks.length = 0; const theme = maps[progress.map];
    scene.background = new THREE.Color(theme.sky); scene.fog = new THREE.Fog(theme.sky, 38, 115);
    for (let index = 0; index < 12; index++) {
      const chunk = new THREE.Group(); chunk.position.z = 12 - index * 12;
      box(chunk, theme.ground, [0, -.27, -6], [90, .4, 12]);
      surface(box(chunk, theme.road, [0, -.045, -6], [8.1, .1, 12]), 0xffffff, paintedPaving, .015);
      for (const side of [-1, 1]) {
        box(chunk, 0xe7d7b6, [side * 4.15, .12, -6], [.22, .3, 12]);
        for (const laneMark of [-1.35, 1.35]) {
          box(chunk, 0xfff6da, [laneMark, .017, -3], [.075, .018, 2.5]);
          box(chunk, 0xfff6da, [laneMark, .017, -9], [.075, .018, 2.5]);
        }
        const height = 3 + (index * 7 % 5);
        const buildingX = side * (8.5 + index % 3);
        surface(box(chunk, theme.building, [buildingX, height / 2, -7], [3.8, height, 4]), theme.building, plasterTexture, .035);
        for (const floorHeight of [1, 2.5, 4]) {
          if (floorHeight > height) continue;
          box(chunk, 0xece3d2, [buildingX, floorHeight, -4.97], [3.9, .12, .12]);
          for (const windowOffset of [-1.05, 1.05]) {
            box(chunk, 0x344e53, [buildingX + windowOffset, floorHeight + .6, -4.95], [.65, .9, .08]);
            box(chunk, 0xdfcfac, [buildingX + windowOffset, floorHeight + .6, -4.89], [.055, .9, .055]);
            box(chunk, 0xdfcfac, [buildingX + windowOffset, floorHeight + .6, -4.89], [.65, .055, .055]);
          }
        }
        const roof = shape(chunk, new THREE.CylinderGeometry(1, 1, 1, 3), progress.map === 2 ? 0x476f87 : 0x955b46, [buildingX, height + .6, -7], [2.55, 4.4, 1.4]);
        roof.rotation.x = Math.PI / 2;
        box(chunk, 0x87776a, [buildingX + 1, height + .9, -7], [.4, 1.4, .4]);
        for (let windowIndex = 0; windowIndex < 3; windowIndex++) {
          box(chunk, 0xf5e6c4, [buildingX - side * 1.95, 1.2 + windowIndex * 1.2, -6.6], [.045, .8, .75]);
          box(chunk, 0x6a9694, [buildingX - side * 1.99, 1.2 + windowIndex * 1.2, -6.6], [.035, .57, .5]);
        }
        makeStreetDetails(chunk, index, side, theme);
      }
      scenery.add(chunk); chunks.push(chunk);
    }
  }
  rebuildWorld();
  const state = { mode: 'home', difficulty: 'normal', distance: 0, coins: 0, elapsed: 0, lane: 0, height: 0, velocity: 0, slide: 0, threat: 0, grace: 0, shield: false, magnet: 0, spawn: 35, speed: 16, time: 0 };
  const difficulty = { easy: { speed: 12, max: 24, spacing: 27 }, normal: { speed: 16, max: 32, spacing: 23 }, hard: { speed: 21, max: 39, spacing: 19 } };
  let audioContext; let soundOn = false;
  function beep(frequency, duration = .1) { if (!soundOn) return; try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume(); const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain(); oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime); gain.gain.setValueAtTime(.045, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration); oscillator.start(); oscillator.stop(audioContext.currentTime + duration); } catch { soundOn = false; } }
  function syncHome() { element('wallet').textContent = `${progress.wallet} 金币`; element('outfitName').textContent = outfits[progress.outfit].name; element('mapName').textContent = maps[progress.map].name; }
  function clearObstacles() { for (const obstacle of obstacles) scene.remove(obstacle.mesh); obstacles.length = 0; }
  function startRun() {
    clearObstacles(); rebuildWorld(); groupCount = 0;
    Object.assign(state, { mode: 'running', distance: 0, coins: 0, elapsed: 0, lane: 0, height: 0, velocity: 0, slide: 0, threat: 0, grace: 0, shield: false, magnet: 0, spawn: 35, speed: difficulty[state.difficulty].speed });
    frog.root.position.set(0, 0, 3); frog.root.rotation.y = Math.PI; frog.body.scale.set(1, 1, 1); frog.body.rotation.x = 0;
    element('home').hidden = true; element('hud').hidden = false; element('panel').hidden = true; element('result').hidden = true; element('pause').textContent = 'Ⅱ'; beep(500); notify('沿金币路线前进 · 上滑跳跃，下滑滑铲');
  }
  function goHome() { state.mode = 'home'; clearObstacles(); element('home').hidden = false; element('hud').hidden = true; element('result').hidden = true; element('panel').hidden = true; syncHome(); save(); }
  function finishRun() {
    if (state.mode !== 'running') return;
    state.mode = 'ended'; progress.wallet += state.coins; progress.coins += state.coins; progress.runs++;
    progress.best = Math.max(progress.best, Math.floor(state.distance));
    progress.records.unshift({ distance: Math.floor(state.distance), coins: state.coins, map: maps[progress.map].name, difficulty: state.difficulty }); progress.records = progress.records.slice(0, 8); save(); syncHome();
    element('resultTitle').textContent = '被牛牛逮住啦'; element('resultText').textContent = `${Math.floor(state.distance)} 米 · ${state.coins} 枚金币\n用时 ${Math.floor(state.elapsed)} 秒\n历史最远 ${progress.best} 米`; element('result').hidden = false; beep(140, .35);
  }
  function action(name) {
    if (state.mode !== 'running') return;
    if (name === 'left') state.lane = Math.max(-1, state.lane - 1);
    if (name === 'right') state.lane = Math.min(1, state.lane + 1);
    if (name === 'jump' && state.velocity === 0 && !state.slide) { state.velocity = 10; progress.jumps++; beep(650); }
    if (name === 'slide' && state.velocity === 0 && !state.slide) { state.slide = .8; progress.slides++; beep(260); }
  }
  const obstacleMaterials = {
    wood: new THREE.MeshStandardMaterial({ color: 0xb07a43, roughness: .78 }),
    woodDark: new THREE.MeshStandardMaterial({ color: 0x6e4524, roughness: .82 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xa3adb2, metalness: .85, roughness: .3 }),
    stripeRed: new THREE.MeshStandardMaterial({ color: 0xe0452f, roughness: .42 }),
    stripeWhite: new THREE.MeshStandardMaterial({ color: 0xf7f2e6, roughness: .42 }),
    rock: new THREE.MeshStandardMaterial({ color: 0x8f877b, roughness: .95, flatShading: true }),
    moss: new THREE.MeshStandardMaterial({ color: 0x6f9a4a, roughness: .9 }),
    trainBody: new THREE.MeshPhysicalMaterial({ color: 0x2f8f86, roughness: .35, clearcoat: .8, clearcoatRoughness: .2 }),
    trainStripe: new THREE.MeshPhysicalMaterial({ color: 0xf2c14e, roughness: .35, clearcoat: .8 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x9fd4e8, roughness: .05, clearcoat: 1, transparent: true, opacity: .8 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: .7 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd66b, emissiveIntensity: 1.2 }),
    ramp: new THREE.MeshStandardMaterial({ color: 0xc99a5c, roughness: .8, side: THREE.DoubleSide }),
    gold: new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: .9, roughness: .22, emissive: 0x6b4300, emissiveIntensity: .35 }),
    shield: new THREE.MeshPhysicalMaterial({ color: 0x5cc3ea, roughness: .1, clearcoat: 1, transmission: .3, emissive: 0x0b4a66, emissiveIntensity: .4 }),
    magnet: new THREE.MeshPhysicalMaterial({ color: 0xe8574a, roughness: .2, clearcoat: 1, emissive: 0x5a0f08, emissiveIntensity: .4 })
  };
  // Bevel is added around the inner outline, so the finished box matches the requested size.
  function roundedBoxGeometry(width, height, depth, radius) {
    const outline = new THREE.Shape();
    const innerHalfWidth = width / 2 - radius; const innerHalfHeight = height / 2 - radius;
    outline.moveTo(-innerHalfWidth, -innerHalfHeight); outline.lineTo(innerHalfWidth, -innerHalfHeight);
    outline.lineTo(innerHalfWidth, innerHalfHeight); outline.lineTo(-innerHalfWidth, innerHalfHeight);
    const geometry = new THREE.ExtrudeGeometry(outline, { depth: depth - radius * 2, bevelEnabled: true, bevelSize: radius, bevelThickness: radius, bevelSegments: 3 });
    geometry.translate(0, 0, -(depth - radius * 2) / 2);
    return geometry;
  }
  function createBoulderGeometry() {
    const geometry = new THREE.IcosahedronGeometry(1, 2);
    const positions = geometry.attributes.position; const vertex = new THREE.Vector3();
    for (let index = 0; index < positions.count; index++) {
      vertex.fromBufferAttribute(positions, index);
      const bump = 1 + .15 * Math.sin(vertex.x * 4.1 + vertex.y * 2.3) * Math.cos(vertex.z * 3.7 - vertex.y * 1.9) + .06 * Math.sin(vertex.x * 9 + vertex.z * 7);
      vertex.multiplyScalar(bump); positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }
    geometry.computeVertexNormals();
    return geometry;
  }
  const crateGeometry = roundedBoxGeometry(1.7, 1.05, 1.5, .08);
  const plankGeometry = roundedBoxGeometry(1.78, .16, .1, .03);
  const trainGeometry = roundedBoxGeometry(2.15, 2.6, 10, .3);
  const boulderGeometry = createBoulderGeometry();
  const wheelGeometry = new THREE.CylinderGeometry(.34, .34, .22, 20);
  const coinRimGeometry = new THREE.TorusGeometry(.23, .035, 10, 28);
  const magnetGeometry = new THREE.TorusGeometry(.33, .12, 14, 28, Math.PI);
  const barrelProfile = [[0, 0], [.36, 0], [.43, .24], [.46, .52], [.43, .8], [.36, 1.04], [0, 1.04]]
    .map(([radius, height]) => new THREE.Vector2(radius, height));
  const barrelGeometry = new THREE.LatheGeometry(barrelProfile, 28);
  const barrelHoopGeometry = new THREE.TorusGeometry(.445, .035, 8, 28);
  const pipeGeometry = new THREE.CylinderGeometry(.38, .38, 2.4, 28);
  const pipeFlangeGeometry = new THREE.TorusGeometry(.4, .07, 10, 28);
  obstacleMaterials.hazard = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: .45 });
  obstacleMaterials.pipe = new THREE.MeshPhysicalMaterial({ color: 0x4f8f5a, roughness: .38, clearcoat: .5, metalness: .3 });
  const rampGeometry = new THREE.BufferGeometry();
  rampGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1.05, 0, 11, 1.05, 0, 11, -1.05, 2.8, 5, 1.05, 0, 11, 1.05, 2.8, 5, -1.05, 2.8, 5]), 3));
  rampGeometry.computeVertexNormals();
  function obstaclePart(parent, geometry, partMaterial, position, rotation = [0, 0, 0], scale = [1, 1, 1]) {
    const mesh = new THREE.Mesh(geometry, partMaterial);
    mesh.position.set(...position); mesh.rotation.set(...rotation); mesh.scale.set(...scale);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function spawnObject(type, lane, ahead, elevation = 0) {
    const mesh = new THREE.Group(); const lanePosition = lane * 2.7;
    const materials = obstacleMaterials;
    if (type === 'coin') {
      obstaclePart(mesh, coinGeometry, materials.gold, [0, .85, 0], [Math.PI / 2, 0, 0]);
      obstaclePart(mesh, coinRimGeometry, materials.gold, [0, .85, 0]);
    }
    if (type === 'crate') {
      obstaclePart(mesh, crateGeometry, materials.wood, [0, .525, 0]);
      for (const face of [-1, 1]) {
        for (const plankHeight of [.25, .8]) obstaclePart(mesh, plankGeometry, materials.woodDark, [0, plankHeight, face * .76]);
        const diagonal = obstaclePart(mesh, plankGeometry, materials.woodDark, [0, .525, face * .77], [0, 0, .52], [.92, 1, 1]);
        diagonal.castShadow = false;
      }
      for (const cornerX of [-.82, .82]) for (const cornerZ of [-.72, .72]) {
        obstaclePart(mesh, cubeGeometry, materials.metal, [cornerX, .525, cornerZ], [0, 0, 0], [.1, 1.08, .1]);
      }
    }
    if (type === 'bar') {
      for (const side of [-1, 1]) {
        obstaclePart(mesh, cylinderGeometry, materials.metal, [side * 1.05, 1.4, 0], [0, 0, 0], [.09, 2.8, .09]);
        obstaclePart(mesh, cylinderGeometry, materials.rubber, [side * 1.05, .06, 0], [0, 0, 0], [.28, .12, .28]);
        obstaclePart(mesh, sphereGeometry, materials.lamp, [side * 1.05, 2.9, 0], [0, 0, 0], [.14, .14, .14]);
      }
      const stripeCount = 6; const barrierWidth = 2.1;
      for (let stripe = 0; stripe < stripeCount; stripe++) {
        const stripeX = -barrierWidth / 2 + barrierWidth / stripeCount * (stripe + .5);
        obstaclePart(mesh, cubeGeometry, stripe % 2 ? materials.stripeWhite : materials.stripeRed, [stripeX, 2.12, 0], [0, 0, 0], [barrierWidth / stripeCount, .9, .22]);
      }
      obstaclePart(mesh, cubeGeometry, materials.metal, [0, 2.6, 0], [0, 0, 0], [2.2, .07, .26]);
      obstaclePart(mesh, cubeGeometry, materials.metal, [0, 1.64, 0], [0, 0, 0], [2.2, .07, .26]);
    }
    if (type === 'rock') {
      obstaclePart(mesh, boulderGeometry, materials.rock, [0, 1.15, 0], [.2, .6, -.1], [1.1, 1.25, 1.05]);
      obstaclePart(mesh, sphereGeometry, materials.moss, [-.3, 2.12, .2], [0, 0, .2], [.5, .14, .42]);
      obstaclePart(mesh, boulderGeometry, materials.rock, [.95, .22, .55], [1, .3, 0], [.28, .22, .26]);
      obstaclePart(mesh, boulderGeometry, materials.rock, [-.9, .16, .7], [.4, 1.2, 0], [.2, .16, .2]);
    }
    if (type === 'train') {
      obstaclePart(mesh, trainGeometry, materials.trainBody, [0, 1.58, 0]);
      for (const side of [-1, 1]) {
        obstaclePart(mesh, cubeGeometry, materials.trainStripe, [side * 1.08, 1.05, 0], [0, 0, 0], [.03, .2, 9.4]);
        for (const windowZ of [-3.5, -1.5, .5, 2.5]) obstaclePart(mesh, cubeGeometry, materials.glass, [side * 1.08, 2.05, windowZ], [0, 0, 0], [.03, .75, 1.3]);
        for (const wheelZ of [-3.6, -2.4, 2.4, 3.6]) obstaclePart(mesh, wheelGeometry, materials.rubber, [side * .82, .34, wheelZ], [0, 0, Math.PI / 2]);
        obstaclePart(mesh, sphereGeometry, materials.lamp, [side * .62, 1.1, 5.03], [0, 0, 0], [.16, .16, .05]);
      }
      obstaclePart(mesh, cubeGeometry, materials.glass, [0, 2.1, 5.03], [0, 0, 0], [1.6, .8, .03]);
      obstaclePart(mesh, rampGeometry, materials.ramp, [0, 0, 0]);
    }
    if (type === 'shield') {
      obstaclePart(mesh, sphereGeometry, materials.shield, [0, 1.05, 0], [0, 0, 0], [.46, .52, .2]);
      obstaclePart(mesh, coinRimGeometry, materials.gold, [0, 1.05, 0], [0, 0, 0], [2.05, 2.3, 1]);
    }
    if (type === 'barrel') {
      for (const offsetX of [-.5, .5]) {
        obstaclePart(mesh, barrelGeometry, materials.wood, [offsetX, 0, 0]);
        for (const hoopHeight of [.2, .84]) obstaclePart(mesh, barrelHoopGeometry, materials.metal, [offsetX, hoopHeight, 0], [Math.PI / 2, 0, 0], [.93, .93, 1]);
        obstaclePart(mesh, barrelHoopGeometry, materials.hazard, [offsetX, .52, 0], [Math.PI / 2, 0, 0], [1.03, 1.03, 1.4]);
      }
    }
    if (type === 'pipe') {
      for (const side of [-1, 1]) {
        obstaclePart(mesh, cubeGeometry, materials.hazard, [side * 1.08, 1.05, 0], [0, 0, 0], [.2, 2.1, .3]);
        obstaclePart(mesh, cubeGeometry, materials.metal, [side * 1.08, .04, 0], [0, 0, 0], [.42, .08, .5]);
        obstaclePart(mesh, pipeFlangeGeometry, materials.metal, [side * 1.05, 2.25, 0], [0, Math.PI / 2, 0]);
      }
      obstaclePart(mesh, pipeGeometry, materials.pipe, [0, 2.25, 0], [0, 0, Math.PI / 2]);
      obstaclePart(mesh, pipeFlangeGeometry, materials.metal, [0, 2.25, 0], [0, Math.PI / 2, 0]);
    }
    if (type === 'magnet') {
      obstaclePart(mesh, magnetGeometry, materials.magnet, [0, 1.05, 0], [0, 0, Math.PI]);
      for (const side of [-1, 1]) obstaclePart(mesh, cubeGeometry, materials.stripeWhite, [side * .33, .87, 0], [0, 0, 0], [.2, .16, .2]);
    }
    mesh.position.set(lanePosition, elevation, 3 - ahead); scene.add(mesh); obstacles.push({ type, lane, mesh, elevation, checked: false });
  }
  let groupCount = 0;
  function spawnPattern() {
    groupCount++; const lane = Math.floor(Math.random() * 3) - 1; const safeLane = lane === 1 ? 0 : lane + 1;
    const groundObstacleTypes = ['crate', 'bar', 'rock', 'barrel', 'pipe'];
    const type = groupCount % 5 === 0 ? 'train' : groundObstacleTypes[Math.floor(Math.random() * groundObstacleTypes.length)];
    spawnObject(type, lane, 96);
    for (let index = 0; index < 7; index++) spawnObject('coin', safeLane, 82 + index * 2.4);
    if (type === 'train') for (let index = 0; index < 4; index++) spawnObject('coin', lane, 94 + index * 2, 2.8);
    if (groupCount % 4 === 0) spawnObject(groupCount % 8 === 0 ? 'magnet' : 'shield', safeLane, 101);
  }
  function hit(obstacle) {
    if (obstacle.checked) return; obstacle.checked = true;
    if (state.grace > 0) return;
    if (state.shield) { state.shield = false; state.grace = 1; notify('护盾挡住了碰撞'); beep(330); return; }
    if (state.threat > 0) { finishRun(); return; }
    state.threat = 7; state.grace = 1.2; notify('牛牛追来了！7秒内不要再碰撞'); beep(170, .2);
  }
  function updateRun(delta) {
    state.elapsed += delta; state.speed = Math.min(difficulty[state.difficulty].max, difficulty[state.difficulty].speed + state.distance / 400);
    const travel = state.speed * delta; state.distance += travel; state.spawn -= travel;
    state.threat = Math.max(0, state.threat - delta); state.grace = Math.max(0, state.grace - delta); state.magnet = Math.max(0, state.magnet - delta); state.slide = Math.max(0, state.slide - delta);
    if (state.spawn <= 0) { spawnPattern(); state.spawn += difficulty[state.difficulty].spacing; }
    for (const chunk of chunks) { chunk.position.z += travel; if (chunk.position.z > 24) chunk.position.z -= 144; }
    frog.root.position.x = THREE.MathUtils.damp(frog.root.position.x, state.lane * 2.7, 15, delta);
    let support = 0;
    for (const obstacle of obstacles) {
      obstacle.mesh.position.z += travel;
      if (obstacle.type === 'train' && Math.abs(frog.root.position.x - obstacle.mesh.position.x) < .99) {
        const relative = 3 - obstacle.mesh.position.z;
        if (relative >= 5 && relative <= 11) support = Math.max(support, (11 - relative) / 6 * 2.8);
        else if (relative >= -5 && relative < 5 && state.height >= 2.55) support = 2.8;
      }
    }
    if (state.velocity !== 0 || state.height > support + .01) { state.velocity -= 25 * delta; state.height += state.velocity * delta; }
    if (state.height <= support) { state.height = support; state.velocity = 0; }
    if (support > 2) progress.roof += travel;
    frog.root.position.y = state.height;
    for (let index = obstacles.length - 1; index >= 0; index--) {
      const obstacle = obstacles[index]; const relative = obstacle.mesh.position.z - 3;
      const sameLane = Math.abs(frog.root.position.x - obstacle.mesh.position.x) < .95;
      if (obstacle.type === 'coin') {
        obstacle.mesh.rotation.y += delta * 3;
        const collected = (sameLane && Math.abs(relative) < 1 && Math.abs(state.height - obstacle.elevation) < 1.3) || (state.magnet > 0 && Math.abs(relative) < 7);
        if (collected) { state.coins++; beep(1100, .06); scene.remove(obstacle.mesh); obstacles.splice(index, 1); continue; }
      } else if (obstacle.type === 'shield' || obstacle.type === 'magnet') {
        obstacle.mesh.rotation.y += delta;
        if (sameLane && Math.abs(relative) < 1.1 && state.height < 1.5) { if (obstacle.type === 'shield') state.shield = true; else state.magnet = 10; notify(obstacle.type === 'shield' ? '获得护盾 · 抵挡一次碰撞' : '磁铁生效 · 10秒自动收集'); scene.remove(obstacle.mesh); obstacles.splice(index, 1); continue; }
      } else if (sameLane && !obstacle.checked) {
        if (obstacle.type === 'train') { if (relative >= -5 && relative <= 5 && state.height < 2.5) hit(obstacle); }
        else if (Math.abs(relative) < .9) {
          const mustJumpOver = obstacle.type === 'crate' || obstacle.type === 'barrel';
          const mustSlideUnder = obstacle.type === 'bar' || obstacle.type === 'pipe';
          const safe = mustJumpOver ? state.height > 1.15 : mustSlideUnder ? state.slide > 0 || state.height > 3.2 : false;
          if (!safe) hit(obstacle); else obstacle.checked = true;
        }
      }
      if (obstacle.mesh.position.z > 19) { scene.remove(obstacle.mesh); obstacles.splice(index, 1); }
      if (state.mode !== 'running') break;
    }
    element('distance').textContent = Math.floor(state.distance); element('coins').textContent = state.coins;
    element('danger').textContent = state.threat > 0 ? `追兵逼近 · ${state.threat.toFixed(1)} 秒内不要再撞！` : '阳光正好，尽情奔跑';
    element('danger').style.color = state.threat > 0 ? '#ac443b' : '#5d4b38';
    element('effects').textContent = [state.shield ? '护盾已就绪' : '', state.magnet > 0 ? `磁铁 ${Math.ceil(state.magnet)} 秒` : '', support > 2 ? '车顶漫游' : ''].filter(Boolean).join(' · ');
  }
  const missionList = [
    { name: '一次跑过 500 米', key: 'best', target: 500, reward: 60 },
    { name: '累计收集 100 枚金币', key: 'coins', target: 100, reward: 50 },
    { name: '累计完成 20 次跳跃', key: 'jumps', target: 20, reward: 40 },
    { name: '累计完成 15 次滑铲', key: 'slides', target: 15, reward: 40 },
    { name: '累计在车顶跑过 100 米', key: 'roof', target: 100, reward: 80 },
    { name: '完成 5 次冒险', key: 'runs', target: 5, reward: 50 }
  ];
  function openPanel(name) {
    if (state.mode !== 'home') return;
    const titles = { maps: '今天想去哪里？', shop: '奶蛙的衣帽间', missions: '成长之路', guide: '每条路都有新花样', records: '你的奔跑足迹', settings: '旅途设置' };
    element('panelTitle').textContent = titles[name]; const content = element('panelContent');
    if (name === 'maps') content.innerHTML = `<p>一局一座小世界。选择喜欢的风景出发。</p><div class="option-grid">${maps.map((theme, index) => `<button class="option ${progress.map === index ? 'active' : ''}" data-map="${index}"><span class="swatch" style="background:#${theme.sky.toString(16)}"></span><strong>${theme.name}</strong><small>${theme.caption}</small></button>`).join('')}</div>`;
    if (name === 'shop') content.innerHTML = `<p>金币解锁原创配色，所有服装使用相同碰撞体积。余额 ${progress.wallet} 金币。</p><div class="option-grid">${outfits.map((outfit, index) => `<button class="option ${progress.outfit === index ? 'active' : ''}" data-outfit="${index}"><span class="swatch" style="background:#${outfit.color.toString(16)}"></span><strong>${outfit.name}</strong><small>${progress.owned.includes(index) ? progress.outfit === index ? '正在穿着' : '已拥有 · 点击穿上' : `${outfit.cost} 金币 · 点击购买`}</small></button>`).join('')}</div>`;
    if (name === 'missions') content.innerHTML = '<p>小小进步，也值得奖励。进度保存在当前浏览器。</p>' + missionList.map((mission, index) => `<div class="mission"><strong>${mission.name}</strong><progress max="${mission.target}" value="${progress[mission.key]}"></progress><small>${Math.min(mission.target, Math.floor(progress[mission.key]))} / ${mission.target}</small><button data-claim="${index}" style="float:right">${progress.claimed.includes(index) ? '已领取' : `领取 ${mission.reward} 金币`}</button></div>`).join('');
    if (name === 'guide') content.innerHTML = '<p>键盘 ← → / A D 换道，↑ / W / 空格跳跃，↓ / S 滑铲。手机四方向滑动或按底部按钮。Esc 暂停。</p>' + [['木箱', '跳跃或者换道，起跳需要提前一点。'], ['油桶', '两只并排的矮桶，跳过去或换道。'], ['高横杆', '滑铲穿过，站着会撞到。'], ['绿色管道', '横跨车道的管子，滑铲从下面钻过。'], ['巨石', '不能跳过，必须换道。'], ['列车与斜坡', '迎着木坡自动登车，车顶可跳跃滑铲；换道会落回地面。'], ['护盾与磁铁', '蓝色抵挡一次碰撞；红色吸引金币10秒。'], ['牛牛与猎犬', '首次撞击召来追兵，7秒内再次撞击被抓，安全坚持就能甩开。']].map(([title, text]) => `<div class="mission"><strong>${title}</strong><p>${text}</p></div>`).join('');
    if (name === 'records') content.innerHTML = `<p>历史最远 <strong>${progress.best} 米</strong> · 完成 ${progress.runs} 次冒险<br>这是本机纪录，不是联网排行榜。</p>` + (progress.records.length ? progress.records.map((record, index) => `<div class="mission">${index + 1}. ${record.distance} 米 <small> / ${record.coins} 金币 · ${record.map} · ${{ easy: '简单', normal: '普通', hard: '困难' }[record.difficulty]}</small></div>`).join('') : '<p>还没有足迹，去开启第一次冒险吧。</p>');
    if (name === 'settings') content.innerHTML = `<p>画质影响渲染分辨率。手机推荐流畅模式。</p><div class="option-grid"><button class="option" data-quality="1">流畅画质</button><button class="option" data-quality="2">清晰画质</button></div><p>声音可用顶部按钮开启。此版本为原创程序化模型，未使用参考站素材；3D引擎首次加载需要网络。</p><p>金币、服装、任务和纪录保存在此浏览器，清理站点数据会丢失进度。</p>`;
    element('panel').hidden = false;
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.panel) openPanel(button.dataset.panel);
    if (button.dataset.difficulty) { state.difficulty = button.dataset.difficulty; document.querySelectorAll('[data-difficulty]').forEach(item => item.classList.toggle('selected', item === button)); }
    if (button.dataset.map !== undefined) { progress.map = Number(button.dataset.map); rebuildWorld(); syncHome(); save(); openPanel('maps'); }
    if (button.dataset.outfit !== undefined) {
      const index = Number(button.dataset.outfit); const outfit = outfits[index];
      if (!progress.owned.includes(index)) { if (progress.wallet < outfit.cost) { notify('金币还不够，再去跑一局吧'); return; } progress.wallet -= outfit.cost; progress.owned.push(index); }
      progress.outfit = index; scene.remove(frog.root); frog = makeFrog(); syncHome(); save(); openPanel('shop');
    }
    if (button.dataset.claim !== undefined) { const index = Number(button.dataset.claim); const mission = missionList[index]; if (progress.claimed.includes(index)) return; if (progress[mission.key] < mission.target) { notify('继续冒险，离目标更近一点'); return; } progress.claimed.push(index); progress.wallet += mission.reward; save(); syncHome(); openPanel('missions'); beep(900); }
    if (button.dataset.quality) { progress.quality = Number(button.dataset.quality); renderer.setPixelRatio(Math.min(devicePixelRatio, progress.quality)); resize(); save(); notify('画质已更新'); }
    if (button.dataset.action) action(button.dataset.action);
  });
  element('start').onclick = startRun; element('retry').onclick = startRun; element('returnHome').onclick = goHome;
  element('homeButton').onclick = () => { if (state.mode !== 'home') notify('先完成这次冒险，再返回车站'); };
  element('closePanel').onclick = () => element('panel').hidden = true;
  function togglePause() { if (!['running', 'paused'].includes(state.mode)) return; state.mode = state.mode === 'running' ? 'paused' : 'running'; element('pause').textContent = state.mode === 'paused' ? '▶' : 'Ⅱ'; notify(state.mode === 'paused' ? '已暂停 · 点击右上角继续' : '继续冒险'); }
  element('pause').onclick = togglePause;
  element('sound').onclick = () => { soundOn = !soundOn; element('sound').textContent = soundOn ? '声音：开' : '声音：关'; beep(700); };
  window.addEventListener('keydown', event => { const keys = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'jump', w: 'jump', ' ': 'jump', ArrowDown: 'slide', s: 'slide' }; if (keys[event.key]) { event.preventDefault(); if (!event.repeat) action(keys[event.key]); } if (event.key === 'Escape') togglePause(); if (event.key === 'Enter' && state.mode === 'home' && element('panel').hidden) startRun(); });
  let pointerStart;
  element('app').addEventListener('pointerdown', event => { if (event.target.closest('button') || state.mode !== 'running') return; pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId }; });
  window.addEventListener('pointerup', event => { if (!pointerStart || pointerStart.id !== event.pointerId) return; const horizontal = event.clientX - pointerStart.x; const vertical = event.clientY - pointerStart.y; pointerStart = null; if (Math.max(Math.abs(horizontal), Math.abs(vertical)) < 24) return; action(Math.abs(horizontal) > Math.abs(vertical) ? horizontal > 0 ? 'right' : 'left' : vertical > 0 ? 'slide' : 'jump'); });
  window.addEventListener('pointercancel', () => pointerStart = null);
  document.addEventListener('visibilitychange', () => { if (document.hidden && state.mode === 'running') togglePause(); });
  function resize() { const bounds = element('app').getBoundingClientRect(); renderer.setSize(bounds.width, bounds.height, false); camera.aspect = bounds.width / bounds.height; camera.updateProjectionMatrix(); }
  window.addEventListener('resize', resize); resize(); syncHome(); element('loading').hidden = true;
  let previous = performance.now();
  function frame(timestamp) {
    requestAnimationFrame(frame); const delta = Math.min((timestamp - previous) / 1000, .04); previous = timestamp;
    if (state.mode !== 'paused') state.time += delta;
    if (state.mode === 'running') updateRun(delta);
    const running = state.mode === 'running';
    if (state.mode === 'home') {
      frog.root.position.set(0, 0, 3); frog.root.rotation.y = Math.sin(state.time * .35) * .25; frog.body.scale.set(1, 1, 1); frog.body.rotation.x = 0;
      frog.body.position.y = Math.sin(state.time * 2) * .035;
      frog.limbs.forEach(limb => limb.rotation.x = Math.sin(state.time * 2) * .06);
      camera.position.set(0, 4.5, 11.5); camera.lookAt(0, 1.4, 2.2); bull.visible = false; dog.visible = false;
    } else {
      if (running) {
        frog.body.position.y = state.slide ? -.18 : Math.sin(state.time * 17) * .07;
        frog.body.scale.y = THREE.MathUtils.damp(frog.body.scale.y, state.slide ? .4 : 1, 18, delta);
        frog.body.rotation.x = THREE.MathUtils.damp(frog.body.rotation.x, state.slide ? -.35 : 0, 18, delta);
        frog.limbs.forEach((limb, index) => limb.rotation.x = Math.sin(state.time * 17 + (index < 2 ? 0 : Math.PI)) * (index % 2 ? -.55 : .55));
      }
      camera.position.x = THREE.MathUtils.damp(camera.position.x, frog.root.position.x * .2, 4, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, 7.2 + state.height * .25, 4, delta); camera.position.z = 16;
      camera.lookAt(frog.root.position.x * .15, .8 + state.height * .2, -3);
      bull.visible = state.threat > 0 || state.mode === 'ended';
      dog.visible = false;
      const chaseDistance = state.mode === 'ended' ? 4.8 : 5.5 + (7 - state.threat) * .35;
      bull.position.x = THREE.MathUtils.damp(bull.position.x, frog.root.position.x - .75, 3, delta);
      bull.position.y = Math.abs(Math.sin(state.time * 12)) * .12;
      bull.position.z = chaseDistance;
      bull.rotation.z = Math.sin(state.time * 12) * .035;
      bull.userData.legs.forEach((leg, index) => {
        const gallopPhase = index % 2 === 0 ? 0 : Math.PI;
        leg.rotation.x = Math.sin(state.time * 12 + gallopPhase) * .6;
      });
      if (bull.userData.body) bull.userData.body.rotation.x = Math.sin(state.time * 12) * .05;
    }
    frog.shadow.visible = state.height < .4;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
})();
