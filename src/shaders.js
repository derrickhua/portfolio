export const heightmapFragmentShader = `
#include <common>

uniform vec2 mousePos;
uniform float mouseSize;
uniform float viscosityConstant;
uniform float heightCompensation;
uniform float BOUNDS;


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

export const smoothFragmentShader = `

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
`;
export const readWaterLevelFragmentShader = `
uniform vec2 point1;
uniform float WIDTH;
uniform float BOUNDS;
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
`;
export const waterVertexShader= `
uniform sampler2D heightmap;
uniform float WIDTH;
uniform float BOUNDS;

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
    vec2 cellSize = vec2(1.0 / WIDTH, 1.0 / WIDTH);

    #include <uv_vertex>
    #include <color_vertex>

    // Compute normal from heightmap
    vec3 objectNormal = vec3(
        (texture2D(heightmap, uv + vec2(-cellSize.x, 0)).x - texture2D(heightmap, uv + vec2(cellSize.x, 0)).x) * WIDTH / BOUNDS,
        (texture2D(heightmap, uv + vec2(0, -cellSize.y)).x - texture2D(heightmap, uv + vec2(0, cellSize.y)).x) * WIDTH / BOUNDS,
        1.0
    );

    #include <morphnormal_vertex>
    #include <skinbase_vertex>
    #include <skinnormal_vertex>
    #include <defaultnormal_vertex>

    #ifndef FLAT_SHADED
        vNormal = normalize(transformedNormal);
    #endif

    float heightValue = texture2D(heightmap, uv).x;
    vec3 transformed = vec3(position.x, position.y, heightValue);

    #include <morphtarget_vertex>
    #include <skinning_vertex>
    #include <displacementmap_vertex>
    #include <project_vertex>
    #include <logdepthbuf_vertex>
    #include <clipping_planes_vertex>

    vViewPosition = -mvPosition.xyz;

    #include <worldpos_vertex>
    #include <envmap_vertex>
    #include <shadowmap_vertex>
}
`;