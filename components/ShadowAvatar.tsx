// src/components/ShadowAvatar.tsx
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function ShadowAvatar({ targetPosition }: { targetPosition: THREE.Vector3 | null }) {
  const group = useRef<THREE.Group>(null)
  const floatGroup = useRef<THREE.Group>(null)
  const currentPos = useRef(new THREE.Vector3(0, -5, 18)) 

  // 宇航员材质：白色自发光，像是在太空漫步
  const astronautMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.3,
    metalness: 0.2,
    emissive: "#aaaaaa", // 自发光
    emissiveIntensity: 0.5
  }), [])

  // 金色面罩材质
  const visorMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#ffcc00",
    roughness: 0.1,
    metalness: 0.9,
    emissive: "#ffcc00",
    emissiveIntensity: 0.2
  }), [])

  useFrame((state, delta) => {
    if (!group.current || !floatGroup.current) return
    
    const time = state.clock.getElapsedTime()

    // --- 1. 跟随移动逻辑 ---
    // 目标位置：照片前方，稍微偏左下一点，营造陪伴感
    const target = targetPosition 
      ? targetPosition.clone().add(new THREE.Vector3(-2, -2, 4)) 
      : new THREE.Vector3(0, -4, 18) // 待机位置

    currentPos.current.lerp(target, 2 * delta)
    group.current.position.copy(currentPos.current)
    
    // 面向目标
    if (targetPosition) {
        const lookAtPos = targetPosition.clone()
        lookAtPos.y = group.current.position.y // 保持水平视线
        group.current.lookAt(lookAtPos)
    } else {
        group.current.rotation.y = Math.sin(time * 0.5) * 0.3 // 待机时缓慢左右看
    }

    // --- 2. 失重漂浮动画 ---
    // 上下浮动
    floatGroup.current.position.y = Math.sin(time * 1.5) * 0.3;
    // 缓慢自转翻滚，增加失重感
    floatGroup.current.rotation.z = Math.sin(time * 0.8) * 0.15;
    floatGroup.current.rotation.x = Math.cos(time * 1.0) * 0.1;
  })

  return (
    <group ref={group}>
      {/* 内部漂浮组 */}
      <group ref={floatGroup} scale={[0.6, 0.6, 0.6]}>
        {/* 头盔 */}
        <mesh position={[0, 1.6, 0]} material={astronautMaterial}>
          <sphereGeometry args={[0.7, 32, 32]} />
        </mesh>
        {/* 面罩 */}
        <mesh position={[0, 1.6, 0.5]} material={visorMaterial}>
          <sphereGeometry args={[0.4, 32, 16, 0, Math.PI * 2, 0, Math.PI/2]} />
        </mesh>

        {/* 身体 */}
        <mesh position={[0, 0.6, 0]} material={astronautMaterial}>
          <capsuleGeometry args={[0.6, 0.8, 16, 16]} />
        </mesh>

        {/* 背包 (生命维持系统) */}
        <mesh position={[0, 0.8, -0.7]} material={astronautMaterial}>
          <boxGeometry args={[1.0, 1.2, 0.5]} />
        </mesh>

        {/* 左臂 */}
        <mesh position={[-0.8, 0.5, 0]} rotation={[0, 0, Math.PI / 3]} material={astronautMaterial}>
          <capsuleGeometry args={[0.25, 0.6, 16]} />
        </mesh>
        {/* 右臂 (稍微抬起打招呼) */}
        <mesh position={[0.8, 0.7, 0.2]} rotation={[-0.5, 0, -Math.PI / 2.5]} material={astronautMaterial}>
          <capsuleGeometry args={[0.25, 0.6, 16]} />
        </mesh>

        {/* 左腿 */}
        <mesh position={[-0.4, -0.8, 0]} material={astronautMaterial}>
          <capsuleGeometry args={[0.3, 0.8, 16]} />
        </mesh>
        {/* 右腿 (稍微弯曲) */}
        <mesh position={[0.4, -0.7, 0.3]} rotation={[0.5, 0, 0]} material={astronautMaterial}>
          <capsuleGeometry args={[0.3, 0.8, 16]} />
        </mesh>

        {/* 脚下的推进器光效 */}
        <pointLight position={[0, -1.5, 0]} distance={3} intensity={0.8} color="#00edff" />
      </group>
    </group>
  )
}