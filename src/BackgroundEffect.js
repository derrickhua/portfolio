import React, { useRef, useEffect } from 'react';
import { extend, Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sphere, shaderMaterial, Stats, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { SoftShadows } from '@react-three/drei';


const WaterShaderMaterial = shaderMaterial(
  { time: 0, mouse: new THREE.Vector2(0.5, 0.5), aspect: 1.0 },
  // Vertex shader
  `
  uniform float time;
  uniform vec2 mouse;
  uniform float aspect;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    float adjustedMouseX = mouse.x * 2.0 - 1.0;
    float adjustedMouseY = -(mouse.y * 2.0 - 1.0);
    float dx = pos.x - adjustedMouseX;
    float dy = (pos.y - adjustedMouseY) * aspect;
    float distance = sqrt(dx * dx + dy * dy);
    pos.z += exp(-distance * 4.0) * sin(distance * 10.0 - time * 5.0) * 0.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }`,
  // Fragment shader
  `
  varying vec2 vUv;
  void main() {
    vec3 baseColor = vec3(0.502, 0.502, 0.502);
    gl_FragColor = vec4(baseColor, 1.0);
  }`
);

extend({ WaterShaderMaterial });

function RipplePlane() {
    const meshRef = useRef();
    const { size, viewport } = useThree();
    const aspect = size.width / size.height;
    
    useFrame(({ clock, mouse }) => {
      meshRef.current.material.uniforms.time.value = clock.getElapsedTime();
      meshRef.current.material.uniforms.mouse.value.set(mouse.x, mouse.y);
      meshRef.current.material.uniforms.aspect.value = aspect;
    });
  
    return (
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <planeGeometry args={[viewport.width /2, viewport.height/2, 150, 150]} />
        <waterShaderMaterial />
      </mesh>
    );
  }
  
  function FloatingSphere() {
    const sphereRef = useRef();
    const { viewport } = useThree();
  
    useFrame(({ pointer }) => {
      if (sphereRef.current) {
        // Convert pointer coordinates (normalized device coordinates, NDC) to 3D world space
        const x = pointer.x * viewport.width / 2;
        const y = pointer.y * viewport.height / 2;
        sphereRef.current.position.set(x, y, 0); // Adjust Z based on your scene's requirements
      }
    });
  
    return (
        <Sphere ref={sphereRef} visible args={[0.5, 32, 32]} castShadow>
            <meshStandardMaterial color="#ff1050" />
        </Sphere>
    );
}
  
  function Scene() {
    return (
      <>
        <ambientLight intensity={0.8} />
        <spotLight position={[10, 15, 10]} angle={0.3} />
        <RipplePlane />
        <FloatingSphere />
      </>
    );
  }
  
  export default function BackgroundEffect() {
    return (
      <Canvas shadows camera={{ position: [0, 0, 5], fov: 60 }}>
        <SoftShadows />
        <Scene />
      </Canvas>
    );
  }