'use client'

import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Stars, OrbitControls, Float } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useRef, useState, useEffect, useMemo } from 'react'

// 引入组件
import { BlackHole } from '@/components/BlackHole'
import { ShadowAvatar } from '@/components/ShadowAvatar'

const photos = ['/p1.jpg', '/p2.jpg', '/p3.jpg', '/p4.jpg', '/p5.jpg', '/p6.jpg']

// ===== 全局音量 =====
let globalAudioVolume = 0.0
let audioContext: AudioContext | null = null

const initAudio = async () => {
  if (audioContext && audioContext.state === 'running') return true
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    audioContext = new AudioCtx()
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 512
    const source = audioContext.createMediaStreamSource(stream)
    source.connect(analyser)
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    const updateVolume = () => {
      analyser.getByteFrequencyData(dataArray)
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
      const avg = sum / dataArray.length
      const targetVolume = Math.min(avg / 70.0, 1.2)
      globalAudioVolume += (targetVolume - globalAudioVolume) * 0.2
      requestAnimationFrame(updateVolume)
    }
    updateVolume()
    return true
  } catch (e: any) {
    console.error("Mic Error:", e)
    return false
  }
}

// ================= UI 组件 =================
function AudioWaveformHUD({ status, onStart }) {
  return (
    <div 
      onClick={status === 'idle' ? onStart : undefined}
      style={{
        cursor: status === 'idle' ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
        opacity: status === 'speaking' ? 0.5 : 1, transition: 'all 0.5s'
      }}
    >
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>
        {status === 'idle' && "点击开启对话"}
        {status === 'listening' && "正在聆听..."}
        {status === 'processing' && "意识上传中..."}
        {status === 'speaking' && "AI 回应中"}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '40px' }}>
        {status === 'idle' && <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'white', animation: 'breath 2s infinite ease-in-out', boxShadow: '0 0 10px rgba(255,255,255,0.5)' }} />}
        {status === 'listening' && [1,2,3,4,5].map(i => <div key={i} style={{ width: '4px', height: '20px', background: '#fff', borderRadius: '2px', animation: `wave 0.8s infinite ease-in-out ${i * 0.1}s` }} />)}
        {status === 'processing' && <div style={{ width: '24px', height: '24px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />}
        {status === 'speaking' && <div style={{ width: '30px', height: '2px', background: '#00ccff', borderRadius: '1px', boxShadow: '0 0 15px #00ccff' }} />}
      </div>
      <style>{`
        @keyframes breath { 0% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(1); opacity: 0.5; } }
        @keyframes wave { 0% { height: 5px; opacity: 0.5; } 50% { height: 30px; opacity: 1; } 100% { height: 5px; opacity: 0.5; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function VoiceOverlay({ activePhoto, onClose }) {
  const [status, setStatus] = useState('idle')
  const [aiText, setAiText] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  
  const callRealAI = async (text, role = 'user') => {
    if (!activePhoto) return
    const newMsg = { role, content: text }
    const newHistory = [...chatHistory, newMsg]
    setChatHistory(newHistory)
    setStatus('processing')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, photoUrl: activePhoto.url, history: newHistory }),
      })
      const data = await res.json()
      setAiText(data.reply)
      setChatHistory([...newHistory, { role: 'assistant', content: data.reply }])
      setStatus('speaking')
      setTimeout(() => setStatus('idle'), 4000)
    } catch (e) {
      setAiText('连接中断...')
      setStatus('idle')
    }
  }

  // ... 在 VoiceOverlay 组件内部 ...

  const startListening = async () => {
    // 1. 初始化音频权限
    const isAudioReady = await initAudio()
    if (!isAudioReady) return

    // 2. 检查浏览器支持
    // @ts-ignore
    const Recognition = window.webkitSpeechRecognition || window.SpeechRecognition
    if (!Recognition) {
      alert('您的浏览器不支持语音对话，请使用 Chrome。')
      return
    }

    const rec = new Recognition()
    rec.lang = 'zh-CN'
    rec.continuous = false // 关键：设为 false，说完一句自动停
    rec.interimResults = false // 关键：不返回临时结果，只返回最终结果

    // 3. 开启监听状态
    setStatus('listening')

    // --- [核心修复] 收到结果后的逻辑 ---
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      
      if (transcript && transcript.trim().length > 0) {
          console.log("听到了:", transcript)
          
          // A. 强制停止录音机
          rec.stop()
          
          // B. 强制切换 UI 状态为“思考中”
          setStatus('processing') 
          
          // C. 发送给 AI
          callRealAI(transcript, 'user')
      }
    }

    // 4. 错误处理
    rec.onerror = (e: any) => {
      console.error("语音识别错误:", e)
      // 如果是没听清(no-speech)，重置为待机
      setStatus('idle')
    }

    // 5. 结束处理
    rec.onend = () => {
      // 如果录音机停了，但状态还在 'listening' (说明没听到有效的话)，则重置回 idle
      // 如果状态已经是 'processing' (说明在 onresult 里已经切换了)，则保持不变
      setStatus((prev) => (prev === 'listening' ? 'idle' : prev))
    }

    rec.start()
  }

  if (!activePhoto) return null

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 10, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: '60px', pointerEvents: 'none' }}>
      
      <button onClick={onClose} style={{ position: 'absolute', top: '40px', right: '40px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '10px 24px', borderRadius: '30px', cursor: 'pointer', pointerEvents: 'auto', backdropFilter: 'blur(10px)', fontSize:'14px', letterSpacing:'1px' }}>
        ← 返回记忆星环
      </button>
      
      <div style={{ marginBottom: '40px', textAlign: 'center', minHeight: '80px', pointerEvents: 'auto', padding: '0 30px', maxWidth: '600px', transform: 'translateX(250px)' }}>
        {aiText && (
          <div style={{ color: '#fff', fontSize: '18px', lineHeight: '1.6', textShadow: '0 0 10px rgba(0,0,0,0.8)', background: 'rgba(0,0,0,0.6)', padding: '20px 30px', borderRadius: '16px', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.1)' }}>
            {aiText}
          </div>
        )}
      </div>
      <div style={{ pointerEvents: 'auto', transform: 'translateX(250px)' }}>
        <AudioWaveformHUD status={status} onStart={startListening} />
      </div>
    </div>
  )
} 
function UploadInterface({ setActivePhoto }) {
  const handleUploadClick = () => {
    const newPhotoUrl = '/p1.jpg'; 
    setActivePhoto({ url: newPhotoUrl, name: 'uploaded' });
  };
  return (
    <div style={{ position: 'absolute', top: '40px', left: '50%', transform: 'translateX(-50%)', zIndex: 5, pointerEvents: 'auto' }}>
      <button onClick={handleUploadClick} style={{ padding: '10px 24px', borderRadius: '30px', background: 'rgba(0, 0, 0, 0.3)', color: 'rgba(255, 255, 255, 0.9)', border: '1px solid rgba(255, 255, 255, 0.3)', backdropFilter: 'blur(10px)', cursor: 'pointer', display: 'flex', gap: '8px', animation: 'subtleGlow 3s infinite alternate ease-in-out' }}>
        <span style={{ fontSize: '16px', fontWeight: 'bold' }}>+</span> 上传新的记忆
      </button>
      <style>{`@keyframes subtleGlow { 0% { box-shadow: 0 0 5px rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); } 100% { box-shadow: 0 0 15px rgba(255,255,255,0.4); border-color: rgba(255,255,255,0.6); } }`}</style>
    </div>
  );
}
// ================= SHADERS =================
// 找到原来的 vertexShader，完整替换为下面这段代码
// 找到 vertexShader 变量，完全替换为：
const vertexShader = `
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uVolume; 
  uniform float uIsActive; 
  uniform float uIsFocused; // <--- 新增：是否处于专注模式 (0.0 或 1.0)

  varying vec2 vUv;
  varying float vBrightness;
  varying float vDissolve;

  float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); }
  float noise(vec2 st) {
      vec2 i = floor(st); vec2 f = fract(st);
      float a = random(i); float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0)); float d = random(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vUv = uv;
    vec4 color = texture2D(uTexture, uv);
    float brightness = (color.r + color.g + color.b) / 3.0;
    vBrightness = brightness;

    vec3 pos = position;
    
    // 基础呼吸
    float breath = sin(uTime * 1.5 + uv.x * 5.0) * 0.05; 
    
    // [优化] 专注模式下，减弱 Z 轴隆起，防止人脸变形
    float depthStrength = mix(2.5, 1.2, uIsFocused); 
    pos.z += brightness * depthStrength + breath;

    // 计算一个缓慢的漂浮噪波
float driftScale = 1.5;
float driftTime = uTime * 0.2;
float driftX = noise(vec2(pos.y * driftScale + driftTime, pos.z * driftScale)) * 0.5;
float driftY = noise(vec2(pos.x * driftScale - driftTime, pos.z * driftScale)) * 0.5;

// 核心控制：只有在非专注模式下 (1.0 - uIsFocused) 才应用这个漂浮
float floatFactor = (1.0 - uIsFocused) * (0.5 + brightness * 0.5);
pos.x += driftX * floatFactor;
pos.y += driftY * floatFactor;

    vDissolve = 0.0;

    // 声音响应
    if (uIsActive > 0.5 && uVolume > 0.06) {
        float distFromCenter = distance(uv, vec2(0.5));
        float edgeMask = smoothstep(0.05, 0.7, distFromCenter); 
        
        pos.z += uVolume * 1.5 * brightness;

        vec3 flowDir = vec3(
            noise(uv * 4.0 + uTime * 0.5) - 0.5, 
            noise(uv * 4.0 + uTime * 0.5 + 10.0) * 0.8 + 0.3, 
            noise(uv * 4.0 + uTime * 0.5 + 20.0) * 0.3
        );
        
        float cycle = fract(uTime * 0.3 + random(uv) * 5.0);
        float moveDist = cycle * (uVolume * 0.4) * (0.5 + edgeMask * 2.0) * (0.8 + brightness);
        
        pos += flowDir * moveDist;
        vDissolve = moveDist;
        
        float sizeFactor = mix(1.0, (1.0 - cycle * 0.5), edgeMask);
        gl_PointSize = (4.5 * brightness + 1.5) * sizeFactor * (30.0 / -modelViewMatrix[3].z);
    } else {
        // [核心优化] 专注模式下，粒子变小(0.6倍)，显得更细腻
        float fineTune = mix(1.0, 2.0, uIsFocused); 
        gl_PointSize = (4.0 * brightness + 2.0) * fineTune * (30.0 / -modelViewMatrix[3].z); 
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`

// 找到原来的 fragmentShader，完整替换为下面这段代码
const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uSaturation;

  varying vec2 vUv;
  varying float vBrightness;
  varying float vDissolve;
  varying vec3 vWorldPos;

  void main() {
    vec4 color = texture2D(uTexture, vUv);

    // 剔除太暗的粒子，让背景更干净
    if (vBrightness < 0.05) discard;

    // --- 核心改动：柔焦光晕质感 ---
    // 计算像素到点中心的距离 (0.0 到 0.5)
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);

    // 1. 创建柔和的光晕 alpha (中心为1，边缘为0)
    // 使用 smoothstep 和 pow 创造一个非线性的、类似高斯的光晕衰减
    float glowAlpha = smoothstep(0.5, 0.0, dist); // 基础柔边
    glowAlpha = pow(glowAlpha, 2.5); // 让衰减更陡峭，中心更亮，边缘更柔

    // 2. 颜色处理 (保持不变)
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 finalColor = mix(vec3(gray), color.rgb, uSaturation);
    
    // 3. 最终合成：提高整体亮度，让光晕叠加产生过曝感
    // 如果有溶解效果，降低 alpha
    float finalAlpha = glowAlpha * (1.0 - vDissolve);
    
    // * 2.5 提高亮度，制造发光感
    gl_FragColor = vec4(finalColor * 0.5, finalAlpha);
  }
`

// ================= 3D 组件 (CinematicPhoto) =================
// 找到 CinematicPhoto 组件，完整替换为：
// ================= 3D 组件 (CinematicPhoto - 旋转修复版) =================
function CinematicPhoto({ url, position, rotation, onClick, isActive, mode }) {
  const texture = useLoader(THREE.TextureLoader, url)
  const materialRef = useRef<any>()
  const groupRef = useRef<THREE.Group>(null)
  
  const isFocusMode = mode === 'focus'
  const isTarget = isActive
  // 没选中的时候显示，选中时如果是自己也显示
  const isVisible = isFocusMode ? isTarget : true

  const uniforms = useMemo(() => ({
      uTexture: { value: texture },
      uTime: { value: 0 },
      uSaturation: { value: 0.7 }, 
      uVolume: { value: 0.0 }, 
      uIsActive: { value: 0.0 },
      uIsFocused: { value: 0.0 },
  }), [texture])

  useFrame((state, delta) => {
    // 1. 更新 Shader Uniforms
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime()
      const audioActive = isFocusMode && isTarget
      materialRef.current.uniforms.uVolume.value = audioActive ? globalAudioVolume : 0.0
      materialRef.current.uniforms.uIsActive.value = audioActive ? 1.0 : 0.0
      materialRef.current.uniforms.uIsFocused.value = THREE.MathUtils.lerp(materialRef.current.uniforms.uIsFocused.value, (isFocusMode && isTarget) ? 1.0 : 0.0, 0.1)
    }

    if (!groupRef.current) return

    // 2. 位置与动画逻辑
    if (isFocusMode && isTarget) {
        // --- 专注模式：飞到屏幕左侧 ---
        
        // A. 定义目标世界坐标 (屏幕左侧 -4, 正对 Z=28)
        const targetWorldPos = new THREE.Vector3(-3, 0, 28)
        
        // B. 【关键】将世界坐标转换为父容器内的局部坐标
        // 这样无论父容器(MemoryRing)转到哪里，照片都会准确飞到镜头前的这个点
        if (groupRef.current.parent) {
            groupRef.current.parent.worldToLocal(targetWorldPos)
        }

        // C. 移动位置
        groupRef.current.position.lerp(targetWorldPos, 3 * delta)
        
        // D. 旋转：始终面向摄像机 (解决旋转导致的朝向错误)
        // 先看摄像机
        groupRef.current.lookAt(state.camera.position)
        // 再微调一点角度 (修正透视)
        groupRef.current.rotateY(0.15) 

        // E. 缩放
        const s = THREE.MathUtils.lerp(groupRef.current.scale.x, 0.7, 3 * delta)
        groupRef.current.scale.set(s, s, s)

    } else {
        // --- 浏览模式：回到圆环 ---
        const originalPos = new THREE.Vector3(...position)
        const originalRot = new THREE.Euler(...rotation)

        groupRef.current.position.lerp(originalPos, 3 * delta)
        // 恢复原始旋转
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, originalRot.x, 3 * delta)
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, originalRot.y, 3 * delta)
        groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, originalRot.z, 3 * delta)
        
        const s = THREE.MathUtils.lerp(groupRef.current.scale.x, 1.0, 3 * delta)
        groupRef.current.scale.set(s, s, s)
    }
  })

  return (
    <group ref={groupRef} onClick={onClick} visible={isVisible}>
        <points>
          <planeGeometry args={[4, 5, 220, 220]} /> 
          <shaderMaterial 
            ref={materialRef} 
            vertexShader={vertexShader} 
            fragmentShader={fragmentShader} 
            uniforms={uniforms} 
            transparent 
            depthWrite={false} 
            blending={THREE.NormalBlending} 
          />
        </points>
        <mesh visible={false}><planeGeometry args={[4, 5]} /><meshBasicMaterial transparent opacity={0} /></mesh>
    </group>
  )
}

// ================= 相机复位器 =================
function CameraManager({ mode }) {
    const { camera, controls } = useThree()
    
    useFrame((state, delta) => {
        const orbit = controls as any
        if (!orbit) return
        const targetCamPos = new THREE.Vector3(0, 0, 35)
        if (mode === 'focus') {
            camera.position.lerp(targetCamPos, 2 * delta)
            orbit.target.lerp(new THREE.Vector3(0, 0, 0), 2 * delta)
            orbit.enableRotate = false 
        } else {
            orbit.enableRotate = true
        }
    })
    return null
}

// ================= 场景管理器 =================
function MemoryRing({ children, isActive }) {
  const groupRef = useRef(null)
  
  useFrame((state, delta) => {
    // 只有在"非专注"模式下才旋转
    if (groupRef.current && !isActive) {
      // ▼▼▼ 调节这里的 0.001 来改变旋转速度 ▼▼▼
      groupRef.current.rotation.y += 0.001
    }
  })

  return <group ref={groupRef}>{children}</group>
}

export default function Home() {
  const [activePhoto, setActivePhoto] = useState<{ url: string; name: string } | null>(null)
  const mode = activePhoto ? 'focus' : 'gallery'

  const handlePhotoClick = (e, url, name) => {
    e.stopPropagation()
    if (mode === 'gallery') {
        setActivePhoto({ url, name })
    }
  }

  // 【修复2】背景层：添加角度倾斜和呼吸动画
  const BackgroundLayer = () => {
      const group = useRef<THREE.Group>(null)
      useFrame((state, delta) => {
          if (!group.current) return
          const time = state.clock.getElapsedTime()

          // 目标位置 X
          const targetX = mode === 'focus' ? 12 : 0
          // 目标位置 Z，加入缓慢的呼吸波动 (范围在 -10 到 -8.5 之间)
          const targetZ = mode === 'focus' ? -5 + Math.sin(time * 0.5) * 1.5 : 0
          
          // 目标旋转 X：专注模式下稍微倾斜 0.2 弧度，避免看起来像一条线
          const targetRotX = mode === 'focus' ? 0.2 : 0
          
          // 平滑过渡
          group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, targetX, 2 * delta)
          group.current.position.z = THREE.MathUtils.lerp(group.current.position.z, targetZ, 2 * delta)
          group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetRotX, 2 * delta)
      })
      return (
          <group ref={group}>
              <BlackHole />
              <Stars radius={100} count={4000} factor={4} fade speed={0.3} opacity={0.5} />
          </group>
      )
  }

  // 宇航员
  const AvatarLayer = () => {
      const targetPos = mode === 'focus' 
          ? new THREE.Vector3(-7.5, -4, 28) 
          : null 
      
      return <ShadowAvatar targetPosition={targetPos} />
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', position: 'relative' }}>
      
      <VoiceOverlay activePhoto={activePhoto} onClose={() => setActivePhoto(null)} />
      {!activePhoto && <UploadInterface setActivePhoto={(data) => setActivePhoto({ url: data.url, name: 'uploaded' })} />}

      <Canvas camera={{ position: [0, 0, 35], fov: 50 }} gl={{ toneMapping: THREE.ACESFilmicToneMapping }}>
        <color attach="background" args={['#010101']} />
        <fog attach="fog" args={['#010101', 10, 80]} />
        
        <CameraManager mode={mode} />

        <BackgroundLayer />
        <MemoryRing isActive={!!activePhoto}>
        {photos.map((url, i) => {
          const angle = (i / photos.length) * Math.PI * 2
           const radius = 14 
           const x = Math.cos(angle) * radius
           const z = Math.sin(angle) * radius
           const y = Math.sin(angle * 3) * 2.5
           const rotY = -angle + Math.PI / 2 - Math.PI 
           const uniqueName = `photo-${i}`
           
           return (
             <CinematicPhoto 
               key={uniqueName} 
               name={uniqueName} 
               url={url} 
               position={[x, y, z]} 
               rotation={[0, rotY, 0]} 
               isActive={activePhoto?.name === uniqueName || activePhoto?.name === 'uploaded'}
               mode={mode}
               onClick={(e) => handlePhotoClick(e, url, uniqueName)}
             />
           )
         })}
      </MemoryRing>
         
         {activePhoto?.name === 'uploaded' && (
             <CinematicPhoto 
               key="uploaded"
               name="uploaded"
               url={activePhoto.url}
               position={[0, 0, 0]} 
               rotation={[0, 0, 0]}
               isActive={true}
               mode="focus"
               onClick={() => {}}
             />
         )}

        <AvatarLayer />

        <EffectComposer disableNormalPass>
          <Bloom luminanceThreshold={0.7} mipmapBlur intensity={0.6} radius={0.4} />
          <Noise opacity={0.1} />
          <Vignette eskil={false} offset={0.1} darkness={1.2} />
        </EffectComposer>

        <OrbitControls 
            makeDefault 
            enableZoom={false} 
            enablePan={false}
            maxPolarAngle={Math.PI / 1.8} 
            minPolarAngle={Math.PI / 2.5} 
            rotateSpeed={0.5}
        />
      </Canvas>
    </div>
  )
}