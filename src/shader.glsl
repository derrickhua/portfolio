// Vertex Shader
uniform float time;
uniform vec2 mouse;
uniform float aspect;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec3 pos = position;

  // Calculate distance to mouse position
  float distance = distance(vec2(pos.x/aspect, pos.y), mouse);

  // Create a simple sine wave effect based on distance and time
  pos.z += sin(distance * 10.0 - time * 5.0) * 0.1;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos,1.0);
}

// Fragment Shader
varying vec2 vUv;

void main() {
  gl_FragColor = vec4(vec3(0.1, 0.2, 0.5) * (1.0 - vUv.y), 1.0);
}
