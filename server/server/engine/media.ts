/**
 * Zero-token media helpers ported from v2. They only build descriptors the UI renders
 * (procedural 3D meshes, an image URL); no model call is made for them.
 */
export interface Model3D {
  id: string;
  title: string;
  shape: 'cube' | 'sphere' | 'torus' | 'cylinder' | 'pyramid' | 'cybernode' | 'knot';
  textureType: 'neon' | 'gold' | 'cyberpunk' | 'marble' | 'metallic' | 'hologram' | 'crystal';
  color: string;
  wireframe: boolean;
  autoRotate: boolean;
  prompt: string;
}

export function model3dFromPrompt(prompt: string): Model3D {
  const p = prompt.toLowerCase();
  let shape: Model3D['shape'] = 'knot';
  if (/sphere|planet|orb|ball/.test(p)) shape = 'sphere';
  else if (/cube|box/.test(p)) shape = 'cube';
  else if (/torus|donut|ring/.test(p)) shape = 'torus';
  else if (/cylinder/.test(p)) shape = 'cylinder';
  else if (/pyramid|cone/.test(p)) shape = 'pyramid';
  else if (/cyber|node|crystal/.test(p)) shape = 'cybernode';

  let textureType: Model3D['textureType'] = 'cyberpunk';
  if (/gold|yellow/.test(p)) textureType = 'gold';
  else if (/neon|glow/.test(p)) textureType = 'neon';
  else if (/hologram|glass/.test(p)) textureType = 'hologram';
  else if (/marble/.test(p)) textureType = 'marble';
  else if (/metal|chrome/.test(p)) textureType = 'metallic';
  else if (/crystal|prism/.test(p)) textureType = 'crystal';

  let color = '#6366f1';
  if (/\bred\b/.test(p)) color = '#ef4444';
  else if (/emerald|green/.test(p)) color = '#10b981';
  else if (/amber|gold/.test(p)) color = '#f59e0b';
  else if (/cyan|blue/.test(p)) color = '#06b6d4';
  else if (/pink|purple/.test(p)) color = '#ec4899';

  return {
    id: `3d_${Date.now()}`,
    title: `${textureType.toUpperCase()} 3D ${shape.toUpperCase()}`,
    shape,
    textureType,
    color,
    wireframe: /wireframe/.test(p),
    autoRotate: true,
    prompt: prompt || '3D Procedural Mesh',
  };
}

export function imageFromPrompt(prompt: string) {
  const clean = prompt.replace(/generate image|create image|draw a|draw|picture of|photo of/gi, '').trim();
  const encoded = encodeURIComponent(clean || 'futuristic glowing hyperrealistic artwork');
  return [
    {
      id: `img_${Date.now()}`,
      url: `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=768&seed=${Date.now()}&nologo=true`,
      prompt: clean || prompt,
      aspectRatio: '16:9',
    },
  ];
}
