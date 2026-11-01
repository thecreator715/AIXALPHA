import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Model3DData } from '../types';
import {
  RotateCw,
  Eye,
  Maximize2,
  Minimize2,
  Download,
  Box,
  Sparkles,
  Layers,
  Palette,
  Sun,
} from 'lucide-react';

interface Model3DViewerProps {
  data: Model3DData;
}

export const Model3DViewer: React.FC<Model3DViewerProps> = ({ data }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [wireframe, setWireframe] = useState<boolean>(data.wireframe ?? false);
  const [autoRotate, setAutoRotate] = useState<boolean>(data.autoRotate ?? true);
  const [color, setColor] = useState<string>(data.color || '#6366f1');
  const [textureType, setTextureType] = useState<Model3DData['textureType']>(
    data.textureType || 'cyberpunk'
  );
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [stats, setStats] = useState({ vertices: 0, faces: 0 });

  const sceneRef = useRef<THREE.Scene | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const materialRef = useRef<THREE.Material | null>(null);

  // Setup Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 360;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030712'); // Slate 950
    sceneRef.current = scene;

    // Add subtle grid helper
    const gridHelper = new THREE.GridHelper(20, 20, 0x4f46e5, 0x1e293b);
    gridHelper.position.y = -2;
    scene.add(gridHelper);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 1, 5.5);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(5, 10, 7);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const pointLight = new THREE.PointLight(0x818cf8, 2, 10);
    pointLight.position.set(-3, 2, 3);
    scene.add(pointLight);

    const pointLight2 = new THREE.PointLight(0x06b6d4, 2, 10);
    pointLight2.position.set(3, -2, -3);
    scene.add(pointLight2);

    // 5. Create Geometry
    let geometry: THREE.BufferGeometry;

    switch (data.shape) {
      case 'sphere':
        geometry = new THREE.SphereGeometry(1.4, 32, 32);
        break;
      case 'torus':
        geometry = new THREE.TorusGeometry(1.2, 0.45, 24, 64);
        break;
      case 'knot':
        geometry = new THREE.TorusKnotGeometry(1.1, 0.35, 100, 16);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(1, 1, 2.2, 32);
        break;
      case 'pyramid':
        geometry = new THREE.ConeGeometry(1.4, 2.2, 4);
        break;
      case 'cybernode':
        geometry = new THREE.IcosahedronGeometry(1.4, 1);
        break;
      case 'cube':
      default:
        geometry = new THREE.BoxGeometry(2, 2, 2);
        break;
    }

    // Geometry stats
    const posAttr = geometry.attributes.position;
    if (posAttr) {
      setStats({
        vertices: posAttr.count,
        faces: geometry.index ? geometry.index.count / 3 : posAttr.count / 3,
      });
    }

    // 6. Create Material based on textureType
    const material = createMaterial(textureType, color, wireframe);
    materialRef.current = material;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshRef.current = mesh;
    scene.add(mesh);

    // 7. Mouse Orbit interaction
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging || !meshRef.current) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      meshRef.current.rotation.y += deltaX * 0.01;
      meshRef.current.rotation.x += deltaY * 0.01;

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const domCanvas = renderer.domElement;
    domCanvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // 8. Animation loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (meshRef.current && autoRotate && !isDragging) {
        meshRef.current.rotation.y += 0.008;
        meshRef.current.rotation.x += 0.003;
      }

      renderer.render(scene, camera);
    };
    animate();

    // 9. Resize Observer
    const handleResize = () => {
      if (!container || !rendererRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      domCanvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      resizeObserver.disconnect();
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [data.shape]);

  // Update material when color, wireframe, or textureType changes
  useEffect(() => {
    if (!meshRef.current) return;
    const newMaterial = createMaterial(textureType, color, wireframe);
    if (materialRef.current) {
      materialRef.current.dispose();
    }
    meshRef.current.material = newMaterial;
    materialRef.current = newMaterial;
  }, [color, wireframe, textureType]);

  // Helper to generate textures dynamically
  const createMaterial = (type: Model3DData['textureType'], baseColor: string, isWire: boolean) => {
    const col = new THREE.Color(baseColor);

    switch (type) {
      case 'gold':
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color('#fbbf24'),
          metalness: 0.95,
          roughness: 0.15,
          wireframe: isWire,
        });
      case 'neon':
        return new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 0.8,
          wireframe: isWire,
          roughness: 0.2,
        });
      case 'hologram':
        return new THREE.MeshPhysicalMaterial({
          color: col,
          transparent: true,
          opacity: 0.75,
          transmission: 0.8,
          roughness: 0.1,
          wireframe: isWire,
          clearcoat: 1.0,
          clearcoatRoughness: 0.1,
        });
      case 'marble':
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color('#f8fafc'),
          roughness: 0.1,
          metalness: 0.1,
          wireframe: isWire,
        });
      case 'metallic':
        return new THREE.MeshStandardMaterial({
          color: col,
          metalness: 0.9,
          roughness: 0.2,
          wireframe: isWire,
        });
      case 'crystal':
        return new THREE.MeshPhysicalMaterial({
          color: col,
          roughness: 0.05,
          transmission: 0.9,
          thickness: 1.2,
          wireframe: isWire,
        });
      case 'cyberpunk':
      default:
        return new THREE.MeshStandardMaterial({
          color: col,
          metalness: 0.8,
          roughness: 0.2,
          wireframe: isWire,
        });
    }
  };

  const handleDownloadSnapshot = () => {
    if (!rendererRef.current) return;
    const link = document.createElement('a');
    link.download = `3d-model-${data.shape}-${Date.now()}.png`;
    link.href = rendererRef.current.domElement.toDataURL('image/png');
    link.click();
  };

  return (
    <div
      className={`rounded-2xl border border-indigo-500/30 bg-slate-950 overflow-hidden shadow-2xl transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 flex flex-col bg-slate-950' : 'w-full my-3'
      }`}
    >
      {/* 3D Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Box className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-100 flex items-center gap-2">
              <span>{data.title || `3D ${data.shape.toUpperCase()} Model`}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
                Interactive WebGL
              </span>
            </h4>
            <p className="text-[10px] text-slate-400 truncate max-w-xs">{data.prompt}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setWireframe(!wireframe)}
            className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
              wireframe
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="Toggle Wireframe"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Wireframe</span>
          </button>

          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
              autoRotate
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="Toggle Auto Rotation"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Rotate</span>
          </button>

          <button
            onClick={handleDownloadSnapshot}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
            title="Download Snapshot PNG"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Mount */}
      <div className="relative flex-1">
        <div ref={mountRef} className="w-full h-[360px] cursor-grab active:cursor-grabbing" />

        {/* Overlay Controls */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 backdrop-blur-md p-2.5 rounded-xl border border-slate-800 text-xs text-slate-300">
          {/* Material Textures selector */}
          <div className="flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] text-slate-400 font-medium">Texture:</span>
            <div className="flex gap-1">
              {(['cyberpunk', 'gold', 'neon', 'hologram', 'marble', 'crystal'] as const).map(
                (mat) => (
                  <button
                    key={mat}
                    onClick={() => setTextureType(mat)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize transition-all ${
                      textureType === mat
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mat}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Color Picker & Polycount */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400">Color:</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
              />
            </div>

            <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-slate-400">
              <span>Verts: {stats.vertices}</span>
              <span>•</span>
              <span>Faces: {stats.faces}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
