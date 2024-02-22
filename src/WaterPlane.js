import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { GPUComputationRenderer } from './GPUComputationRenderer.js';
import { SimplexNoise } from './SimplexNoise.js';

// Shaders 
let heightmapFragmentShader = `
    #include <common>

    uniform vec2 mousePos;
    uniform float mouseSize;
    uniform float viscosityConstant;
    uniform float heightCompensation;

    void main()	{

        vec2 cellSize = 1.0 / resolution.xy;

        vec2 uv = gl_FragCoord.xy * cellSize;

        // heightmapValue.x == height from previous frame
        // heightmapValue.y == height from penultimate frame
        // heightmapValue.z, heightmapValue.w not used
        vec4 heightmapValue = texture2D( heightmap, uv );

        // Get neighbours
        vec4 north = texture2D( heightmap, uv + vec2( 0.0, cellSize.y ) );
        vec4 south = texture2D( heightmap, uv + vec2( 0.0, - cellSize.y ) );
        vec4 east = texture2D( heightmap, uv + vec2( cellSize.x, 0.0 ) );
        vec4 west = texture2D( heightmap, uv + vec2( - cellSize.x, 0.0 ) );

        // https://web.archive.org/web/20080618181901/http://freespace.virgin.net/hugo.elias/graphics/x_water.htm

        float newHeight = ( ( north.x + south.x + east.x + west.x ) * 0.5 - heightmapValue.y ) * viscosityConstant;

        // Mouse influence
        float mousePhase = clamp( length( ( uv - vec2( 0.5 ) ) * BOUNDS - vec2( mousePos.x, - mousePos.y ) ) * PI / mouseSize, 0.0, PI );
        newHeight += ( cos( mousePhase ) + 1.0 ) * 0.28;

        heightmapValue.y = heightmapValue.x;
        heightmapValue.x = newHeight;

        gl_FragColor = heightmapValue;

    }
`;

let smoothFragmentShader = `
    uniform sampler2D smoothTexture;

    void main()	{

        vec2 cellSize = 1.0 / resolution.xy;

        vec2 uv = gl_FragCoord.xy * cellSize;

        // Computes the mean of texel and 4 neighbours
        vec4 textureValue = texture2D( smoothTexture, uv );
        textureValue += texture2D( smoothTexture, uv + vec2( 0.0, cellSize.y ) );
        textureValue += texture2D( smoothTexture, uv + vec2( 0.0, - cellSize.y ) );
        textureValue += texture2D( smoothTexture, uv + vec2( cellSize.x, 0.0 ) );
        textureValue += texture2D( smoothTexture, uv + vec2( - cellSize.x, 0.0 ) );

        textureValue /= 5.0;

        gl_FragColor = textureValue;

    }
`

let readWaterLevelFragmentShader = `
    uniform vec2 point1;

    uniform sampler2D levelTexture;

    // Integer to float conversion from https://stackoverflow.com/questions/17981163/webgl-read-pixels-from-floating-point-render-target

    float shift_right( float v, float amt ) {

        v = floor( v ) + 0.5;
        return floor( v / exp2( amt ) );

    }

    float shift_left( float v, float amt ) {

        return floor( v * exp2( amt ) + 0.5 );

    }

    float mask_last( float v, float bits ) {

        return mod( v, shift_left( 1.0, bits ) );

    }

    float extract_bits( float num, float from, float to ) {

        from = floor( from + 0.5 ); to = floor( to + 0.5 );
        return mask_last( shift_right( num, from ), to - from );

    }

    vec4 encode_float( float val ) {
        if ( val == 0.0 ) return vec4( 0, 0, 0, 0 );
        float sign = val > 0.0 ? 0.0 : 1.0;
        val = abs( val );
        float exponent = floor( log2( val ) );
        float biased_exponent = exponent + 127.0;
        float fraction = ( ( val / exp2( exponent ) ) - 1.0 ) * 8388608.0;
        float t = biased_exponent / 2.0;
        float last_bit_of_biased_exponent = fract( t ) * 2.0;
        float remaining_bits_of_biased_exponent = floor( t );
        float byte4 = extract_bits( fraction, 0.0, 8.0 ) / 255.0;
        float byte3 = extract_bits( fraction, 8.0, 16.0 ) / 255.0;
        float byte2 = ( last_bit_of_biased_exponent * 128.0 + extract_bits( fraction, 16.0, 23.0 ) ) / 255.0;
        float byte1 = ( sign * 128.0 + remaining_bits_of_biased_exponent ) / 255.0;
        return vec4( byte4, byte3, byte2, byte1 );
    }

    void main()	{

        vec2 cellSize = 1.0 / resolution.xy;

        float waterLevel = texture2D( levelTexture, point1 ).x;

        vec2 normal = vec2(
            ( texture2D( levelTexture, point1 + vec2( - cellSize.x, 0 ) ).x - texture2D( levelTexture, point1 + vec2( cellSize.x, 0 ) ).x ) * WIDTH / BOUNDS,
            ( texture2D( levelTexture, point1 + vec2( 0, - cellSize.y ) ).x - texture2D( levelTexture, point1 + vec2( 0, cellSize.y ) ).x ) * WIDTH / BOUNDS );

        if ( gl_FragCoord.x < 1.5 ) {

            gl_FragColor = encode_float( waterLevel );

        } else if ( gl_FragCoord.x < 2.5 ) {

            gl_FragColor = encode_float( normal.x );

        } else if ( gl_FragCoord.x < 3.5 ) {

            gl_FragColor = encode_float( normal.y );

        } else {

            gl_FragColor = encode_float( 0.0 );

        }

    }
`

let waterVertexShader=`
    uniform sampler2D heightmap;

    #define PHONG

    varying vec3 vViewPosition;

    #ifndef FLAT_SHADED

        varying vec3 vNormal;

    #endif

    #include <common>
    #include <uv_pars_vertex>
    #include <displacementmap_pars_vertex>
    #include <envmap_pars_vertex>
    #include <color_pars_vertex>
    #include <morphtarget_pars_vertex>
    #include <skinning_pars_vertex>
    #include <shadowmap_pars_vertex>
    #include <logdepthbuf_pars_vertex>
    #include <clipping_planes_pars_vertex>

    void main() {

        vec2 cellSize = vec2( 1.0 / WIDTH, 1.0 / WIDTH );

        #include <uv_vertex>
        #include <color_vertex>

        // # include <beginnormal_vertex>
        // Compute normal from heightmap
        vec3 objectNormal = vec3(
            ( texture2D( heightmap, uv + vec2( - cellSize.x, 0 ) ).x - texture2D( heightmap, uv + vec2( cellSize.x, 0 ) ).x ) * WIDTH / BOUNDS,
            ( texture2D( heightmap, uv + vec2( 0, - cellSize.y ) ).x - texture2D( heightmap, uv + vec2( 0, cellSize.y ) ).x ) * WIDTH / BOUNDS,
            1.0 );
        //<beginnormal_vertex>

        #include <morphnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <defaultnormal_vertex>

    #ifndef FLAT_SHADED // Normal computed with derivatives when FLAT_SHADED

        vNormal = normalize( transformedNormal );

    #endif

        //# include <begin_vertex>
        float heightValue = texture2D( heightmap, uv ).x;
        vec3 transformed = vec3( position.x, position.y, heightValue );
        //<begin_vertex>

        #include <morphtarget_vertex>
        #include <skinning_vertex>
        #include <displacementmap_vertex>
        #include <project_vertex>
        #include <logdepthbuf_vertex>
        #include <clipping_planes_vertex>

        vViewPosition = - mvPosition.xyz;

        #include <worldpos_vertex>
        #include <envmap_vertex>
        #include <shadowmap_vertex>

    }
`
// Texture width for simulation
const WIDTH = 512+256+128;

// Water size in system units
const BOUNDS = 512+256+256;
const BOUNDS_HALF = BOUNDS * 0.5;

const WaterSimulation = () => {
    const containerRef = useRef(null);
    const materialColor = 0xFCF5E5

    useEffect(() => {
        let container, stats;
        let camera, scene, renderer;
        let mouseMoved = false;
        const mouseCoords = new THREE.Vector2();
        const raycaster = new THREE.Raycaster();
        
        let waterMesh;
        let meshRay;
        let gpuCompute;
        let heightmapVariable;
        let waterUniforms;
        let smoothShader;
        let readWaterLevelShader;
        let readWaterLevelRenderTarget;
        let readWaterLevelImage;
        let planeWidth, planeHeight;
        let size = new THREE.Vector2(); 
        let renderObject;
        const waterNormal = new THREE.Vector3();
        const simplex = new SimplexNoise();

        function init() {
            container = document.createElement( 'div' );
            document.body.appendChild( container );
    
            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 3000);
            camera.position.set(0, 500, 0); // Position the camera 500 units above the center of the plane
            camera.lookAt(0, 0, 0); // Make the camera look directly at the center of the plane
    
            scene = new THREE.Scene();
    
            const sun = new THREE.DirectionalLight( 0xFFFFFF, 3.0 );
            sun.position.set( 300, 400, 175 );
            scene.add( sun );
    
            const sun2 = new THREE.DirectionalLight( 0x40A040, 2.0 );
            sun2.position.set( - 100, 350, - 200 );
            scene.add( sun2 );
    
            renderer = new THREE.WebGLRenderer();
            renderer.setPixelRatio( window.devicePixelRatio );
            renderer.setSize( window.innerWidth, window.innerHeight );
            container.appendChild(renderer.domElement);
            renderer.domElement.style.width = '100%';
            renderer.domElement.style.height = '100%';
            renderer.domElement.style.opacity = '0.8'; // Making the canvas slightly transparent
            renderer.domElement.style.position = 'absolute';
            renderer.domElement.style.top = '0';
            renderer.domElement.style.left = '0';
            renderer.domElement.style.zIndex = '-1'; // Behind other content
            renderObject = renderer;
            size = renderer.getSize(size)
            const aspectRatio = size.x / size.y;
            planeWidth = BOUNDS * aspectRatio;
            planeHeight = BOUNDS;
            // CSS for the container
            container.style.position = 'fixed'; // Cover the entire viewport
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.zIndex = '-1'; // Ensure the container is also behind
    
            container.style.touchAction = 'none';
            container.addEventListener( 'mousemove', onPointerMove );
            container.id = 'three-container'; // Assign an ID to the container

            renderer.domElement.id = 'three-canvas'; // Assign an ID to the canvas
    
            window.addEventListener( 'resize', onWindowResize );
    
            const effectController = {
                mouseSize: 20.0,
                viscosity: 0.98,
            };
    
            const valuesChanger = function () {
    
                heightmapVariable.material.uniforms[ 'mouseSize' ].value = effectController.mouseSize;
                heightmapVariable.material.uniforms[ 'viscosityConstant' ].value = effectController.viscosity;
    
            };
    

            initWater();
    
            valuesChanger();
    
        }

        function initWater() {

    
            const geometry = new THREE.PlaneGeometry( planeWidth, planeHeight, WIDTH - 1, WIDTH - 1 );
    
            // material: make a THREE.ShaderMaterial clone of THREE.MeshPhongMaterial, with customized vertex shader
            const material = new THREE.ShaderMaterial( {
                uniforms: THREE.UniformsUtils.merge( [
                    THREE.ShaderLib[ 'phong' ].uniforms,
                    {
                        'heightmap': { value: null }
                    }
                ] ),
                vertexShader: `${waterVertexShader}`,
                fragmentShader: THREE.ShaderChunk[ 'meshphong_frag' ],
            } );
    
            material.lights = true;
    
            // Material attributes from THREE.MeshPhongMaterial
            // Sets the uniforms with the material values
            material.uniforms[ 'diffuse' ].value = new THREE.Color( materialColor );
            material.uniforms[ 'specular' ].value = new THREE.Color( 0x111111 );
            material.uniforms[ 'shininess' ].value = Math.max( 50, 1e-4 );
            material.uniforms[ 'opacity' ].value = material.opacity;
    
            // Defines
            material.defines.WIDTH = WIDTH.toFixed( 1 );
            material.defines.BOUNDS = BOUNDS.toFixed( 1 );
    
            waterUniforms = material.uniforms;
    
            waterMesh = new THREE.Mesh( geometry, material );
            waterMesh.rotation.x = - Math.PI / 2;
            waterMesh.matrixAutoUpdate = false;
            waterMesh.updateMatrix();
    
            scene.add( waterMesh );
    
            // THREE.Mesh just for mouse raycasting
            const geometryRay = new THREE.PlaneGeometry( BOUNDS, BOUNDS, 1, 1 );
            meshRay = new THREE.Mesh( geometryRay, new THREE.MeshBasicMaterial( { color: 0xFFFFFF, visible: false } ) );
            meshRay.rotation.x = - Math.PI / 2;
            meshRay.matrixAutoUpdate = false;
            meshRay.updateMatrix();
            scene.add( meshRay );
    
    
            // Creates the gpu computation class and sets it up
    
            gpuCompute = new GPUComputationRenderer( WIDTH, WIDTH, renderer );
    
            if ( renderer.capabilities.isWebGL2 === false ) {
    
                gpuCompute.setDataType( THREE.HalfFloatType );
    
            }
            const heightmap0 = gpuCompute.createTexture();

            fillTexture( heightmap0 );
    
            heightmapVariable = gpuCompute.addVariable( 'heightmap', `${heightmapFragmentShader}`, heightmap0 );
    
            gpuCompute.setVariableDependencies( heightmapVariable, [ heightmapVariable ] );
    
            heightmapVariable.material.uniforms[ 'mousePos' ] = { value: new THREE.Vector2( 10000, 10000 ) };
            heightmapVariable.material.uniforms[ 'mouseSize' ] = { value: 20.0 };
            heightmapVariable.material.uniforms[ 'viscosityConstant' ] = { value: 0.98 };
            heightmapVariable.material.uniforms[ 'heightCompensation' ] = { value: 0 };
            heightmapVariable.material.defines.BOUNDS = BOUNDS.toFixed( 1 );
    
            const error = gpuCompute.init();
            if ( error !== null ) {
    
                console.error( error );
    
            }
    
            // Create compute shader to smooth the water surface and velocity
            smoothShader = gpuCompute.createShaderMaterial( `${smoothFragmentShader}`, { smoothTexture: { value: null } } );
    
            // Create compute shader to read water level
            readWaterLevelShader = gpuCompute.createShaderMaterial( `${readWaterLevelFragmentShader}`, {
                point1: { value: new THREE.Vector2() },
                levelTexture: { value: null }
            } );
            readWaterLevelShader.defines.WIDTH = WIDTH.toFixed( 1 );
            readWaterLevelShader.defines.BOUNDS = BOUNDS.toFixed( 1 );
    
            // Create a 4x1 pixel image and a render target (Uint8, 4 channels, 1 byte per channel) to read water height and orientation
            readWaterLevelImage = new Uint8Array( 4 * 1 * 4 );
    
            readWaterLevelRenderTarget = new THREE.WebGLRenderTarget( 4, 1, {
                wrapS: THREE.ClampToEdgeWrapping,
                wrapT: THREE.ClampToEdgeWrapping,
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
                format: THREE.RGBAFormat,
                type: THREE.UnsignedByteType,
                depthBuffer: false
            } );
    
        }
        function fillTexture( texture ) {

            const waterMaxHeight = 10;
    
            function noise( x, y ) {
    
                let multR = waterMaxHeight;
                let mult = 0.025;
                let r = 0;
                for ( let i = 0; i < 15; i ++ ) {
    
                    r += multR * simplex.noise( x * mult, y * mult );
                    multR *= 0.53 + 0.025 * i;
                    mult *= 1.25;
    
                }
    
                return r;
    
            }
    
            const pixels = texture.image.data;
    
            let p = 0;
            for ( let j = 0; j < WIDTH; j ++ ) {
    
                for ( let i = 0; i < WIDTH; i ++ ) {
    
                    const x = i * 128 / WIDTH;
                    const y = j * 128 / WIDTH;
    
                    pixels[ p + 0 ] = noise( x, y );
                    pixels[ p + 1 ] = pixels[ p + 0 ];
                    pixels[ p + 2 ] = 0;
                    pixels[ p + 3 ] = 1;
    
                    p += 4;
    
                }
    
            }
    
        }

        function smoothWater() {

            const currentRenderTarget = gpuCompute.getCurrentRenderTarget( heightmapVariable );
            const alternateRenderTarget = gpuCompute.getAlternateRenderTarget( heightmapVariable );
    
            for ( let i = 0; i < 10; i ++ ) {
    
                smoothShader.uniforms[ 'smoothTexture' ].value = currentRenderTarget.texture;
                gpuCompute.doRenderTarget( smoothShader, alternateRenderTarget );
    
                smoothShader.uniforms[ 'smoothTexture' ].value = alternateRenderTarget.texture;
                gpuCompute.doRenderTarget( smoothShader, currentRenderTarget );
    
            }
    
        }

        function updateWaterPlane() {
            // Remove the old water mesh from the scene
            if (waterMesh) {
                scene.remove(waterMesh);
            }
            
            let newSize = new THREE.Vector2();
            renderObject.getSize(newSize);
            const aspRatio = newSize.x / newSize.y;
            let newWidth = BOUNDS * aspRatio;
            let newHeight = BOUNDS;
            
           
    
            const geometry = new THREE.PlaneGeometry( newWidth, newHeight , WIDTH - 1, WIDTH - 1 );
                const materialx = new THREE.ShaderMaterial( {
                uniforms: THREE.UniformsUtils.merge( [
                    THREE.ShaderLib[ 'phong' ].uniforms,
                    {
                        'heightmap': { value: null }
                    }
                ] ),
                vertexShader: `${waterVertexShader}`,
                fragmentShader: THREE.ShaderChunk[ 'meshphong_frag' ]
    
            } );
    
            materialx.lights = true;
    
            // Material attributes from THREE.MeshPhongMaterial
            // Sets the uniforms with the material values
            materialx.uniforms[ 'diffuse' ].value = new THREE.Color( materialColor );
            materialx.uniforms[ 'specular' ].value = new THREE.Color( 0x111111 );
            materialx.uniforms[ 'shininess' ].value = Math.max( 50, 1e-4 );
            materialx.uniforms[ 'opacity' ].value = materialx.opacity;
    
            // Defines
            materialx.defines.WIDTH = WIDTH.toFixed( 1 );
            materialx.defines.BOUNDS = BOUNDS.toFixed( 1 );
    
            waterUniforms = materialx.uniforms;
    
            waterMesh = new THREE.Mesh( geometry, materialx );
            waterMesh.rotation.x = - Math.PI / 2;
            waterMesh.matrixAutoUpdate = false;
            waterMesh.updateMatrix();
    
            scene.add( waterMesh );
        }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            updateWaterPlane();
        }

        function setMouseCoords( x, y ) {
        
            mouseCoords.set( ( x / renderer.domElement.clientWidth ) * 2 - 1, - ( y / renderer.domElement.clientHeight ) * 2 + 1 );
            mouseMoved = true;
        
        }
        
        function onPointerMove( event ) {
        
            if ( event.isPrimary === false ) return;
        
            setMouseCoords( event.clientX, event.clientY );
        
        }
        
        function animate() {
        
            requestAnimationFrame( animate );
        
            render();
        
        }

        function render() {

            // Set uniforms: mouse interaction
            const uniforms = heightmapVariable.material.uniforms;
            if ( mouseMoved ) {
    
                raycaster.setFromCamera( mouseCoords, camera );
    
                const intersects = raycaster.intersectObject( meshRay );
    
                if ( intersects.length > 0 ) {
    
                    const point = intersects[ 0 ].point;
                    uniforms[ 'mousePos' ].value.set( point.x, point.z );
    
                } else {
    
                    uniforms[ 'mousePos' ].value.set( 10000, 10000 );
    
                }
    
                mouseMoved = false;
    
            } else {
    
                uniforms[ 'mousePos' ].value.set( 10000, 10000 );
    
            }
    
            // Do the gpu computation
            gpuCompute.compute();
    
            // Get compute output in custom uniform
            waterUniforms[ 'heightmap' ].value = gpuCompute.getCurrentRenderTarget( heightmapVariable ).texture;
    
            // Render
            renderer.render( scene, camera );
    
        }
        init();
        animate();

        return () => {
            // Stop the animation loop, dispose Three.js objects, and remove the renderer from the DOM
            if (renderer) {
                container.removeChild(renderer.domElement);
            }
        };
    },[])

    return (
        <div ref={containerRef} className='hello' style={{ width: '100%', height: '100%'}}>
        </div>
    );
}

export default WaterSimulation;


