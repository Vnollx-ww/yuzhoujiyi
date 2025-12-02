import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// --- 顶点着色器：控制粒子的位置和运动 ---
const particleVertex = `
  uniform float uTime;
  attribute float aScale;  // 每个粒子的随机大小
  attribute float aSpeed;  // 每个粒子的随机速度因子
  
  varying vec3 vPos;
  varying float vScale;

  void main() {
    vPos = position;
    vScale = aScale;

    // --- 1. 基础坐标计算 ---
    // 计算粒子当前距离中心的半径 (只看 XZ 平面)
    float r = length(position.xz);
    // 计算原始角度
    float angle = atan(position.z, position.x);

    // --- 2. 引力涡流动画的核心 ---
    // 关键：半径越小(越近中心)，旋转速度越快。
    // (4.0 / r) 制造了这种差异速度，再加上基础时间 uTime 和粒子的个性化速度 aSpeed
    float angleOffset = (4.0 / (r + 0.1)) * uTime * 0.3 * aSpeed;
    // 计算新的旋转后角度
    float newAngle = angle + angleOffset;

    // --- 3. 重构粒子位置 ---
    vec3 transformedPos = position;
    // 根据新角度重新计算 X 和 Z
    transformedPos.x = r * cos(newAngle);
    transformedPos.z = r * sin(newAngle);
    // Y 轴保持扁平，加入一点点基于时间和角度的波动，让盘面看起来在呼吸
    transformedPos.y += sin(r * 3.0 + newAngle * 2.0 + uTime) * 0.05;

    vec4 mvPosition = modelViewMatrix * vec4(transformedPos, 1.0);
    
    // --- 4. 粒子大小控制 ---
    // 基础大小 * 随机因子 * 距离衰减 (越远越小，增加透视感)
    gl_PointSize = 8.0 * aScale * (30.0 / -mvPosition.z);

    gl_Position = projectionMatrix * mvPosition;
  }
`

// --- 片元着色器：控制粒子的颜色和质感 ---
const particleFragment = `
  varying vec3 vPos;
  varying float vScale;

  void main() {
    // --- 1. 把方块粒子变成柔焦圆形 ---
    // 计算片元距离粒子中心的距离
    float dist = length(gl_PointCoord - vec2(0.5));
    // 超过 0.5 (圆半径) 的部分丢弃，形成圆形
    if (dist > 0.5) discard;

    // --- 2. 制造柔和的光晕边缘 ---
    // 越靠近中心越亮，边缘快速衰减
    float alpha = smoothstep(0.5, 0.1, dist);

    // --- 3. 高级感颜色渐变 ---
    float r = length(vPos.xz); // 获取原始半径

    // 核心区颜色：高亮的冷白金 (增加一点点蓝调更有科技感)
    vec3 colorCore = vec3(0.9, 0.95, 1.0);
    // 外围区颜色：深邃的宇宙尘埃灰蓝
    vec3 colorEdge = vec3(0.1, 0.2, 0.35);
    
    // 根据半径混合颜色：内圈亮，外圈暗
    // smoothstep 控制了颜色过渡的区域 (半径 2 到 13 之间过渡)
    vec3 finalColor = mix(colorCore, colorEdge, smoothstep(2.0, 13.0, r));
    
    // --- 4. 视界黑洞中心 ---
    // 如果半径小于 2.2，强制把透明度降为 0，挖出中间的黑洞
    float hole = smoothstep(2.0, 2.2, r);

    // 最终合成：颜色 * 柔焦透明度 * 黑洞遮罩 * 随机大小带来的亮度差异
    gl_FragColor = vec4(finalColor, alpha * hole * (0.5 + vScale * 0.5));
  }
`

export function BlackHole() {
  const pointsRef = useRef<THREE.Points>(null)
  const particleCount = 15000 // 粒子数量：1.5万，既保证效果又不至于太卡

  // --- 生成粒子数据 ---
  const { positions, scales, speeds } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3)
    const scales = new Float32Array(particleCount)
    const speeds = new Float32Array(particleCount)

    for (let i = 0; i < particleCount; i++) {
      // 1. 生成甜甜圈形状的随机分布
      // 半径在 2 到 14 之间
      const r = Math.random() * 12 + 2 
      const angle = Math.random() * Math.PI * 2
      
      // 2. 计算基础位置
      positions[i * 3] = r * Math.cos(angle)
      // Y 轴非常扁平，集中在中间，向两边散开
      positions[i * 3 + 1] = (Math.random() - 0.5) * 0.5 * (r / 14) 
      positions[i * 3 + 2] = r * Math.sin(angle)

      // 3. 随机属性
      scales[i] = Math.random() * 0.8 + 0.2 // 大小在 0.2~1.0 倍之间浮动
      speeds[i] = Math.random() * 0.5 + 0.7 // 速度在 0.7~1.2 倍之间浮动
    }
    return { positions, scales, speeds }
  }, [])

  useFrame((state) => {
    if (pointsRef.current) {
      // 更新时间 uniform，驱动 Vertex Shader 里的动画
      (pointsRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = state.clock.getElapsedTime()
    }
  })

  return (
    <points ref={pointsRef} position={[0, 0, 0]} renderOrder={-2}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particleCount} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-scale" count={particleCount} array={scales} itemSize={1} />
        <bufferAttribute attach="attributes-speed" count={particleCount} array={speeds} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={particleVertex}
        fragmentShader={particleFragment}
        uniforms={{ uTime: { value: 0 } }}
        transparent
        // 重要：使用 AdditiveBlending 让粒子叠加发光，产生能量感
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}