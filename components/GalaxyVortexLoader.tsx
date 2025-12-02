'use client'

import React, { useMemo, useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

// --- 着色器：彻底重构 --- 

const vertexShader = `
  uniform float uTime;
  uniform float uProgress;
  
  attribute vec3 aVelocity; // 每个粒子随机的弥散方向和速度

  varying float vLife;

  void main() {
    vec3 pos = position;
    
    // 阶段1: 呼吸、漂浮的3D星环
    float-child breathing = sin(uTime * 0.5 + pos.y * 0.5) * 0.5;
    pos.z += breathing;
    pos.x += sin(uTime * 0.3 + pos.z * 0.3) * 0.5;

    // 阶段2: 点击后，粒子向外、向镜头弥散
    float easeProgress = pow(uProgress, 2.0);
    pos += aVelocity * easeProgress * 25.0;

    vLife = 1.0 - easeProgress; // 粒子生命周期随弥散过程消逝

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // 粒子在弥散时变大，增强云雾感
    float finalSize = mix(0.5, 8.0, uProgress);
    gl_PointSize = finalSize * (300.0 / -mvPosition.z);

    gl_Position = projectionMatrix * mvPosition;
  }
`

const fragmentShader = `
  uniform float uProgress;
  varying float vLife;

  void main() {
    float dist = length(2.0 * gl_PointCoord - 1.0);
    if (dist > 1.0) discard;

    // 动态粒子形态：从锐利星点 -> 柔和云雾
    float sharpness = mix(10.0, 1.0, uProgress);
    float alpha = pow(1.0 - dist, sharpness);

    // 最终alpha，结合生命周期
    float finalAlpha = alpha * vLife;

    // 颜色在弥散时趋向于柔和的白色
    vec3 color = mix(vec3(0.1, 0.2, 0.5), vec3(0.8), uProgress);

    gl_FragColor = vec4(color, finalAlpha);
  }
`

const Particles = ({ isStarted, onAnimationEnd }) => {
  const shaderRef = useRef<THREE.ShaderMaterial>(null!)
  const startTimeRef = useRef(0)

  const particleData = useMemo(() => {
    const count = 50000; // 增加粒子密度
    const positions = new Float32Array(count * 3); 
    const velocities = new Float32Array(count * 3); // 储存每个粒子的弥散方向
    
    const ringRadius = 10; // 星环主半径
    const ringTubeRadius = 4.5; // 星环管壁半径

    for (let i = 0; i < count; i++) {
        // 1. 在一个立体的“甜甜圈”内生成粒子，创造真正的3D感
        const u = Math.random() * Math.PI * 2;
        const v = Math.random() * Math.PI * 2;
        const x = (ringRadius + ringTubeRadius * Math.cos(v)) * Math.cos(u);
        const y = ringTubeRadius * Math.sin(v);
        const z = (ringRadius + ringTubeRadius * Math.cos(v)) * Math.sin(u);
        positions.set([x, y, z], i * 3);

        // 2. 为每个粒子生成一个随机的、向外的弥散方向
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        ).normalize().multiplyScalar(Math.random() * 0.3 + 0.1);
        velocities.set(velocity.toArray(), i * 3);
    }
    return { positions, velocities };
  }, []);

  useFrame((state, delta) => {
    const { clock } = state;
    shaderRef.current.uniforms.uTime.value = clock.getElapsedTime();

    if (isStarted) {
      if (startTimeRef.current === 0) startTimeRef.current = clock.getElapsedTime();
      const animationTime = clock.getElapsedTime() - startTimeRef.current;
      const progress = Math.min(animationTime / 5.0, 1.0);
      shaderRef.current.uniforms.uProgress.value = progress;

      if (progress >= 1.0) {
        onAnimationEnd();
      }
    }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particleData.positions.length / 3} array={particleData.positions} itemSize={3} />
        <bufferAttribute attach="attributes-aVelocity" count={particleData.velocities.length / 3} array={particleData.velocities} itemSize={3} />
      </bufferGeometry>
      <shaderMaterial
        ref={shaderRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{ uTime: { value: 0 }, uProgress: { value: 0 } }}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent={true}
      />
    </points>
  );
};

const CameraAnimator = ({ isStarted }) => {
    useFrame((state, delta) => {
        const { camera, mouse, clock } = state;
        if (!isStarted) {
          const parallaxX = -mouse.x * 2.5;
          const parallaxY = -mouse.y * 2.5;
          camera.position.x += (parallaxX - camera.position.x) * 0.02;
          camera.position.y += (parallaxY - camera.position.y) * 0.02;
          camera.lookAt(0, 0, 0);
          return;
        }

        // 镜头缓慢前移，营造穿梭感
        camera.position.z += delta * 2.0;
    });
    return null;
}

export const GalaxyVortexLoader = ({ onLoaded }) => {
  const [isUiVisible, setIsUiVisible] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // 1. 组件加载后，渐显UI
  useEffect(() => {
    const timer = setTimeout(() => setIsUiVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // 2. 点击后，开始弥散动画
  const handleClick = () => {
    if (isStarted) return;
    setIsUiVisible(false);
    setTimeout(() => setIsStarted(true), 500); 
  };

  // 3. 弥散动画结束，触发淡出
  const handleAnimationEnd = () => {
      setIsFadingOut(true);
      // 在CSS淡出动画结束后，才真正调用onLoaded切换页面
      setTimeout(onLoaded, 1200);
  }

  return (
    <div 
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#000', zIndex: 9999, cursor: 'pointer', opacity: isFadingOut ? 0 : 1, transition: 'opacity 1s ease-out' }}
      onClick={handleClick}
    >
      {/* -- 呼吸感文字UI -- */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%', color: 'white', textAlign: 'center',
        opacity: isUiVisible ? 1 : 0,
        transform: `translate(-50%, ${isUiVisible ? '-50%' : '-40%'})`,
        transition: 'opacity 1.2s ease, transform 1.2s ease',
        animation: isUiVisible ? 'float 4s infinite ease-in-out' : 'none',
        pointerEvents: 'none',
      }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 300, letterSpacing: '0.1em' }}>欢迎你，小朋友</h1>
        <p style={{ fontSize: '1rem', marginTop: '1rem', letterSpacing: '0.05em', opacity: 0.8 }}>点击屏幕，开始探索</p>
      </div>

      <Canvas camera={{ position: [0, 0, 15], fov: 75 }}>
        <Particles isStarted={isStarted} onAnimationEnd={handleAnimationEnd} />
        <CameraAnimator isStarted={isStarted} />
        <EffectComposer>
            <Bloom intensity={0.2} luminanceThreshold={0.2} mipmapBlur radius={0.4} />
        </EffectComposer>
      </Canvas>

      {/* -- CSS 动画定义 -- */}
      <style>{`
        @keyframes float {
          0% { transform: translate(-50%, -50%); }
          50% { transform: translate(-50%, -52%); }
          100% { transform: translate(-50%, -50%); }
        }
      `}</style>
    </div>
  );
};
