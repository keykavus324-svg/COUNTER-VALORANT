globalThis.window = { innerWidth:1280, innerHeight:720, devicePixelRatio:1, addEventListener(){}, removeEventListener(){} };
function ctx(){ const g={addColorStop(){}}; return new Proxy({canvas:{width:512,height:512},createLinearGradient:()=>g,createRadialGradient:()=>g,getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(Math.max(4,w*h*4))}),putImageData(){},measureText:()=>({width:10})},{get:(t,p)=>p in t?t[p]:()=>{},set:(t,p,v)=>{t[p]=v;return true;}}); }
globalThis.document = { createElement:(t)=>({width:512,height:512,style:{},getContext:()=>ctx()}), getElementById:()=>null, querySelector:()=>null, addEventListener(){}, body:{classList:{add(){},remove(){},toggle(){}}}, documentElement:{style:{setProperty(){}}} };
const THREE = await import('three');
const { GameMap } = await import('/home/user/COUNTER-VALORANT/src/world/map.js');
const { ATTACK_PATHS } = await import('/home/user/COUNTER-VALORANT/src/world/mapLayout.js');
const scene = new THREE.Scene();
const map = new GameMap(scene, 'low');
const nodes = map.navNodes;
// BFS on nav graph
const start = map.nearestNode(0, 28);
const dist = new Map([[start,0]]); const q=[start];
while(q.length){ const c=q.shift(); for(const e of map.navEdges.get(c)||[]){ if(!dist.has(e.to)){dist.set(e.to,dist.get(c)+1); q.push(e.to);} } }
console.log(`nodes=${nodes.length} reached=${dist.size}`);
for(const n of nodes){ if(!dist.has(n.i)) console.log('UNREACHED', n.i, n.tag, n.x, n.z, 'edges=', (map.navEdges.get(n.i)||[]).length); }
console.log('path to plant spot', map.findPath(map.nearestNode(19.1,-11.1), map.nearestNode(20,-21)));
console.log('start node for 19.1,-11.1 =', map.navNodes[map.nearestNode(19.1,-11.1)]);
console.log('start node for 20,-21 =', map.navNodes[map.nearestNode(20,-21)]);
const p = map.findPath(map.nearestNode(0,28), map.nearestNode(20,-21));
console.log('spawn->plant', p && p.map(i=>`${map.navNodes[i].tag}(${map.navNodes[i].x},${map.navNodes[i].z})`).join(' -> '));

// debug a segment
function blockersOn(ax,az,bx,bz){
  const steps = Math.ceil(Math.hypot(bx-ax,bz-az)/0.2);
  const hits = new Map();
  for(let s=0;s<=steps;s++){
    const x = ax + (bx-ax)*s/steps, z = az + (bz-az)*s/steps;
    for(const b of map.navBlockers){
      if (x > b.min.x-0.5 && x < b.max.x+0.5 && z > b.min.z-0.5 && z < b.max.z+0.5){
        const key = `${b.min.x.toFixed(1)},${b.min.z.toFixed(1)} -> ${b.max.x.toFixed(1)},${b.max.z.toFixed(1)}`;
        hits.set(key, {x:x.toFixed(2), z:z.toFixed(2)});
      }
    }
  }
  return [...hits.entries()];
}
console.log('24.5,-9.5 -> 25,-21:', blockersOn(24.5,-9.5,25,-21));
console.log('16,-8.5 -> 25.5,1:', blockersOn(16,-8.5,25.5,1));


// validate authored attack paths
for (const site of ['A','B']) {
  for (const [lane, pts] of Object.entries(ATTACK_PATHS[site])) {
    let ok = true;
    for (let i=0;i<pts.length-1;i++) {
      const a = {x: pts[i][0], z: pts[i][1]};
      const b = {x: pts[i+1][0], z: pts[i+1][1]};
      const bad = blockersOn(a.x,a.z,b.x,b.z);
      if (bad.length) { ok = false; console.log(`  ${site}/${lane} seg ${i} ${a.x},${a.z} -> ${b.x},${b.z} BLOCKED by`, bad.map(h=>h[0]), bad[0][1]); }
    }
    console.log(`route ${site}/${lane}: ${ok ? 'OK' : 'BLOCKED'}`);
  }
}
