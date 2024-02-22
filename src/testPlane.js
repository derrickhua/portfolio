import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module';
import { GPUComputationRenderer } from './GPUComputationRenderer.js';
import {SimplexNoise} from './SimplexNoise.js'
import { heightmapFragmentShader, smoothFragmentShader, readWaterLevelFragmentShader, waterVertexShader } from './shaders.js';

const WaterSimulation = () => {
  // This ref will be used to attach the renderer's canvas to the DOM.
  const mountRef = React.useRef(null);
  const simplex = new SimplexNoise();
  const [mouseCoords, setMouseCoords] = useState({ x: 0, y: 0 });
  const fillTexture = (texture) => {
    const data = texture.image.data;
    const width = texture.image.width;
    const height = texture.image.height;

    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        const x = i / width;
        const y = j / height;
        const noise = simplex.noise(x * 10, y * 10); // Adjust noise scale as necessary
        const value = (noise + 1) / 2; // Normalize noise value to [0, 1]

        const index = (i + j * width) * 4; // Each pixel consists of 4 values (RGBA)
        data[index + 0] = value * 255; // R
        data[index + 1] = value * 255; // G
        data[index + 2] = value * 255; // B
        data[index + 3] = 255; // A
      }
    }
  };


  useEffect(() => {
    const handleMouseMove = (event) => {
      if (mountRef.current) {
        const rect = mountRef.current.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        // Normalize to [-1, 1] for both axes
        setMouseCoords({ x: x * 2 - 1, y: - (y * 2 - 1) });
      }
    };
  
    const currentElement = mountRef.current;
    currentElement.addEventListener('mousemove', handleMouseMove);
  
    // Cleanup
    return () => {
      currentElement.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  useEffect(() => {
    // Setup scene, camera, and renderer
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
  
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 1, 1000);
    camera.position.set(0, 0, 350);
    camera.lookAt(0, 0, 0);
    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040); // soft white light
    scene.add(ambientLight);
  
    const sun = new THREE.DirectionalLight(0xFFFFFF, 3.0);
    sun.position.set(300, 400, 175);
    scene.add(sun);
  
    const sun2 = new THREE.DirectionalLight(0x40A040, 2.0);
    sun2.position.set(-100, 350, -200);
    scene.add(sun2);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(width, height);
    mountRef.current.appendChild(renderer.domElement); // Attach renderer to the DOM via ref
  
    // GPUComputationRenderer setup
    let gpuCompute;
    let heightmapVariable;
    let waterMaterial; // Define waterMaterial at a scope accessible by updateWater

    const w = 512;

    const animate = () => {
      requestAnimationFrame(animate);
      if (heightmapVariable) {
        heightmapVariable.material.uniforms.mousePos.value.x = mouseCoords.x;
        heightmapVariable.material.uniforms.mousePos.value.y = mouseCoords.y;
      }
      // GPU computation and rendering logic
      if (gpuCompute) {
        gpuCompute.compute();
        updateWater(); // Make sure this updates the water material's 'heightmap' uniform
      }
      renderer.render(scene, camera);
  

    };

    // Adapted from your GPU computation setup
    const initGPUComputation = () => {
      gpuCompute = new GPUComputationRenderer(w, w, renderer);
    
      if (!renderer.capabilities.isWebGL2) {
        gpuCompute.setDataType(THREE.HalfFloatType);
      }
    
      // Create initial state textures
      const heightmap0 = gpuCompute.createTexture();
      fillTexture(heightmap0); // Fill the texture with initial data
    
      // Add variables for heightmap computation and smoothing
      heightmapVariable = gpuCompute.addVariable("heightmap", heightmapFragmentShader, heightmap0);
      const smoothVariable = gpuCompute.addVariable("smoothTexture", smoothFragmentShader, heightmap0);
    
      // Set dependencies
      gpuCompute.setVariableDependencies(heightmapVariable, [heightmapVariable, smoothVariable]);
      gpuCompute.setVariableDependencies(smoothVariable, [heightmapVariable, smoothVariable]);
    
      // Add custom uniforms
      heightmapVariable.material.uniforms.mousePos = { value: new THREE.Vector2(0, 0) };
      heightmapVariable.material.uniforms.mouseSize = { value: 20.0 };
      heightmapVariable.material.uniforms.viscosityConstant = { value: 0.98 };
      heightmapVariable.material.uniforms.heightCompensation = { value: 0 };
    
      // Check for initialization errors
      const error = gpuCompute.init();
      if (error !== null) {
          console.error(error);
      }
    
      // Create the water surface mesh using the computation renderer's output
      const waterGeometry = new THREE.PlaneGeometry(500, 500, 128, 128); // Adjust as necessary
      waterMaterial = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([
            THREE.ShaderLib['phong'].uniforms,
            {
                heightmap: { value: null },
                WIDTH: { value: 128.0 }, // Set your actual WIDTH here
                BOUNDS: { value: 512.0 } // Set your actual BOUNDS here
            }
        ]),
        vertexShader: waterVertexShader,
        fragmentShader: THREE.ShaderChunk['meshphong_frag'],
        lights: true,
        wireframe: false
      });
      const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
      scene.add(waterMesh);
    
      animate()
    };

    const updateWater = () => {
      if (waterMaterial && gpuCompute && heightmapVariable) {
        waterMaterial.uniforms['heightmap'].value = gpuCompute.getCurrentRenderTarget(heightmapVariable).texture;
      }
    };

    // Initialize GPU Computation
    initGPUComputation();
  

  


  const cleanupThreeJs = (scene) => {
    scene.traverse((object) => {
      if (!object.isMesh) return;
  
      if (object.geometry) {
        object.geometry.dispose();
      }
  
      if (object.material) {
        if (object.material.length) {
          // For multi-materials
          for (const material of object.material) {
            if (material.map) material.map.dispose();
            material.dispose();
          }
        } else {
          // For single materials
          if (object.material.map) object.material.map.dispose();
          object.material.dispose();
        }
      }
    });
  };

  
    
    return () => {
      cleanupThreeJs(scene);
      renderer.dispose();
      // Additional cleanup as needed
    };
  }, []); // Empty dependency array means this effect runs once on mount and cleanup on unmount

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
};

export default WaterSimulation;