'use client'

import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber'
import { OrbitControls, Grid, Html } from '@react-three/drei'
import { EffectComposer, Noise } from '@react-three/postprocessing'
import * as THREE from 'three'
import React, { useRef, useState, useEffect, useMemo, Suspense } from 'react'

function useTypewriter(text: string, speed: number = 40) {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    if (!text) {
      setDisplayed('')
      return
    }

    setDisplayed('')
    let index = 0
    const interval = setInterval(() => {
      index += 1
      setDisplayed(text.slice(0, index))
      if (index >= text.length) {
        clearInterval(interval)
      }
    }, speed)

    return () => {
      clearInterval(interval)
    }
  }, [text, speed])

  return displayed
}

// ================= 🌍 核心叙事数据 =================

const SITE_CONFIG = {
  zh: {
    mainTitle: '美好家园',
    subTitle: '在地童境计划',
    langBtn: 'EN',
    backBtn: '← 退出沉浸',
    clickHint: '点击触碰记忆，转译空间',
    cardLabels: { pastMemory: '乡村记忆', childBehavior: '儿童行为', spatialTranslation: '空间转译', interaction: '互动体验' }
  },
  en: {
    mainTitle: 'Better Home',
    subTitle: 'Local Childhood Scape',
    langBtn: '中',
    backBtn: '← Exit',
    clickHint: 'Click to translate space',
    cardLabels: { pastMemory: 'Past Memory', childBehavior: 'Behavior', spatialTranslation: 'Translation', interaction: 'Interaction' }
  }
}

const NODES_DATA = [
  { slug: "walk-by-river", entry: "沿着河边走", keywords: "蛙鸣 · 水边 · 停留", formalName: "亲水步台", pastMemory: "村落河边的湿地经验，是孩子们天然的生态课堂。", childBehavior: "亲水、戏水、自然观察、结伴", spatialTranslation: "缓坡亲水阶梯栈道，将社区内的水池空间激活。", interaction: "触碰NFC触发潺潺流溪声。" },
  { slug: "tree-entrance", entry: "村口那棵树", keywords: "蝉鸣 · 聚集 · 纳凉", formalName: "树下议场", pastMemory: "大树是传统村落的社交核心，孩子们在巨大的树根间穿梭，听长辈讲古。", childBehavior: "自发性游戏、登高眺望、倾听叙事", spatialTranslation: "围绕乔木构建层叠、起伏的木质看台，创造情感连接的“议场”。", interaction: "触碰NFC节点触发微风吹过树叶的沙沙声。" },
  { slug: "path-behind-door", entry: "门后还有一条小路", keywords: "探索 · 穿行 · 隐秘", formalName: "穿行门", pastMemory: "传统村落错综复杂的窄巷与老木门，是探险与捉迷藏的天然迷宫。", childBehavior: "转角探索、捉迷藏、空间连续奔跑", spatialTranslation: "设计错落的微型几何圆孔穿行门洞群，重构街巷探索感。", interaction: "触碰NFC节点触发别乡村犬吠的声音。" },
  { slug: "only-we-know", entry: "只有我们知道", keywords: "雨声 · 躲藏 · 秘密", formalName: "秘密小屋", pastMemory: "村落中的秘密角落、自建小屋、堆放柴火的隐秘处，是专属的藏身空间。", childBehavior: "躲藏、停留、阅读、私密倾诉", spatialTranslation: "转化为社区中可进入、可停留包裹式微空间。", interaction: "NFC可触发儿童听见雨声，治愈的天然的白噪音。" },
  { slug: "stars-blink", entry: "听说星星会眨眼", keywords: "虫鸣 · 攀爬 · 远眺", formalName: "望星塔", pastMemory: "夏夜登高寻找北斗星的记忆，是乡村生活中关于垂直空间与星空的最初感知。", childBehavior: "攀爬、登高俯瞰、星空观测、空间发现。", spatialTranslation: "构建带有螺旋攀爬结构的轻量化塔形装置，设立垂直节点。", interaction: "登顶触碰NFC会伴随夜间虫鸣。" },
  { slug: "wind-turning", entry: "抬头听见风在转", keywords: "鸟鸣 · 律动 · 交换", formalName: "风巢标", pastMemory: "田间随风转动的风车与晾晒的谷物，带给孩子最直观的时间与季节感。", childBehavior: "动态观察、物物交换、装置互动", spatialTranslation: "设计带有动力感应装置的社区导视标志，将风能转化为律动。", interaction: "NFC触发触发鸟鸣。" },
  { slug: "beyond-wall", entry: "听见墙那边", keywords: "回声 · 倾听 · 回应", formalName: "回声墙", pastMemory: "对着墙喊话、听墙那头的呼唤，声音的反射是乡村空间最奇妙的互动。", childBehavior: "发声、倾听、回声对话、角色扮演", spatialTranslation: "设计传导装置，实现跨节点的实时声音对讲。", interaction: "儿童之间的声音。" },
  { slug: "my-yard", entry: "我家的院子", keywords: "篱笆 · 进出 · 家园", formalName: "院墙", pastMemory: "院子是家园的延伸，是篱笆、菜地、禽鸣与邻里隔墙打招呼的温情场域。", childBehavior: "穿行进出、驻足交谈、家庭游戏。", spatialTranslation: "提取传统院墙的透空度与尺度，构建半透光的低矮景墙系统。", interaction: "走近NFC区域触发家禽低鸣的氛围。" },
  { slug: "fish-scale", entry: "鱼鳞石上摆一摆", keywords: "江水 · 协作 · 摆放", formalName: "鱼鳞石台", pastMemory: "钱塘江边的鱼鳞石塘是天然的摆放台，孩子们在石头缝隙里寻找贝壳。", childBehavior: "摆放协作、自然物收集、手工创作、社交互助", spatialTranslation: "复刻鱼鳞石塘的高低差台面，设计互动台面，鼓励自发的手工区域。", interaction: "点击台面NFC触发江水拍岸声。" }
];

const GENERATE_LOCALIZED_DATA = () => {
  return NODES_DATA.map((item, idx) => {
    const angle = (idx / NODES_DATA.length) * Math.PI * 2
    const radius = 13 + (idx % 3) * 1.5 
    const y = 1.0 + (idx % 2) * 1.0
    return { ...item, idx, pos: [Math.cos(angle) * radius, y, Math.sin(angle) * radius] as [number, number, number] }
  })
}

// ================= 🏛️ 3D 核心景觀主場域 =================

function GlobalFogEnv() {
  return (
    <group> 
      <color attach="background" args={['#F5F8FA']} />
      <fog attach="fog" args={['#F5F8FA', 10, 45]} />
      <ambientLight intensity={1.5} color="#EEF4F8" />
      <directionalLight position={[10, 20, 15]} intensity={0.5} color="#FFFFFF" castShadow />
      <Grid infiniteGrid fadeDistance={45} sectionColor="#6FA8C9" sectionSize={2} cellColor="#EEF4F8" cellSize={0.5} sectionThickness={1.2} cellThickness={0.6} />
    </group>
  )
}

const CORE_COMMUNITIES = ["柏联社区", "象山社区", "狮子社区", "贤家庄社区", "龙心社区", "龙王沙社区"]
const MAIN_CLUSTER_SCALE = 1.35
const COMMUNITY_TEXT_Y_OFFSETS = [0.22, 0.28, 0.12, -0.1, -0.28, -0.22]

function FloatingCommunityLabel({ name, index, position }: { name: string, index: number, position: [number, number, number] }) {
  const labelRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (labelRef.current) {
      const time = state.clock.getElapsedTime()
      labelRef.current.position.y = position[1] + Math.sin(time * (0.55 + index * 0.06) + index * 1.25) * 0.18 * MAIN_CLUSTER_SCALE
    }
  })

  return (
    <group ref={labelRef} position={position}>
      <Html center style={{ pointerEvents: 'none' }}>
        <div style={{ color: "#5F7F99", fontSize: `${15 * MAIN_CLUSTER_SCALE}px`, fontWeight: 400, letterSpacing: `${4 * MAIN_CLUSTER_SCALE}px`, whiteSpace: 'nowrap', textShadow: '0 0 10px rgba(255,255,255,0.8)', animation: `particleDissolve 8s infinite ease-in-out ${index * 0.5}s` }}>
          {name}
        </div>
      </Html>
    </group>
  )
}

function CommunityParticleTextCore({ isFocusMode }: { isFocusMode: boolean }) {
  const pointsRef = useRef<THREE.Points>(null)
  const textGroupRef = useRef<THREE.Group>(null)

  const [geo] = useMemo(() => {
    const count = 1500
    const arr = new Float32Array(count * 3)
    for(let i=0; i<count; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * 4 * MAIN_CLUSTER_SCALE
      arr[i*3] = Math.cos(angle) * radius
      arr[i*3+1] = (Math.random() - 0.5) * 4 * MAIN_CLUSTER_SCALE
      arr[i*3+2] = Math.sin(angle) * radius
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    return [g]
  }, [])

  useFrame((state) => {
    const time = state.clock.getElapsedTime()
    if (pointsRef.current) {
      pointsRef.current.rotation.y = time * 0.05
      const positions = pointsRef.current.geometry.attributes.position.array as Float32Array
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(time + positions[i] * 0.5) * 0.002
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true
    }
    if (textGroupRef.current) textGroupRef.current.position.y = 1.5 * MAIN_CLUSTER_SCALE + Math.sin(time * 0.6) * 0.3 * MAIN_CLUSTER_SCALE
  })

  return (
    <group position={[0, 0, 0]}>
      <points ref={pointsRef} geometry={geo} position={[0, 1.5 * MAIN_CLUSTER_SCALE, 0]} visible={!isFocusMode}>
        <pointsMaterial size={0.12 * MAIN_CLUSTER_SCALE} color="#A6C2D6" transparent opacity={0.4} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <group ref={textGroupRef}>
        {!isFocusMode && CORE_COMMUNITIES.map((name, index) => {
          const col = index % 3
          const row = Math.floor(index / 3)
          const yOffset = COMMUNITY_TEXT_Y_OFFSETS[index] * MAIN_CLUSTER_SCALE
          const position: [number, number, number] = [(col - 1) * 2.8 * MAIN_CLUSTER_SCALE, (0.5 - row) * 1.0 * MAIN_CLUSTER_SCALE + yOffset, 0]
          return <FloatingCommunityLabel key={name} name={name} index={index} position={position} />
        })}
      </group>
    </group>
  )
}

function MemoryPhotoRing({ isFocusMode, photoUrls }: { isFocusMode: boolean, photoUrls: string[] }) {
  const groupRef = useRef<THREE.Group>(null)
  const textures = useLoader(THREE.TextureLoader, photoUrls, undefined, () => console.warn('Photo skip'))
  
  const photoMeshes = useMemo(() => {
    const meshes = []
    for (let i = 0; i < photoUrls.length; i++) {
      const angle = (i / photoUrls.length) * Math.PI * 2
      meshes.push({ position: [Math.cos(angle) * 6.5 * MAIN_CLUSTER_SCALE, 0, Math.sin(angle) * 6.5 * MAIN_CLUSTER_SCALE], rotation: [0, -angle + Math.PI / 2, 0] })
    }
    return meshes
  }, [photoUrls.length])

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.position.y = 1.8 * MAIN_CLUSTER_SCALE + Math.sin(state.clock.getElapsedTime() * 0.5) * 0.2 * MAIN_CLUSTER_SCALE
      if (!isFocusMode) groupRef.current.rotation.y += delta * 0.04 
    }
  })

  return (
    <group ref={groupRef} visible={!isFocusMode}>
      {photoMeshes.map((m, i) => (
        <mesh key={i} position={m.position as any} rotation={m.rotation as any}>
          <planeGeometry args={[2.2 * MAIN_CLUSTER_SCALE, 1.4 * MAIN_CLUSTER_SCALE]} />
          {textures[i] ? <meshBasicMaterial map={textures[i]} transparent opacity={0.65} side={THREE.DoubleSide} /> : <meshBasicMaterial color="#A6C2D6" transparent opacity={0.3} side={THREE.DoubleSide} />}
        </mesh>
      ))}
    </group>
  )
}

function MemoryNode({ data, isActive, isFocusMode, onSelect }: any) {
  const [hovered, setHover] = useState(false)
  const groupRef = useRef<THREE.Group>(null)
  const isVisible = isFocusMode ? isActive : true

  useFrame((state) => {
    if (groupRef.current) {
      const time = state.clock.getElapsedTime()
      groupRef.current.position.y = data.pos[1] + Math.sin(time + data.pos[0]) * 0.15
      const s = (hovered || isActive) ? 1.15 : 1.0
      groupRef.current.scale.lerp(new THREE.Vector3(s, s, s), 0.1)
    }
  })

  const pinColor = (hovered || isActive) ? "#6FA8C9" : "#A6C2D6"

  return (
    <group visible={isVisible}>
      <group 
        ref={groupRef} position={data.pos} onClick={onSelect}
        onPointerOver={() => { setHover(true); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto' }}
      >
        {!isFocusMode && (
          <Html position={[0, 0.8, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ color: '#6FA8C9', fontSize: '12px', opacity: hovered ? 1 : 0, transform: `translateY(${hovered ? '0px' : '10px'})`, transition: 'all 0.5s', whiteSpace: 'nowrap', fontWeight: 300, letterSpacing: '1px' }}>
                {data.keywords}
              </div>
              <div style={{ color: hovered ? '#334155' : '#8DA5B7', fontSize: '14px', letterSpacing: '1px', transition: 'all 0.4s', whiteSpace: 'nowrap' }}>
                {data.entry}
              </div>
            </div>
          </Html>
        )}
        <mesh visible={false}><sphereGeometry args={[1.5, 16, 16]} /><meshBasicMaterial /></mesh>
        
        {isVisible && <mesh><sphereGeometry args={[0.12, 32, 32]} /><meshBasicMaterial color={pinColor} /></mesh>}
        {isVisible && <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.3, 0.4, 32]} /><meshBasicMaterial color={pinColor} transparent opacity={hovered ? 0.6 : 0.2} /></mesh>}
      </group>
      {isVisible && <mesh position={[data.pos[0], data.pos[1] / 2, data.pos[2]]}><cylinderGeometry args={[0.005, 0.005, data.pos[1], 8]} /><meshBasicMaterial color="#6FA8C9" transparent opacity={0.3} /></mesh>}
    </group>
  )
}

function MemoryNodeOuterRing({ children, isFocusMode }: { children: React.ReactNode, isFocusMode: boolean }) {
  const ringRef = useRef<THREE.Group>(null)
  useFrame((_, delta) => { if (ringRef.current && !isFocusMode) ringRef.current.rotation.y -= delta * 0.02 }) 
  return <group ref={ringRef}>{children}</group>
}

function CameraManager({ activeNode }: { activeNode: any }) {
  const { camera, controls } = useThree()
  useFrame((_, delta) => {
    const orbit = controls as any
    if (!orbit) return
    if (activeNode) {
      camera.position.lerp(new THREE.Vector3(0, 10, 18), 1.5 * delta)
      orbit.target.lerp(new THREE.Vector3(0, 2, 0), 1.5 * delta)
      orbit.enableRotate = false
    } else {
      camera.position.lerp(new THREE.Vector3(0, 20, 28), 1.0 * delta)
      orbit.target.lerp(new THREE.Vector3(0, 0, 0), 1.0 * delta)
      orbit.enableRotate = true
    }
    orbit.update()
  })
  return null
}

// ================= 🔑 TouchDesigner 高流暢清透粒子影像組件 (已修復變數錯誤) 🔑 =================

const TouchDesignerParticleImage = ({ src, onTranslated }: { src: string, onTranslated: () => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  
  const stateRef = useRef({
    particles: [] as any[],
    gatherProgress: 0,
    startTime: Date.now(),
    interactTime: null as number | null,
    width: 0,
    height: 0,
  });

  useEffect(() => {
    let isMounted = true;
    const img = new Image();
    // 加上跨域允許，確保能讀取像素
    img.crossOrigin = "Anonymous";
    img.src = src;
    img.onload = () => {
      if (!isMounted) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = 550; 
      const h = 330;
      
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      stateRef.current.width = w * dpr;
      stateRef.current.height = h * dpr;

      const sampleCanvas = document.createElement('canvas');
      const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
      if (!sampleCtx) return;

      const sampleW = 280;
      const sampleH = Math.floor(sampleW * (img.height / img.width));
      sampleCanvas.width = sampleW;
      sampleCanvas.height = sampleH;
      sampleCtx.drawImage(img, 0, 0, sampleW, sampleH);

      // ★ 這裡就是之前引發空白崩潰的拼寫修復點
      const imgData = sampleCtx.getImageData(0, 0, sampleW, sampleH).data;
      const particles = [];

      const scale = Math.min((w * dpr * 0.85) / sampleW, (h * dpr * 0.85) / sampleH);
      const offsetX = (w * dpr - sampleW * scale) / 2;
      const offsetY = (h * dpr - sampleH * scale) / 2;

      for (let y = 0; y < sampleH; y++) {
        for (let x = 0; x < sampleW; x++) {
          const idx = (y * sampleW + x) * 4;
          const r = imgData[idx];
          const g = imgData[idx + 1]; // 這裡已修復
          const b = imgData[idx + 2]; // 這裡已修復
          
          const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

          if (brightness < 0.78) {
            const targetX = offsetX + x * scale;
            const targetY = offsetY + y * scale;
            
            const angle = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * 40;
            const initX = targetX + Math.cos(angle) * dist;
            const initY = targetY + Math.sin(angle) * dist;

            particles.push({
              targetX, targetY, initX, initY,
              brightness,
              seed: Math.random() * 120,
              size: (0.8 + (1.0 - brightness) * 1.5) * dpr, 
              alpha: (1.0 - brightness) * 0.85, 
            });
          }
        }
      }

      stateRef.current.particles = particles;
      stateRef.current.gatherProgress = 1; // 直接使用最終凝聚狀態
      stateRef.current.startTime = Date.now();
      stateRef.current.interactTime = null;

      // 僅渲染一次最終靜態粒子圖像
      const renderStatic = () => {
        const c = canvasRef.current;
        if (!c) return;
        const context = c.getContext('2d');
        if (!context) return;

        const { width, height, particles: pts } = stateRef.current;
        context.clearRect(0, 0, width, height);

        const easeProgress = 1; // 完全凝聚

        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];

          const cx = p.targetX;
          const cy = p.targetY;

          context.beginPath();
          context.arc(cx, cy, p.size * 0.5, 0, Math.PI * 2);

          if (p.brightness < 0.3) {
            context.fillStyle = `rgba(30, 41, 59, ${p.alpha * easeProgress})`;
          } else {
            context.fillStyle = `rgba(95, 127, 153, ${p.alpha * easeProgress})`;
          }
          context.fill();
        }
      };

      renderStatic();
    };

    return () => {
      isMounted = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [src]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (stateRef.current.interactTime !== null) return;
    stateRef.current.interactTime = Date.now();
    setTimeout(() => onTranslated(), 600);
  };

  return (
    <canvas 
      ref={canvasRef} 
      onClick={handleClick}
      style={{ display: 'block', margin: '0 auto', cursor: 'pointer', background: 'transparent' }}
    />
  );
};

// ================= 🏛️ 二段式沉浸 UI =================

export default function Home() {
  const [lang, setLang] = useState<'zh' | 'en'>('zh')
  const [activeNode, setActiveNode] = useState<any | null>(null)
  const [revealPhase, setRevealPhase] = useState<'memory' | 'design'>('memory')
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [photosLoaded, setPhotosLoaded] = useState(false)
  
  const handleRevealDesign = () => {
    setRevealPhase('design')
  }

  const config = SITE_CONFIG[lang]
  const nodes = useMemo(() => GENERATE_LOCALIZED_DATA(), [])
  const mode = activeNode ? 'focus' : 'gallery'

  const pastMemoryKey = activeNode ? `${activeNode.slug}-past-${revealPhase}` : ''
  const designChildKey = activeNode ? `${activeNode.slug}-child-${revealPhase}` : ''
  const designSpatialKey = activeNode ? `${activeNode.slug}-spatial-${revealPhase}` : ''
  const designInteractKey = activeNode ? `${activeNode.slug}-interact-${revealPhase}` : ''

  const typedPastMemory = useTypewriter(revealPhase === 'memory' && activeNode ? activeNode.pastMemory : '', 35)
  const typedChildBehavior = useTypewriter(revealPhase === 'design' && activeNode ? activeNode.childBehavior : '', 35)
  const typedSpatialTranslation = useTypewriter(revealPhase === 'design' && activeNode ? activeNode.spatialTranslation : '', 35)
  const typedInteraction = useTypewriter(revealPhase === 'design' && activeNode ? activeNode.interaction : '', 35)

  useEffect(() => {
    let isMounted = true

    fetch('/api/photos')
      .then((response) => response.ok ? response.json() as Promise<{ urls?: string[] }> : null)
      .then((data) => {
        if (!isMounted) return
        setPhotoUrls(data?.urls ?? [])
      })
      .catch(() => {
        if (isMounted) setPhotoUrls([])
      })
      .finally(() => {
        if (isMounted) setPhotosLoaded(true)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const handleSelectNode = (node: any) => {
    setActiveNode(node)
    setRevealPhase('memory')
  }

  const effectivePhotoUrls = photosLoaded ? photoUrls : []

  const memoryPhotoSrc = activeNode && effectivePhotoUrls.length
    ? effectivePhotoUrls[activeNode.idx % effectivePhotoUrls.length]
    : ''

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#F5F8FA', position: 'relative', overflow: 'hidden', fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif', WebkitUserSelect: 'none', userSelect: 'none' }}>
      
      <audio
        src="https://jonas-1387333607.cos.ap-shanghai.myqcloud.com/snowfall.mp3"
        autoPlay
        loop
        style={{ display: 'none' }}
      />

      <header style={{ position: 'absolute', top: 0, left: 0, width: '100%', padding: '40px 5vw', zIndex: 100, display: 'flex', justifyContent: 'flex-start', pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto', opacity: activeNode ? 0 : 1, transition: 'opacity 0.5s' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h1 style={{ margin: 0, fontSize: 'clamp(26px, 3.4vw, 40px)', fontWeight: 500, color: '#334155', letterSpacing: '4px', textAlign: 'center', lineHeight: '1.0' }}>
              {SITE_CONFIG.zh.mainTitle}
              <br />
              <span style={{ display: 'inline-block', marginTop: '-14px', fontSize: 'clamp(13px, 1.4vw, 18px)', fontWeight: 400, color: '#7C8CA0', letterSpacing: '1.5px' }}>
                {SITE_CONFIG.en.mainTitle}
              </span>
            </h1>
            <p style={{ margin: '6px 0 0 0', fontSize: 'clamp(14px, 2vw, 22px)', color: '#5F7F99', letterSpacing: '3px', textAlign: 'center' }}>
              {SITE_CONFIG.zh.subTitle}
            </p>
            <p style={{ margin: '2px 0 0 0', fontSize: 'clamp(11px, 1.3vw, 15px)', color: '#7C8CA0', letterSpacing: '1.5px', textAlign: 'center' }}>
              {SITE_CONFIG.en.subTitle}
            </p>
          </div>
        </div>
      </header>

      {/* 🎨 沉浸式敘事浮層 */}
      {activeNode && (
        <div
          style={{ position: 'absolute', inset: 0, zIndex: 110, background: 'radial-gradient(circle at center, rgba(245,248,250,0.5) 0%, rgba(245,248,250,0.98) 70%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeInOverlay 1s ease forwards' }}
          onClick={() => {
            if (revealPhase === 'memory') handleRevealDesign()
          }}
        >
          <button onClick={(e) => { e.stopPropagation(); setActiveNode(null) }} style={{ position: 'absolute', top: '50px', left: '5vw', background: 'none', border: 'none', color: '#5F7F99', fontSize: '14px', cursor: 'pointer', letterSpacing: '2px', zIndex: 120 }}>
            {config.backBtn}
          </button>

          {/* ================= 階段 1：高精密清透粒子藝術影像 ================= */}
          {revealPhase === 'memory' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', textAlign: 'center', animation: 'slowFadeIn 1.5s ease-out forwards' }}>
              
              <h3 style={{ fontSize: '24px', fontWeight: 300, color: '#5F7F99', letterSpacing: '8px', marginBottom: '40px', textShadow: '0 0 10px rgba(255,255,255,0.8)' }}>
                {activeNode.entry}
              </h3>
              
              {/* 粒子影像物理渲染區 */}
              <div style={{ position: 'relative', width: '80%', height: '360px', marginBottom: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TouchDesignerParticleImage 
                  src={memoryPhotoSrc} 
                  onTranslated={() => setRevealPhase('design')}
                />
              </div>

              <p style={{ color: '#8DA5B7', fontSize: '15px', lineHeight: '2.2', letterSpacing: '1px', padding: '0 10%' }}>
                {typedPastMemory}
              </p>
              
              <div style={{ marginTop: '42px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '999px',
                    border: '1.5px solid rgba(255,255,255,0.9)',
                    boxShadow: '0 0 0 0 rgba(255,255,255,0.8)',
                    animation: 'breathingRing 2.4s ease-out infinite',
                    background: 'radial-gradient(circle at center, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 60%)',
                  }}
                />
                <div style={{ fontSize: '12px', color: '#6FA8C9', letterSpacing: '4px', animation: 'pulseText 2s infinite' }}>
                  [ {config.clickHint} ]
                </div>
              </div>
            </div>
          )}

          {/* ================= 階段 2：空間装置重构 ================= */}
          {revealPhase === 'design' && (
            <div style={{ display: 'flex', width: '90%', maxWidth: '1110px', height: '75vh', alignItems: 'center', justifyContent: 'space-between', animation: 'shatterReveal 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
              
              <div style={{ flex: '1', paddingRight: '60px', display: 'flex', flexDirection: 'column', gap: '40px' }}>
                <div style={{ animation: 'staggerSlideUp 0.8s ease-out 0.1s both' }}>
                  <h2 style={{ margin: '0 0 12px 0', fontSize: '48px', fontWeight: 300, color: '#334155', letterSpacing: '4px' }}>
                    {activeNode.formalName}
                  </h2>
                  <div style={{ fontSize: '14px', color: '#8DA5B7', letterSpacing: '2px' }}>{activeNode.entry}</div>
                </div>

                <div style={{ position: 'relative', borderLeft: '1px solid rgba(111, 168, 201, 0.3)', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
                  <section style={{ animation: 'staggerSlideUp 0.8s ease-out 0.3s both' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#8DA5B7', fontSize: '12px', fontWeight: 600, letterSpacing: '1px' }}>{config.cardLabels.childBehavior}</h4>
                    <p style={{ margin: 0, color: '#5F7F99', fontSize: '15px', lineHeight: '1.8' }}>{typedChildBehavior}</p>
                  </section>
                  <section style={{ animation: 'staggerSlideUp 0.8s ease-out 0.4s both' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#8DA5B7', fontSize: '12px', fontWeight: 600, letterSpacing: '1px' }}>{config.cardLabels.spatialTranslation}</h4>
                    <p style={{ margin: 0, color: '#5F7F99', fontSize: '15px', lineHeight: '1.8' }}>{typedSpatialTranslation}</p>
                  </section>
                  <section style={{ animation: 'staggerSlideUp 0.8s ease-out 0.5s both' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#6FA8C9', fontSize: '12px', fontWeight: 600, letterSpacing: '1px' }}>{config.cardLabels.interaction}</h4>
                    <p style={{ margin: 0, color: '#5F7F99', fontSize: '15px', lineHeight: '1.8' }}>
                      {typedInteraction}
                    </p>
                  </section>
                </div>
              </div>

              <div style={{ flex: '1.2', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'staggerSlideUp 1.5s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both' }}>
                <img src={`https://jonas-1387333607.cos.ap-shanghai.myqcloud.com/${activeNode.slug}.png`} alt={activeNode.formalName} style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: 'drop-shadow(0 30px 50px rgba(111,168,201,0.2))', animation: 'imageFloat 8s infinite ease-in-out' }} onError={(e) => { e.currentTarget.style.opacity='0' }} />
              </div>

            </div>
          )}
        </div>
      )}

      {/* 3D 社区主画布 */}
      <Canvas dpr={[1, 2]} camera={{ position: [0, 20, 28], fov: 40 }}>
        <Suspense fallback={<Html center><div style={{ color: '#6FA8C9' }}>載入空間記憶中...</div></Html>}>
          <GlobalFogEnv />
          <CommunityParticleTextCore isFocusMode={mode === 'focus'} />
          <MemoryPhotoRing isFocusMode={mode === 'focus'} photoUrls={effectivePhotoUrls} />
          <MemoryNodeOuterRing isFocusMode={mode === 'focus'}>
            {nodes.map((node) => (
              <MemoryNode key={node.slug} data={node} isActive={activeNode?.slug === node.slug} isFocusMode={mode === 'focus'} onSelect={(e: any) => { e.stopPropagation(); handleSelectNode(node); }} />
            ))}
          </MemoryNodeOuterRing>
          <CameraManager activeNode={activeNode} />
        </Suspense>
        <OrbitControls makeDefault enableZoom={true} enablePan={false} maxPolarAngle={Math.PI / 2.1} minPolarAngle={Math.PI / 6} rotateSpeed={0.3} />
        <EffectComposer enableNormalPass={false}><Noise opacity={0.03} /></EffectComposer>
      </Canvas>

      <style>{`
        @keyframes fadeInOverlay { from { opacity: 0; backdrop-filter: blur(0px); } to { opacity: 1; backdrop-filter: blur(20px); } }
        @keyframes slowFadeIn { from { opacity: 0; transform: scale(0.95); filter: blur(5px); } to { opacity: 1; transform: scale(1); filter: blur(0); } }
        @keyframes pulseText { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes shatterReveal { 0% { opacity: 0; transform: scale(1.05) translateY(15px); filter: blur(10px); } 100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); } }
        @keyframes staggerSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes imageFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes particleDissolve { 0% { opacity: 0; filter: blur(8px); transform: translateY(10px); } 20%, 70% { opacity: 1; filter: blur(0px); transform: translateY(0); } 100% { opacity: 0; filter: blur(12px); transform: translateY(-15px); } }
        @keyframes breathingRing {
          0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.8); opacity: 0.7; }
          50% { box-shadow: 0 0 0 14px rgba(255,255,255,0); opacity: 1; }
          100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}