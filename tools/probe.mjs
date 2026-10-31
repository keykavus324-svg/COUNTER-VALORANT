import * as L from '../src/world/mapLayout.js';
const blockers = [...L.WALLS.map(w=>({...w, kind:'wall'})), ...L.PROPS.map(p=>({...p, kind:'prop'}))];
function near(x,z,r=1.2){ return blockers.filter(b=>{
  const hw=(b.w ?? b.width ?? 2)/2, hd=(b.d ?? b.depth ?? 2)/2;
  return x> b.x-hw-r && x< b.x+hw+r && z> b.z-hd-r && z< b.z+hd+r;
});}
for (const z of [-23.8,-25,-25.5,-26]) for (const x of [-15.6,-17,-18]) {
  console.log(x,z, JSON.stringify(near(x,z).map(b=>[b.kind,b.x,b.z,b.w??b.width,b.d??b.depth])));
}
