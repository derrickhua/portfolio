// import React, { useEffect, useState, useRef } from 'react';
// import * as THREE from 'three';
// import Stats from 'three/examples/jsm/libs/stats.module';
// import { GPUComputationRenderer } from './GPUComputationRenderer.js';
// import {SimplexNoise} from './SimplexNoise.js'
// import { smoothFragmentShader, readWaterLevelFragmentShader, waterVertexShader } from './shaders.js';

// let heightmapFragmentShader = `
// #include <common>

// uniform vec2 resolution;
// uniform float mouseSize;
// uniform float viscosityConstant;
// uniform float heightCompensation;
// uniform float BOUNDS;
// uniform vec2 mousePos; // Assuming mousePos is already defined as a vec2(x, y)
// uniform sampler2D heightmap;

// void main()	{

//   vec2 cellSize = 1.0 / resolution.xy;

//   vec2 uv = gl_FragCoord.xy * cellSize;

//   // heightmapValue.x == height from previous frame
//   // heightmapValue.y == height from penultimate frame
//   // heightmapValue.z, heightmapValue.w not used
//   vec4 heightmapValue = texture( heightmap, uv );

//   // Get neighbours
//   vec4 north = texture2D( heightmap, uv + vec2( 0.0, cellSize.y ) );
//   vec4 south = texture2D( heightmap, uv + vec2( 0.0, - cellSize.y ) );
//   vec4 east = texture2D( heightmap, uv + vec2( cellSize.x, 0.0 ) );
//   vec4 west = texture2D( heightmap, uv + vec2( - cellSize.x, 0.0 ) );

//   // https://web.archive.org/web/20080618181901/http://freespace.virgin.net/hugo.elias/graphics/x_water.htm

//   float newHeight = ( ( north.x + south.x + east.x + west.x ) * 0.5 - heightmapValue.y ) * viscosityConstant;

//   // Mouse influence
//   float mousePhase = clamp( length( ( uv - vec2( 0.5 ) ) * BOUNDS - vec2( mousePos.x, - mousePos.y ) ) * PI / mouseSize, 0.0, PI );
//   newHeight += ( cos( mousePhase ) + 1.0 ) * 0.28;

//   heightmapValue.y = heightmapValue.x;
//   heightmapValue.x = newHeight;

//   gl_FragColor = heightmapValue;

// }
// `;

// const WaterSimulation = ({mousePosition}) => {
//   // This ref will be used to attach the renderer's canvas to the DOM.
//   const mountRef = useRef(null);
//   const gpuComputeRef = useRef(null);
//   const heightmapVariableRef = useRef(null);
//   const waterMaterialRef = useRef(null);
//   const simplex = new SimplexNoise();
//   const fillTexture = (texture) => {
//     const data = texture.image.data;
//     const width = texture.image.width;
//     const height = texture.image.height;

//     for (let j = 0; j < height; j++) {
//       for (let i = 0; i < width; i++) {
//         const x = i / width;
//         const y = j / height;
//         const noise = simplex.noise(x * 10, y * 10); // Adjust noise scale as necessary
//         const value = (noise + 1) / 2; // Normalize noise value to [0, 1]

//         const index = (i + j * width) * 4; // Each pixel consists of 4 values (RGBA)
//         data[index + 0] = value * 255; // R
//         data[index + 1] = value * 255; // G
//         data[index + 2] = value * 255; // B
//         data[index + 3] = 255; // A
//       }
//     }
//   };


//   useEffect(() => {
//     // Setup scene, camera, and renderer
//     const width = mountRef.current.clientWidth;
//     const height = mountRef.current.clientHeight;
  
//     const scene = new THREE.Scene();
//     const camera = new THREE.PerspectiveCamera(75, width / height, 1, 1000);
//     camera.position.set(0, 0, 350);
//     camera.lookAt(0, 0, 0);
//     // Lighting
//     const ambientLight = new THREE.AmbientLight(0x404040); // soft white light
//     scene.add(ambientLight);
  
//     const sun = new THREE.DirectionalLight(0xFFFFFF, 4.0);
//     sun.position.set(300, 400, 175);
//     scene.add(sun);
  
//     const sun2 = new THREE.DirectionalLight(0x40A040, 6.0);
//     sun2.position.set(-100, 350, -200);
//     scene.add(sun2);
//     const renderer = new THREE.WebGLRenderer();
//     renderer.setSize(width, height);
//     mountRef.current.appendChild(renderer.domElement); // Attach renderer to the DOM via ref
  
    
//     const w = 512;

//     // Adapted from your GPU computation setup
//     const initGPUComputation = () => {
//       gpuComputeRef.current = new GPUComputationRenderer(w, w, renderer);
    
//       if (!renderer.capabilities.isWebGL2) {
//         gpuComputeRef.current.setDataType(THREE.HalfFloatType);
//       }
    
//       // Create initial state textures
//       const heightmap0 = gpuComputeRef.current.createTexture();
//       fillTexture(heightmap0); // Fill the texture with initial data
    
//       // Add variables for heightmap computation and smoothing
//       heightmapVariableRef.current = gpuComputeRef.current.addVariable("heightmap", heightmapFragmentShader, heightmap0);
//       const smoothVariable = gpuComputeRef.current.addVariable("smoothTexture", smoothFragmentShader, heightmap0);
    
//       // Set dependencies
//       gpuComputeRef.current.setVariableDependencies(heightmapVariableRef.current, [heightmapVariableRef.current, smoothVariable]);
//       gpuComputeRef.current.setVariableDependencies(smoothVariable, [heightmapVariableRef.current, smoothVariable]);

//       heightmapVariableRef.current.material.uniforms.mousePos = { value: new THREE.Vector2(0.5, 0.5) };
//       heightmapVariableRef.current.material.uniforms.mouseSize = { value: 30.0 };
//       heightmapVariableRef.current.material.uniforms.viscosityConstant = { value: 0.99 };
//       heightmapVariableRef.current.material.uniforms.heightCompensation = { value: 0.5 };
    
//       // const waterGeometry = new THREE.PlaneGeometry(500, 500, 64, 64); // Adjust as necessary
      
//       // waterMaterialRef.current = new THREE.ShaderMaterial({
//       //   uniforms: THREE.UniformsUtils.merge([
//       //     THREE.ShaderLib['phong'].uniforms,
//       //     {
//       //       mousePos: { value: new THREE.Vector2(0.5, 0.5) },
//       //       heightmap: { value: null },
//       //       WIDTH: { value: 128.0 }, // Set your actual WIDTH here
//       //       BOUNDS: { value: 512.0 } // Set your actual BOUNDS here
//       //     }
//       //   ]),
//       //   vertexShader: waterVertexShader,
//       //   fragmentShader: THREE.ShaderChunk['meshphong_frag'],
//       //   lights: true,
//       //   wireframe: false
//       // });
      

//       // const waterMesh = new THREE.Mesh(waterGeometry, waterMaterialRef.current);
//       // scene.add(waterMesh);

//       const geometry = new THREE.PlaneGeometry(500, 500);
//       const material = new THREE.ShaderMaterial({
//           uniforms: {
//             resolution: { value: new THREE.Vector2(w, w) },
//             heightmap: { value: null },
//             WIDTH: { value: 128.0 }, // Set your actual WIDTH here
//             BOUNDS: { value: 512.0 } // Set your actual BOUNDS here
//               // Make sure to define any other required uniforms, including `resolution` if used in your shader
//           },
//           vertexShader: waterVertexShader,
//           fragmentShader: heightmapFragmentShader,
//       });
//       const mesh = new THREE.Mesh(geometry, material);
//       scene.add(mesh);
//     };

    
//     const updateWater = () => {
//       // Update the 'heightmap' uniform with the latest computed texture
//       if (waterMaterialRef.current && heightmapVariableRef.current) {
//         // console.log(gpuComputeRef.current.getCurrentRenderTarget(heightmapVariableRef.current).texture)
//           waterMaterialRef.current.uniforms.heightmap.value = gpuComputeRef.current.getCurrentRenderTarget(heightmapVariableRef.current).texture;
//       }
//   };
    
//     const animate = () => {
//       requestAnimationFrame(animate);
//       gpuComputeRef.current.compute(); // Perform GPU computations
//       updateWater(); // Update your water simulation with the computed texture
//       renderer.render(scene, camera); // Render the scene
//   };

//     initGPUComputation();
//     const error = gpuComputeRef.current.init();
//     if (error !== null) {
//         console.error('GPUComputationRenderer initialization error:', error);
//     } else {
//         animate(); // Only start the animation loop if there are no initialization errors
//     }

//     const cleanupThreeJs = (scene) => {
//       scene.traverse((object) => {
//         if (!object.isMesh) return;
    
//         if (object.geometry) {
//           object.geometry.dispose();
//         }
    
//         if (object.material) {
//           if (object.material.length) {
//             // For multi-materials
//             for (const material of object.material) {
//               if (material.map) material.map.dispose();
//               material.dispose();
//             }
//           } else {
//             // For single materials
//             if (object.material.map) object.material.map.dispose();
//             object.material.dispose();
//           }
//         }
//       });
//     };


    
//     return () => {
//       cleanupThreeJs(scene);
//       renderer.dispose();
//     };
//   }, []); 

//   useEffect(() => {
//     if (heightmapVariableRef.current) {
//       // Size of the plane
//       const planeSize = 500; // Since your plane geometry is 500x500
//       // Since the plane is centered, we map [0, 1] mouse coordinates to [-planeSize/2, planeSize/2]
//       const planeX = (mousePosition.x * planeSize) - (planeSize / 2);
//       const planeY = ((1 - mousePosition.y) * planeSize) - (planeSize / 2); // Y is inverted
      
//       // Update shader uniforms
//       heightmapVariableRef.current.material.uniforms.mousePos.value.x = planeX;
//       heightmapVariableRef.current.material.uniforms.mousePos.value.y = planeY;
//     }
//   }, [mousePosition]);
//   return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
// };

// export default WaterSimulation;