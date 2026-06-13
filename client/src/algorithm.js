

// ═══════════════════════════════════════════════════════════════════════════════
// Этапы: K-Means → narrowPixelStrip → buildFacets → removeFacets →
//        buildBorderPaths → buildBorderSegments (Haar) → matchSegments → createSVG
// ═══════════════════════════════════════════════════════════════════════════════

// ── Вспомогательные ──────────────────────────────────────────────────────────
class Random {
  constructor(seed) { this.seed = seed ?? Date.now(); }
  next() { const x = Math.sin(this.seed++) * 10000; return x - Math.floor(x); }
}

// ── Цветовые конвертации (lib/colorconversion из main.js) ─────────────────────
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h, s, l];
}
function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q-p)*6*t; if (t < 1/2) return q; if (t < 2/3) return p + (q-p)*(2/3-t)*6; return p; };
    const q = l < 0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
    r = hue2rgb(p,q,h+1/3); g = hue2rgb(p,q,h); b = hue2rgb(p,q,h-1/3);
  }
  return [r*255, g*255, b*255];
}
function rgb2lab(rgb) {
  let r=rgb[0]/255, g=rgb[1]/255, b=rgb[2]/255;
  r = r > 0.04045 ? Math.pow((r+0.055)/1.055, 2.4) : r/12.92;
  g = g > 0.04045 ? Math.pow((g+0.055)/1.055, 2.4) : g/12.92;
  b = b > 0.04045 ? Math.pow((b+0.055)/1.055, 2.4) : b/12.92;
  let x=(r*0.4124+g*0.3576+b*0.1805)/0.95047, y=(r*0.2126+g*0.7152+b*0.0722)/1.0, z=(r*0.0193+g*0.1192+b*0.9505)/1.08883;
  x = x > 0.008856 ? Math.pow(x,1/3) : 7.787*x+16/116;
  y = y > 0.008856 ? Math.pow(y,1/3) : 7.787*y+16/116;
  z = z > 0.008856 ? Math.pow(z,1/3) : 7.787*z+16/116;
  return [116*y-16, 500*(x-y), 200*(y-z)];
}
function lab2rgb(lab) {
  let y=(lab[0]+16)/116, x=lab[1]/500+y, z=y-lab[2]/200;
  x = 0.95047*((x*x*x>0.008856)?x*x*x:(x-16/116)/7.787);
  y = 1.0*((y*y*y>0.008856)?y*y*y:(y-16/116)/7.787);
  z = 1.08883*((z*z*z>0.008856)?z*z*z:(z-16/116)/7.787);
  let r=x*3.2406+y*-1.5372+z*-0.4986, g=x*-0.9689+y*1.8758+z*0.0415, b=x*0.0557+y*-0.2040+z*1.0570;
  r = r>0.0031308?1.055*Math.pow(r,1/2.4)-0.055:12.92*r;
  g = g>0.0031308?1.055*Math.pow(g,1/2.4)-0.055:12.92*g;
  b = b>0.0031308?1.055*Math.pow(b,1/2.4)-0.055:12.92*b;
  return [Math.max(0,Math.min(1,r))*255, Math.max(0,Math.min(1,g))*255, Math.max(0,Math.min(1,b))*255];
}

// ── K-Means clustering (lib/clustering из main.js) ────────────────────────────
class Vector {
  constructor(values, weight=1) { this.values=values; this.weight=weight; this.tag=null; }
  distanceTo(p) { let s=0; for(let i=0;i<this.values.length;i++) s+=(p.values[i]-this.values[i])**2; return Math.sqrt(s); }
  static average(pts) {
    const dims=pts[0].values.length, vals=new Array(dims).fill(0); let ws=0;
    for(const p of pts){ ws+=p.weight; for(let i=0;i<dims;i++) vals[i]+=p.weight*p.values[i]; }
    return new Vector(vals.map(v=>v/ws));
  }
}
class KMeans {
  constructor(points,k,random){ this.points=points; this.k=k; this.random=random; this.centroids=[]; this.pointsPerCategory=[]; this.currentDeltaDistanceDifference=0;
    for(let i=0;i<k;i++){ this.centroids.push(points[Math.floor(points.length*random.next())]); this.pointsPerCategory.push([]); } }
  step(){
    for(let i=0;i<this.k;i++) this.pointsPerCategory[i]=[];
    for(const p of this.points){ let md=Infinity,idx=0; for(let k=0;k<this.k;k++){const d=this.centroids[k].distanceTo(p);if(d<md){md=d;idx=k;}} this.pointsPerCategory[idx].push(p); }
    let td=0;
    for(let k=0;k<this.k;k++){ const cat=this.pointsPerCategory[k]; if(cat.length>0){const avg=Vector.average(cat);td+=this.centroids[k].distanceTo(avg);this.centroids[k]=avg;} }
    this.currentDeltaDistanceDifference=td;
  }
}

// ── OrientationEnum (facetmanagement из main.js) ──────────────────────────────
const OE = { Left:0, Top:1, Right:2, Bottom:3 };

// ── K-Means + colormap (colorreductionmanagement из main.js) ──────────────────
function applyKMeans(imgData, nColors, colorSpace, randomSeed, colorRestrictions) {
  const w=imgData.width, h=imgData.height;
  const bitsOff=2;
  const pointsByColor={};
  let idx=0;
  for(let j=0;j<h;j++) for(let i=0;i<w;i++){
    let r=imgData.data[idx++], g=imgData.data[idx++], b=imgData.data[idx++]; idx++;
    r=r>>bitsOff<<bitsOff; g=g>>bitsOff<<bitsOff; b=b>>bitsOff<<bitsOff;
    const color=`${r},${g},${b}`;
    if(!(color in pointsByColor)) pointsByColor[color]=[j*w+i]; else pointsByColor[color].push(j*w+i);
  }
  const vectors=[];
  for(const color of Object.keys(pointsByColor)){
    const rgb=color.split(',').map(Number);
    let data;
    if(colorSpace==='HSL') data=rgbToHsl(rgb[0],rgb[1],rgb[2]);
    else if(colorSpace==='LAB') data=rgb2lab(rgb);
    else data=rgb;
    const v=new Vector(data, pointsByColor[color].length/(w*h));
    v.tag=rgb;
    vectors.push(v);
  }
  const random=new Random(randomSeed);
  const km=new KMeans(vectors, Math.min(nColors,vectors.length), random);
  km.step();
  while(km.currentDeltaDistanceDifference>1) km.step();

  const out=new Uint8Array(w*h*4);
  const colorsByIndex=[];
  for(let c=0;c<km.centroids.length;c++){
    let rgb;
    if(colorSpace==='HSL') rgb=hslToRgb(...km.centroids[c].values);
    else if(colorSpace==='LAB') rgb=lab2rgb(km.centroids[c].values);
    else rgb=km.centroids[c].values;
    rgb=rgb.map(v=>Math.floor(v));
    if(colorRestrictions.length>0){
      let minD=Infinity, best=colorRestrictions[0];
      const labA=rgb2lab(rgb);
      for(const cc of colorRestrictions){ const labB=rgb2lab(cc); const d=Math.sqrt((labA[0]-labB[0])**2+(labA[1]-labB[1])**2+(labA[2]-labB[2])**2); if(d<minD){minD=d;best=cc;} }
      rgb=best;
    }
    colorsByIndex.push(rgb);
    for(const v of km.pointsPerCategory[c]){
      const ptColor=`${Math.floor(v.tag[0])},${Math.floor(v.tag[1])},${Math.floor(v.tag[2])}`;
      for(const pt of pointsByColor[ptColor]){
        const off=pt*4; out[off]=rgb[0]; out[off+1]=rgb[1]; out[off+2]=rgb[2]; out[off+3]=255;
      }
    }
  }
  return {out, colorsByIndex};
}

// ── createColorMap ────────────────────────────────────────────────────────────
function createColorMap(data, w, h) {
  const imgColorIndices=new Int32Array(w*h);
  const colors={}, colorsByIndex=[];
  let colorIndex=0, idx=0;
  for(let j=0;j<h;j++) for(let i=0;i<w;i++){
    const r=data[idx++],g=data[idx++],b=data[idx++]; idx++;
    const key=`${r},${g},${b}`;
    if(!(key in colors)){ colors[key]=colorIndex; colorsByIndex.push([r,g,b]); colorIndex++; }
    imgColorIndices[j*w+i]=colors[key];
  }
  return {imgColorIndices, colorsByIndex};
}

// ── narrowPixelStripCleanup ───────────────────────────────────────────────────
function buildColorDistanceMatrix(colorsByIndex) {
  const n=colorsByIndex.length, d=[];
  for(let j=0;j<n;j++){ d[j]=[]; for(let i=0;i<n;i++){ const c1=colorsByIndex[j],c2=colorsByIndex[i]; d[j][i]=Math.sqrt((c1[0]-c2[0])**2+(c1[1]-c2[1])**2+(c1[2]-c2[2])**2); } }
  return d;
}
function narrowPixelStripCleanup(imgColorIndices, colorsByIndex, w, h) {
  const cd=buildColorDistanceMatrix(colorsByIndex);
  for(let j=1;j<h-1;j++) for(let i=1;i<w-1;i++){
    const cur=imgColorIndices[j*w+i];
    const top=imgColorIndices[(j-1)*w+i], bottom=imgColorIndices[(j+1)*w+i];
    const left=imgColorIndices[j*w+i-1], right=imgColorIndices[j*w+i+1];
    if(cur!==top&&cur!==bottom) imgColorIndices[j*w+i]=cd[cur][top]<cd[cur][bottom]?top:bottom;
    else if(cur!==left&&cur!==right) imgColorIndices[j*w+i]=cd[cur][left]<cd[cur][right]?left:right;
  }
}

// ── buildFacets ───────────────────────────────────────────────────────────────
function buildFacets(imgColorIndices, colorsByIndex, w, h) {
  const facetMap=new Int32Array(w*h).fill(-1);
  const facets=[];
  let facetId=0;
  for(let j=0;j<h;j++) for(let i=0;i<w;i++){
    if(facetMap[j*w+i]!==-1) continue;
    const color=imgColorIndices[j*w+i];
    const facet={id:facetId,color,pointCount:0,borderPoints:[],bbox:{minX:i,minY:j,maxX:i,maxY:j},neighbourFacets:[],neighbourFacetsIsDirty:true,borderPath:[],borderSegments:[]};
    const stack=[[i,j]]; facetMap[j*w+i]=facetId;
    while(stack.length>0){
      const [x,y]=stack.pop();
      facet.pointCount++;
      if(x<facet.bbox.minX)facet.bbox.minX=x; if(x>facet.bbox.maxX)facet.bbox.maxX=x;
      if(y<facet.bbox.minY)facet.bbox.minY=y; if(y>facet.bbox.maxY)facet.bbox.maxY=y;
      const isBorder=(x===0||y===0||x===w-1||y===h-1||imgColorIndices[(y-1)*w+x]!==color||imgColorIndices[(y+1)*w+x]!==color||imgColorIndices[y*w+x-1]!==color||imgColorIndices[y*w+x+1]!==color);
      if(isBorder) facet.borderPoints.push({x,y});
      for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
        if(nx<0||ny<0||nx>=w||ny>=h||facetMap[ny*w+nx]!==-1||imgColorIndices[ny*w+nx]!==color) continue;
        facetMap[ny*w+nx]=facetId; stack.push([nx,ny]);
      }
    }
    facets.push(facet); facetId++;
  }
  return {facets,facetMap};
}

// ── buildFacetNeighbour ───────────────────────────────────────────────────────
function buildFacetNeighbour(facet, facetMap, w, h) {
  const nbSet=new Set();
  for(const bp of facet.borderPoints){
    for(const [nx,ny] of [[bp.x-1,bp.y],[bp.x+1,bp.y],[bp.x,bp.y-1],[bp.x,bp.y+1]]){
      if(nx<0||ny<0||nx>=w||ny>=h) continue;
      const nf=facetMap[ny*w+nx];
      if(nf!==-1&&nf!==facet.id) nbSet.add(nf);
    }
  }
  facet.neighbourFacets=[...nbSet]; facet.neighbourFacetsIsDirty=false;
}

// ── removeFacets ─────────────────────────────────────────────────────────────
function removeFacets(facets, facetMap, imgColorIndices, colorsByIndex, w, h, smallerThan) {
  const cd=buildColorDistanceMatrix(colorsByIndex);
  const order=[...facets].filter(f=>f!=null).sort((a,b)=>b.pointCount-a.pointCount).map(f=>f.id);
  for(const fid of order){
    const f=facets[fid];
    if(f==null||f.pointCount>=smallerThan) continue;
    deleteFacet(f,facets,facetMap,imgColorIndices,cd,w,h);
  }
}
function deleteFacet(facet, facets, facetMap, imgColorIndices, colorDistances, w, h) {
  if(facet.neighbourFacetsIsDirty) buildFacetNeighbour(facet,facetMap,w,h);
  if(facet.neighbourFacets.length===0) return;
  for(let j=facet.bbox.minY;j<=facet.bbox.maxY;j++) for(let i=facet.bbox.minX;i<=facet.bbox.maxX;i++){
    if(facetMap[j*w+i]!==facet.id) continue;
    let bestNeighbour=-1,bestDist=Infinity;
    for(const nfid of facet.neighbourFacets){
      const nf=facets[nfid]; if(!nf) continue;
      const dist=colorDistances[facet.color][nf.color];
      if(dist<bestDist){bestDist=dist;bestNeighbour=nfid;}
    }
    if(bestNeighbour===-1) continue;
    facetMap[j*w+i]=bestNeighbour;
    imgColorIndices[j*w+i]=facets[bestNeighbour].color;
  }
  facets[facet.id]=null;
  for(const nfid of facet.neighbourFacets){ if(facets[nfid]) facets[nfid].neighbourFacetsIsDirty=true; }
}

// ── FacetBorderTracer ─────────────────────────────────────────────────────────
function buildAllBorderPaths(facets, facetMap, w, h) {
  const xWall=new Uint8Array((w+1)*(h+1));
  const yWall=new Uint8Array((w+1)*(h+1));
  const borderMask=new Uint8Array(w*h);
  const xW=(x,y)=>xWall[y*(w+1)+x];
  const yW=(x,y)=>yWall[y*(w+1)+x];
  const setXW=(x,y,v)=>{xWall[y*(w+1)+x]=v?1:0;};
  const setYW=(x,y,v)=>{yWall[y*(w+1)+x]=v?1:0;};
  const fmap=(x,y)=>(x<0||y<0||x>=w||y>=h)?-1:facetMap[y*w+x];

  const addPt=(path,pt)=>{
    path.push({x:pt.x,y:pt.y,o:pt.o});
    switch(pt.o){
      case OE.Left:   setXW(pt.x,    pt.y,  true); break;
      case OE.Top:    setYW(pt.x,    pt.y,  true); break;
      case OE.Right:  setXW(pt.x+1,  pt.y,  true); break;
      case OE.Bottom: setYW(pt.x,    pt.y+1,true); break;
    }
  };
  const getWX=pt=>pt.o===OE.Left?pt.x-0.5:pt.o===OE.Right?pt.x+0.5:pt.x;
  const getWY=pt=>pt.o===OE.Top?pt.y-0.5:pt.o===OE.Bottom?pt.y+0.5:pt.y;

  const order=facets.filter(f=>f!=null).sort((a,b)=>b.pointCount-a.pointCount).map(f=>f.id);

  for(const fid of order){
    const f=facets[fid]; if(!f) continue;
    for(const bp of f.borderPoints) borderMask[bp.y*w+bp.x]=1;

    let bsi=-1;
    for(let i=0;i<f.borderPoints.length;i++){
      const bp=f.borderPoints[i];
      if(bp.x===f.bbox.minX||bp.x===f.bbox.maxX||bp.y===f.bbox.minY||bp.y===f.bbox.maxY){bsi=i;break;}
    }
    if(bsi===-1){f.borderPath=[];for(const bp of f.borderPoints)borderMask[bp.y*w+bp.x]=0;continue;}

    const bp=f.borderPoints[bsi];
    let so=OE.Left;
    if(bp.x-1<0||fmap(bp.x-1,bp.y)!==f.id) so=OE.Left;
    else if(bp.y-1<0||fmap(bp.x,bp.y-1)!==f.id) so=OE.Top;
    else if(bp.x+1>=w||fmap(bp.x+1,bp.y)!==f.id) so=OE.Right;
    else if(bp.y+1>=h||fmap(bp.x,bp.y+1)!==f.id) so=OE.Bottom;

    let pt={x:bp.x,y:bp.y,o:so};
    const path=[];
    addPt(path,pt);

    let finished=false;
    while(!finished){
      const {x,y,o}=pt;
      const next=[];
      if(o===OE.Left){
        if(((y-1>=0&&fmap(x,y-1)!==f.id)||y-1<0)&&!yW(x,y))           next.push({x,y,o:OE.Top});
        if(((y+1<h&&fmap(x,y+1)!==f.id)||y+1>=h)&&!yW(x,y+1))         next.push({x,y,o:OE.Bottom});
        if(y-1>=0&&fmap(x,y-1)===f.id&&(x-1<0||fmap(x-1,y-1)!==f.id)&&borderMask[(y-1)*w+x]&&!xW(x,y-1)) next.push({x,y:y-1,o:OE.Left});
        if(y+1<h &&fmap(x,y+1)===f.id&&(x-1<0||fmap(x-1,y+1)!==f.id)&&borderMask[(y+1)*w+x]&&!xW(x,y+1)) next.push({x,y:y+1,o:OE.Left});
        if(y-1>=0&&x-1>=0&&fmap(x-1,y-1)===f.id&&borderMask[(y-1)*w+x-1]&&!yW(x-1,y)  &&!yW(x,y))   next.push({x:x-1,y:y-1,o:OE.Bottom});
        if(y+1<h &&x-1>=0&&fmap(x-1,y+1)===f.id&&borderMask[(y+1)*w+x-1]&&!yW(x-1,y+1)&&!yW(x,y+1)) next.push({x:x-1,y:y+1,o:OE.Top});
      } else if(o===OE.Top){
        if(((x-1>=0&&fmap(x-1,y)!==f.id)||x-1<0)&&!xW(x,y))           next.push({x,y,o:OE.Left});
        if(((x+1<w&&fmap(x+1,y)!==f.id)||x+1>=w)&&!xW(x+1,y))         next.push({x,y,o:OE.Right});
        if(x-1>=0&&fmap(x-1,y)===f.id&&(y-1<0||fmap(x-1,y-1)!==f.id)&&borderMask[y*w+x-1]&&!yW(x-1,y)) next.push({x:x-1,y,o:OE.Top});
        if(x+1<w &&fmap(x+1,y)===f.id&&(y-1<0||fmap(x+1,y-1)!==f.id)&&borderMask[y*w+x+1]&&!yW(x+1,y)) next.push({x:x+1,y,o:OE.Top});
        if(y-1>=0&&x-1>=0&&fmap(x-1,y-1)===f.id&&borderMask[(y-1)*w+x-1]&&!xW(x,y-1)  &&!xW(x,y))   next.push({x:x-1,y:y-1,o:OE.Right});
        if(y-1>=0&&x+1<w &&fmap(x+1,y-1)===f.id&&borderMask[(y-1)*w+x+1]&&!xW(x+1,y-1)&&!xW(x+1,y)) next.push({x:x+1,y:y-1,o:OE.Left});
      } else if(o===OE.Right){
        if(((y-1>=0&&fmap(x,y-1)!==f.id)||y-1<0)&&!yW(x,y))           next.push({x,y,o:OE.Top});
        if(((y+1<h&&fmap(x,y+1)!==f.id)||y+1>=h)&&!yW(x,y+1))         next.push({x,y,o:OE.Bottom});
        if(y-1>=0&&fmap(x,y-1)===f.id&&(x+1>=w||fmap(x+1,y-1)!==f.id)&&borderMask[(y-1)*w+x]&&!xW(x+1,y-1)) next.push({x,y:y-1,o:OE.Right});
        if(y+1<h &&fmap(x,y+1)===f.id&&(x+1>=w||fmap(x+1,y+1)!==f.id)&&borderMask[(y+1)*w+x]&&!xW(x+1,y+1)) next.push({x,y:y+1,o:OE.Right});
        if(y-1>=0&&x+1<w&&fmap(x+1,y-1)===f.id&&borderMask[(y-1)*w+x+1]&&!yW(x+1,y)  &&!yW(x,y))   next.push({x:x+1,y:y-1,o:OE.Bottom});
        if(y+1<h &&x+1<w&&fmap(x+1,y+1)===f.id&&borderMask[(y+1)*w+x+1]&&!yW(x+1,y+1)&&!yW(x,y+1)) next.push({x:x+1,y:y+1,o:OE.Top});
      } else {
        if(((x-1>=0&&fmap(x-1,y)!==f.id)||x-1<0)&&!xW(x,y))           next.push({x,y,o:OE.Left});
        if(((x+1<w&&fmap(x+1,y)!==f.id)||x+1>=w)&&!xW(x+1,y))         next.push({x,y,o:OE.Right});
        if(x-1>=0&&fmap(x-1,y)===f.id&&(y+1>=h||fmap(x-1,y+1)!==f.id)&&borderMask[y*w+x-1]&&!yW(x-1,y+1)) next.push({x:x-1,y,o:OE.Bottom});
        if(x+1<w &&fmap(x+1,y)===f.id&&(y+1>=h||fmap(x+1,y+1)!==f.id)&&borderMask[y*w+x+1]&&!yW(x+1,y+1)) next.push({x:x+1,y,o:OE.Bottom});
        if(y+1<h&&x-1>=0&&fmap(x-1,y+1)===f.id&&borderMask[(y+1)*w+x-1]&&!xW(x,y+1)  &&!xW(x,y))   next.push({x:x-1,y:y+1,o:OE.Right});
        if(y+1<h&&x+1<w &&fmap(x+1,y+1)===f.id&&borderMask[(y+1)*w+x+1]&&!xW(x+1,y+1)&&!xW(x+1,y)) next.push({x:x+1,y:y+1,o:OE.Left});
      }
      if(next.length===0){finished=true;}else{pt=next[0];addPt(path,pt);}
    }

    for(const p of path){
      switch(p.o){
        case OE.Left:   setXW(p.x,   p.y,  false); break;
        case OE.Top:    setYW(p.x,   p.y,  false); break;
        case OE.Right:  setXW(p.x+1, p.y,  false); break;
        case OE.Bottom: setYW(p.x,   p.y+1,false); break;
      }
    }
    for(const bp of f.borderPoints) borderMask[bp.y*w+bp.x]=0;
    f.borderPath=path.map(p=>({x:getWX(p),y:getWY(p)}));
  }
}

// ── reduceHaar ────────────────────────────────────────────────────────────────
function reduceHaar(pts, times, w, h) {
  let path=[...pts];
  for(let t=0;t<times;t++){
    if(path.length<=5) break;
    const out=[path[0]];
    for(let i=1;i<path.length-2;i+=2){
      const a=path[i],b=path[i+1];
      const onBorder=a.x===0||a.y===0||a.x===w-1||a.y===h-1;
      if(onBorder){out.push(a,b);}else{out.push({x:(a.x+b.x)/2,y:(a.y+b.y)/2});}
    }
    out.push(path[path.length-1]);
    path=out;
  }
  return path;
}

// ── buildAndMatchSegments ─────────────────────────────────────────────────────
function buildAndMatchSegments(facets, facetMap, w, h, nHaar) {
  const segmentsPerFacet=new Array(facets.length);
  for(const f of facets){
    if(!f||f.borderPath.length<2){if(f)segmentsPerFacet[f.id]=[];continue;}
    const segs=[];
    let curPts=[f.borderPath[0]];
    const getNeighbour=pt=>{
      const rx=Math.round(pt.x),ry=Math.round(pt.y);
      for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
        const nx=rx+dx,ny=ry+dy;
        if(nx<0||ny<0||nx>=w||ny>=h) continue;
        const nf=facetMap[ny*w+nx];
        if(nf!==-1&&nf!==f.id) return nf;
      }
      return -1;
    };
    let prevNeighbour=getNeighbour(f.borderPath[0]);
    for(let i=1;i<f.borderPath.length;i++){
      const pt=f.borderPath[i];
      const curNeighbour=getNeighbour(pt);
      curPts.push(pt);
      if(curNeighbour!==prevNeighbour){
        if(curPts.length>1) segs.push({points:[...curPts],neighbour:prevNeighbour});
        curPts=[pt]; prevNeighbour=curNeighbour;
      }
    }
    if(curPts.length>1){
      if(segs.length>0&&segs[0].neighbour===prevNeighbour) segs[0].points=[...curPts,...segs[0].points];
      else segs.push({points:curPts,neighbour:prevNeighbour});
    }
    segmentsPerFacet[f.id]=segs;
  }

  for(const f of facets){
    if(!f) continue;
    for(const seg of segmentsPerFacet[f.id])
      for(let i=0;i<nHaar;i++) seg.points=reduceHaar(seg.points,1,w,h);
  }

  const MAX_DIST=4;
  for(const f of facets){if(f)f.borderSegments=new Array(segmentsPerFacet[f.id].length).fill(null);}
  for(const f of facets){
    if(!f) continue;
    for(let s=0;s<segmentsPerFacet[f.id].length;s++){
      const seg=segmentsPerFacet[f.id][s];
      if(!seg) continue;
      if(!f.borderSegments[s]) f.borderSegments[s]={seg,reverseOrder:false};
      const nbId=seg.neighbour;
      if(nbId===-1) continue;
      const nb=facets[nbId]; if(!nb) continue;
      const nbSegs=segmentsPerFacet[nbId];
      const segS=seg.points[0],segE=seg.points[seg.points.length-1];
      const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
      for(let ns=0;ns<nbSegs.length;ns++){
        const nSeg=nbSegs[ns]; if(!nSeg||nSeg.neighbour!==f.id) continue;
        const nS=nSeg.points[0],nE=nSeg.points[nSeg.points.length-1];
        const straight=dist(segS,nS)<=MAX_DIST&&dist(segE,nE)<=MAX_DIST;
        const reverse=dist(segS,nE)<=MAX_DIST&&dist(segE,nS)<=MAX_DIST;
        if(straight||reverse){nb.borderSegments[ns]={seg:f.borderSegments[s].seg,reverseOrder:reverse};nbSegs[ns]=null;break;}
      }
    }
    for(let s=0;s<segmentsPerFacet[f.id].length;s++) segmentsPerFacet[f.id][s]=null;
  }
}

// ── getFullPath ───────────────────────────────────────────────────────────────
function getFullPath(facet) {
  const path=[];
  let lastSeg=null;
  for(const bs of facet.borderSegments){
    if(!bs) continue;
    if(lastSeg){
      const lp=lastSeg.reverseOrder?lastSeg.seg.points[0]:lastSeg.seg.points[lastSeg.seg.points.length-1];
      path.push(lp);
    }
    const pts=bs.seg.points;
    for(let i=0;i<pts.length;i++) path.push(pts[bs.reverseOrder?(pts.length-1-i):i]);
    lastSeg=bs;
  }
  return path;
}

// ── buildSVG ─────────────────────────────────────────────────────────────────
function buildSVG({facets, colorsByIndex, w, h, showFill, showBorders, showNumbers, fontSize}) {
  const lines=[
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<rect width="${w}" height="${h}" fill="white"/>`,
  ];
  for(const f of facets){
    if(!f||f.borderSegments.length===0) continue;
    let newpath=getFullPath(f);
    if(newpath.length===0) continue;
    if(newpath[0].x!==newpath[newpath.length-1].x||newpath[0].y!==newpath[newpath.length-1].y) newpath.push(newpath[0]);
    let data=`M ${newpath[0].x} ${newpath[0].y} `;
    for(let i=1;i<newpath.length;i++){
      const mx=(newpath[i].x+newpath[i-1].x)/2,my=(newpath[i].y+newpath[i-1].y)/2;
      data+=`Q ${mx} ${my} ${newpath[i].x} ${newpath[i].y} `;
    }
    data+='Z';
    const [r,g,b]=colorsByIndex[f.color];
    const fillColor=showFill?`rgb(${r},${g},${b})`:'none';
    const strokeColor=showBorders?'#333':(showFill?`rgb(${r},${g},${b})`:'none');
    lines.push(`<path d="${data}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1"/>`);
  }
  if(showNumbers){
    lines.push('<g font-family="Arial" dominant-baseline="middle" text-anchor="middle" fill="#111">');
    for(const f of facets){
      if(!f||f.pointCount<20) continue;
      const cx=((f.bbox.minX+f.bbox.maxX)/2).toFixed(1);
      const cy=((f.bbox.minY+f.bbox.maxY)/2).toFixed(1);
      const fs=Math.max(3,Math.min(fontSize,Math.sqrt(f.pointCount)*0.45));
      lines.push(`<text x="${cx}" y="${cy}" font-size="${fs.toFixed(1)}" opacity="0.85">${f.color+1}</text>`);
    }
    lines.push('</g>');
  }
  lines.push('</svg>');
  return lines.join('\n');
}

// ── buildPaletteSVG ───────────────────────────────────────────────────────────
function buildPaletteSVG(colorsByIndex) {
  const sw=72, sh=30, cols=4, gap=6, labelH=28;
  const rows=Math.ceil(colorsByIndex.length/cols);
  const W=cols*(sw+gap)+gap, H=rows*(sh+labelH+gap)+gap;
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="white"/>`;
  colorsByIndex.forEach(([r,g,b],i)=>{
    const col=i%cols, row=Math.floor(i/cols);
    const x=col*(sw+gap)+gap, y=row*(sh+labelH+gap)+gap;
    // determine label color for contrast
    const luminance=(0.299*r+0.587*g+0.114*b)/255;
    const labelOnSwatch=luminance>0.45?'#222':'#fff';
    // color swatch with number inside
    svg+=`<rect x="${x}" y="${y}" width="${sw}" height="${sh}" fill="rgb(${r},${g},${b})" stroke="#ccc" stroke-width="0.5" rx="2"/>`;
    svg+=`<text x="${x+sw/2}" y="${y+sh/2}" font-family="Arial" font-size="11" font-weight="600" dominant-baseline="middle" text-anchor="middle" fill="${labelOnSwatch}">${i+1}</text>`;
    // rgb label below
    svg+=`<text x="${x+sw/2}" y="${y+sh+9}"  font-family="Arial" font-size="7.5" text-anchor="middle" fill="#444">rgb(${r},${g},${b})</text>`;
    // hex label below rgb
    const hex='#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
    svg+=`<text x="${x+sw/2}" y="${y+sh+19}" font-family="Arial" font-size="7.5" text-anchor="middle" fill="#777">${hex}</text>`;
  });
  return svg+'</svg>';
}

// ── processImage ──────────────────────────────────────────────────────────────
const yieldToUI=()=>new Promise(r=>setTimeout(r,0));

async function processImage({imgData, nColors, colorSpace, randomSeed, minFacetSize, customColors, nHaar, onProgress}) {
  const w=imgData.width,h=imgData.height;
  const tick=async msg=>{onProgress&&onProgress(msg);await yieldToUI();};

  await tick('K-Means кластеризация...');
  const {out:kmeansData}=applyKMeans(imgData,nColors,colorSpace,randomSeed,customColors);

  await tick('Построение карты цветов...');
  let {imgColorIndices,colorsByIndex}=createColorMap(kmeansData,w,h);

  await tick('Очистка пиксельных полос...');
  for(let i=0;i<3;i++) narrowPixelStripCleanup(imgColorIndices,colorsByIndex,w,h);
  const remapped=createColorMap(new Uint8Array(imgColorIndices.length*4).map((_,i)=>{
    const ci=Math.floor(i/4),ch=i%4;
    if(ch===3) return 255;
    return colorsByIndex[imgColorIndices[ci]][ch];
  }),w,h);
  imgColorIndices=remapped.imgColorIndices; colorsByIndex=remapped.colorsByIndex;

  await tick('Построение областей...');
  let {facets,facetMap}=buildFacets(imgColorIndices,colorsByIndex,w,h);

  await tick('Удаление мелких областей...');
  removeFacets(facets,facetMap,imgColorIndices,colorsByIndex,w,h,minFacetSize);

  await tick('Перестройка областей...');
  const rebuilt=buildFacets(imgColorIndices,colorsByIndex,w,h);
  facets=rebuilt.facets; facetMap=rebuilt.facetMap;

  await tick('Трассировка контуров...');
  buildAllBorderPaths(facets,facetMap,w,h);

  await tick('Сглаживание сегментов...');
  buildAndMatchSegments(facets,facetMap,w,h,nHaar);

  await tick('Генерация SVG...');
  const finalColors=[];
  for(const f of facets){if(f&&!finalColors[f.color])finalColors[f.color]=colorsByIndex[f.color];}
  for(let i=0;i<colorsByIndex.length;i++) if(!finalColors[i]) finalColors[i]=colorsByIndex[i];
  return {facets,colorsByIndex:finalColors,w,h};
}

// ── Предобработка изображения через CSS-фильтры canvas ───────────────────────
function applyPreprocessing(img, pp) {
  const MAX=500;
  let iw=img.naturalWidth,ih=img.naturalHeight;
  if(iw>MAX||ih>MAX){const s=Math.min(MAX/iw,MAX/ih);iw=Math.round(iw*s);ih=Math.round(ih*s);}
  const oc=document.createElement('canvas'); oc.width=iw; oc.height=ih;
  const ctx=oc.getContext('2d');
  ctx.filter=[
    `brightness(${pp.brightness}%)`,
    `contrast(${pp.contrast}%)`,
    `saturate(${pp.saturate}%)`,
    `hue-rotate(${pp.hue}deg)`,
    `blur(${pp.blur}px)`,
    `grayscale(${pp.grayscale}%)`,
  ].join(' ');
  ctx.drawImage(img,0,0,iw,ih);
  return {imgData:ctx.getImageData(0,0,iw,ih),w:iw,h:ih};
}

// ── Пресеты сложности ─────────────────────────────────────────────────────────
const DIFFICULTY_PRESETS={
  easy:  {label:'Простой', icon:'🟢',nColors:8, minFacetSize:150,nHaar:2,desc:'8 цветов, крупные области'},
  medium:{label:'Средний', icon:'🟡',nColors:16,minFacetSize:50, nHaar:2,desc:'16 цветов, средние области'},
  hard:  {label:'Сложный', icon:'🔴',nColors:32,minFacetSize:15, nHaar:2,desc:'32 цветв, мелкие детали'},
};

// ── UI helpers ────────────────────────────────────────────────────────────────
const card={background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',padding:'1rem 1.25rem'};

function StepLabel({n,title,active}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:'0.75rem'}}>
      <div style={{width:22,height:22,borderRadius:'50%',background:active?'var(--color-text-primary)':'var(--color-border-secondary)',color:active?'var(--color-background-primary)':'var(--color-text-tertiary)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:600,flexShrink:0}}>{n}</div>
      <span style={{fontSize:13,fontWeight:500,color:active?'var(--color-text-primary)':'var(--color-text-tertiary)'}}>{title}</span>
    </div>
  );
}

function Slider({label,value,min,max,step=1,unit='',onChange}){
  return(
    <label style={{fontSize:13,display:'flex',alignItems:'center',gap:8}}>
      <span style={{minWidth:125,flexShrink:0}}>{label}: <b>{value}{unit}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onInput={e=>onChange(+e.target.value)} style={{flex:1}}/>
    </label>
  );
}


export {
  applyPreprocessing,
  applyKMeans,
  createColorMap,
  narrowPixelStripCleanup,
  buildFacets,
  removeFacets,
  buildAllBorderPaths,
  buildAndMatchSegments,
  buildSVG,
  buildPaletteSVG,
  processImage,
  DIFFICULTY_PRESETS,
};
