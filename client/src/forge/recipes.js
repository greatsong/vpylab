import { welcomeParts, welcomeColorVector } from '../data/welcome-friends.js';
const pinkReference = welcomeParts('kirby');

// 대장간 레시피는 실행 코드를 받지 않습니다. 같은 부품 명세를 화면과 Python에 씁니다.
export const forgePresets = [
  { id: 'kirby', name: '커비처럼 동그랗게', icon: '✦', kind: 'character', note: '둥근 몸통 · 타원 눈 · 큰 발', colors: [pinkReference.find(p=>p.name==='body').color, pinkReference.find(p=>p.name==='left_foot').color], params: { width: 1.72, height: 1.72, depth: 1.72, eyeSize: .26, eyeGap: .14, cheekSize: .21, armSize: .5, feetSize: .6 } },
  { id: 'doraemon', name: '도라에몽처럼 조합', icon: '◉', kind: 'character', note: '파란 몸통 · 흰 얼굴 · 방울', colors: ['#229cde', '#ef5050'], params: { width: 2.05, height: 2, depth: 1.75 } },
  { id: 'chiikawa', name: '치이카와처럼 작게', icon: 'ᴗ', kind: 'character', note: '하얀 몸통 · 작은 귀 · 볼', colors: ['#fff9ee', '#f5a9b9'], params: { width: 1.95, height: 1.8, depth: 1.55, earLength: .4, feetSize: .38 } },
  { id: 'rabbit', name: '긴 귀 토끼', icon: '⋈', kind: 'character', note: '길쭉한 귀를 가진 친구', colors: ['#f2e3fc', '#ba91e1'], params: { earLength: 1.15, height: 1.9 } },
  { id: 'bear', name: '폭신한 곰', icon: '●', kind: 'character', note: '동그란 귀와 주둥이', colors: ['#c79871', '#805f49'], params: { earLength: .55, height: 2.1 } },
  { id: 'cat', name: '작은 고양이', icon: '△', kind: 'character', note: '뾰족한 귀와 꼬리', colors: ['#f3c984', '#b87c46'], params: { earLength: .7 } },
  { id: 'penguin', name: '펭귄 친구', icon: '◒', kind: 'character', note: '하얀 배와 주황 부리', colors: ['#34475d', '#f2b346'], params: { height: 2.35, width: 1.8, feetSize: .6 } },
  { id: 'monster', name: '외눈박이 괴물', icon: '◎', kind: 'character', note: '하나의 눈 · 두 개의 뿔', colors: ['#a3dca8', '#6baf80'], params: { eyeSize: .37, earLength: .7 } },
  { id: 'bell', name: '종 만들기', icon: '♬', kind: 'interactive', note: '모양 → 클릭 소리 → 음파 효과', colors: ['#f4bf58', '#a2653c'], params: { width: 1.7, height: 1.7, depth: 1.7, tone: 880 } },
  { id: 'star', name: '입체 별', icon: '☆', kind: 'shape', note: '뾰족함과 두께를 조절', colors: ['#ffd26f', '#edaa47'] },
  { id: 'heart', name: '입체 하트', icon: '♡', kind: 'shape', note: '단면과 압출로 만드는 하트', colors: ['#f69cb9', '#d96d92'] },
  { id: 'dome', name: '반구와 돔', icon: '◠', kind: 'shape', note: '높이를 줄이면 납작한 돔', colors: ['#80c9bf', '#499d94'] },
  { id: 'cup', name: '속이 빈 컵', icon: '∪', kind: 'shape', note: '벽 두께와 높이 바꾸기', colors: ['#9fb7eb', '#6583b9'] },
  { id: 'ring', name: '고리와 도넛', icon: '○', kind: 'shape', note: '반지름과 고리 두께', colors: ['#d3a1dd', '#a86cbd'] },
];

export const forgeParameters = {
  width: { label: '너비', variable: 'body_width', min: 1.3, max: 2.8, step: .01, group: 'body', value: 2 },
  height: { label: '높이', variable: 'body_height', min: 1.3, max: 2.8, step: .01, group: 'body', value: 1.9 },
  depth: { label: '앞뒤 두께', variable: 'body_depth', min: 1, max: 2.3, step: .01, group: 'body', value: 1.6 },
  eyeSize: { label: '눈 크기', variable: 'eye_size', min: .1, max: .4, step: .01, group: 'face', value: .18 },
  eyeGap: { label: '눈 사이 간격 비율', variable: 'eye_gap', min: .12, max: .26, step: .01, group: 'face', value: .18 },
  cheekSize: { label: '볼 크기', variable: 'cheek_size', min: 0, max: .38, step: .01, group: 'face', value: .23 },
  earLength: { label: '귀·뿔 길이', variable: 'ear_length', min: .25, max: 1.5, step: .05, group: 'parts', value: .55 },
  armSize: { label: '팔 길이', variable: 'arm_size', min: .3, max: .95, step: .05, group: 'parts', value: .55 },
  feetSize: { label: '발 크기', variable: 'feet_size', min: .3, max: .9, step: .05, group: 'parts', value: .55 },
  wall: { label: '벽·고리 두께 비율', variable: 'wall_ratio', min: .08, max: .3, step: .01, group: 'shape', value: .14 },
  point: { label: '별 안쪽 반지름 비율', variable: 'inner_ratio', min: .25, max: .7, step: .05, group: 'shape', value: .48 },
  tone: { label: '종소리 높이 (Hz)', variable: 'tone_hz', min: 220, max: 1320, step: 55, group: 'sound', value: 880 },
};
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const colorPattern = /^#[a-f\d]{6}$/i;
export function createRecipe(presetId = 'kirby') {
  const p = forgePresets.find(p => p.id === presetId);
  if (!p) throw new Error('알 수 없는 시작 모양입니다.');
  return { presetId, params: { ...Object.fromEntries(Object.entries(forgeParameters).map(([key, p]) => [key, p.value])), ...p.params }, colors: [...p.colors], expression: 'smile', accessory: 'none', bellMode:'shape', ...(presetId==='kirby'?{appearance:'welcome-v1'}:{}) };
}
export function validateRecipe(input) {
  if (!plain(input)) throw new Error('모양 설정을 읽을 수 없습니다.');
  const recipe = createRecipe(input.presetId);
  if(input.appearance!==undefined&&(input.presetId!=='kirby'||input.appearance!=='welcome-v1'))throw new Error('지원하지 않는 캐릭터 모양 버전입니다.');
  // 저장·공개된 예전 모듈은 당시 코드와 부품을 그대로 재현합니다.
  if(input.appearance===undefined)delete recipe.appearance;
  if (!plain(input.params) || !Array.isArray(input.colors) || input.colors.length !== 2 || !input.colors.every(c => typeof c === 'string' && colorPattern.test(c))) throw new Error('모양의 숫자나 색상 형식이 올바르지 않습니다.');
  for (const [key, spec] of Object.entries(forgeParameters)) {
    const n = input.params[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < spec.min || n > spec.max) throw new Error(`${spec.label} 값이 범위를 벗어났습니다.`);
    recipe.params[key] = n;
  }
  if (!['smile', 'surprise', 'sleepy'].includes(input.expression) || !['none', 'hat', 'bow', 'antenna'].includes(input.accessory)) throw new Error('표정이나 장식 형식이 올바르지 않습니다.');
  if(input.bellMode!==undefined&&!['shape','sound','waves'].includes(input.bellMode))throw new Error('종의 단계를 확인하세요.');
  return { ...recipe, colors: [...input.colors], expression: input.expression, accessory: input.accessory,bellMode:input.bellMode||'shape' };
}
export function activeParameters(recipe) {
  const preset = forgePresets.find(p => p.id === recipe.presetId);
  if (preset.kind === 'interactive') return ['width', 'height', ...(recipe.bellMode==='shape'?[]:['tone'])];
  if (preset.kind === 'shape') return ['width', ...(preset.id === 'ring' ? ['wall'] : preset.id === 'cup' ? ['height','wall'] : ['height', 'depth']), ...(preset.id === 'star' ? ['point'] : [])];
  return ['width', 'height', 'depth', 'eyeSize', ...(preset.id === 'monster' ? [] : ['eyeGap']), 'cheekSize', ...(['kirby', 'doraemon', 'penguin'].includes(preset.id) ? [] : ['earLength']), 'armSize', 'feetSize'];
}

// 수치와 Python 표기를 함께 운반하는 작은 식입니다. eval은 쓰지 않습니다.
const number = n => ({ value: Number(n), code: String(Number(Number(n).toFixed(6))) });
const expr = v => typeof v === 'number' ? number(v) : v;
function binary(a, b, sign, fn) { a = expr(a); b = expr(b); return { value: fn(a.value, b.value), code: `(${a.code} ${sign} ${b.code})` }; }
const add = (a,b) => binary(a,b,'+', (a,b) => a+b), sub = (a,b) => binary(a,b,'-', (a,b) => a-b);
const mul = (a,b) => binary(a,b,'*', (a,b) => a*b), div = (a,b) => binary(a,b,'/', (a,b) => a/b);
const neg = a => mul(a,-1);
const vector = (x,y,z) => { const a = [x,y,z].map(expr); return { value: a.map(x => x.value), code: `vector(${a.map(x => x.code).join(', ')})` }; };
export function hexVector(hex) { return [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255); }
// 메인의 CSS 색은 sRGB입니다. 새 모양의 VPython 색도 같은 선형 값으로 맞춥니다.
export function forgeColorVector(recipe,hex){return recipe.appearance==='welcome-v1'?welcomeColorVector(hex):hexVector(hex);}


export function buildForgeModel(input) {
  const recipe = validateRecipe(input), preset = forgePresets.find(p => p.id === recipe.presetId);
  const parts = [], derived = [];
  const values = Object.fromEntries(Object.entries(recipe.params).map(([k,v]) => [k,{ value:v, code:forgeParameters[k].variable }]));
  const { width:w, height:h, depth:d, eyeSize:eye, eyeGap:gap, earLength:ear, armSize:arm, feetSize:foot, cheekSize:cheek } = values;
  const colors = { body: forgeColorVector(recipe,recipe.colors[0]), accent: forgeColorVector(recipe,recipe.colors[1]), white:[1,.985,.96], ink:[.09,.12,.18], blush:[1,.6,.7], gold:[1,.78,.25] };
  const paint = color => ({ value: typeof color === 'string' ? colors[color] : color, code: typeof color === 'string' && ['body','accent'].includes(color) ? color+'_color' : `vector(${(typeof color === 'string' ? colors[color] : color).map(x => number(x).code).join(', ')})` });
  const derivedValue = (name, value) => { derived.push(`${name} = ${value.code}`); return { ...value, code:name }; };
  const part = (name, type, props, color='body') => { const p = { name:name.replaceAll('-','minus'),type,props:{ ...props,color:paint(color) } };parts.push(p);return p; };
  const egg = (name,x,y,z,sx,sy,sz,color='body') => part(name,'ellipsoid',{pos:vector(x,y,z),size:vector(sx,sy,sz)},color);
  const sphere = (name,x,y,z,r,color='body',extra={}) => part(name,'sphere',{pos:vector(x,y,z),radius:expr(r),...extra},color);
  const cone = (name,x,y,z,r,length,color='body') => part(name,'cone',{pos:vector(x,y,z),axis:vector(0,length,0),radius:expr(r)},color);
  const front = (x,y,offset=.035) => {
    const a=div(x,mul(w,.5)),b=div(y,mul(h,.5));
    const inside=sub(sub(1,mul(a,a)),mul(b,b));
    const root={value:Math.sqrt(Math.max(.05,inside.value)),code:`sqrt(max(0.05, ${inside.code}))`};
    return add(mul(mul(d,.5),root),preset.id==='doraemon'?mul(d,.13):offset);
  };
  const welcomeKirby=preset.id==='kirby'&&recipe.appearance==='welcome-v1';
  if (preset.kind === 'character') {
    if (welcomeKirby) {
      // 메인 화면의 부품을 기준으로 슬라이더와 Python 수식을 함께 만듭니다.
      const reference=pinkReference,base=reference.find(p=>p.name==='body'),diameter=base.radius*2;
      const bodyScale=[div(w,diameter),div(h,diameter),div(d,diameter)];
      const featureScale=p=>p.name.includes('foot')?div(foot,preset.params.feetSize):p.name.includes('hand')?div(arm,preset.params.armSize):p.name.startsWith('cheek')?div(cheek,preset.params.cheekSize):expr(1);
      const eyeScale=div(eye,preset.params.eyeSize),eyeFrames=new Map();
      const component=(v,i)=>({value:v.value[i],code:`${v.code}.${'xyz'[i]}`});
      const unit=(name,v)=>{const length=Math.hypot(...v.value),result={value:v.value.map(n=>n/length),code:name};derived.push(`${name} = norm(${v.code})`);return result;};
      const crossVector=(name,a,b)=>{const [x,y,z]=a.value,[u,v,t]=b.value,result={value:[y*t-z*v,z*u-x*t,x*v-y*u],code:name};derived.push(`${name} = cross(${a.code}, ${b.code})`);return result;};
      for(const side of [-1,1]){
        const ref=reference.find(p=>p.name==='eye_'+side),center=ref.pos.map(n=>n*base.radius/Math.hypot(...ref.pos));
        const x=mul(mul(center[0],bodyScale[0]),div(gap,preset.params.eyeGap)),y=mul(center[1],bodyScale[1]),z=front(x,y,0),name=side<0?'left':'right';
        const normal=unit(name+'_eye_normal',vector(div(x,mul(w,w)),div(y,mul(h,h)),div(z,mul(d,d))));
        const axis=unit(name+'_eye_axis',vector(component(normal,2),0,neg(component(normal,0)))),up=crossVector(name+'_eye_up',normal,axis);
        eyeFrames.set(side,{referenceCenter:center,reference:ref,center:[x,y,z],normal,axis,up});
      }
      for(const p of reference){
        if(p.name.startsWith('cheek')&&cheek.value<=.005)continue;
        const color=p.name==='body'||p.name.includes('hand')?'body':p.name.includes('foot')?'accent':forgeColorVector(recipe,p.color);
        let props;
        if(p.name==='body')props={pos:vector(0,0,0),size:vector(w,h,d)};
        else if(p.name.startsWith('eye')){
          if(recipe.expression==='sleepy'&&!/^eye_-?1$/.test(p.name))continue;
          const side=p.name.endsWith('_-1')?-1:1,frame=eyeFrames.get(side),delta=p.pos.map((n,i)=>n-frame.referenceCenter[i]);
          const dot=v=>v.reduce((sum,n,i)=>sum+n*delta[i],0),axisOffset=dot(frame.reference.axis),upOffset=dot(frame.reference.up),normalOffset=delta.reduce((sum,n,i)=>sum+n*frame.referenceCenter[i]/base.radius,0);
          const pos=frame.center.map((c,i)=>add(add(add(c,mul(component(frame.axis,i),mul(axisOffset,eyeScale))),mul(component(frame.up,i),mul(upOffset,eyeScale))),mul(component(frame.normal,i),mul(normalOffset,eyeScale))));
          props={pos:vector(...pos),size:vector(...p.size.map((n,i)=>mul(n,recipe.expression==='sleepy'&&i===1?mul(eyeScale,.18):eyeScale))),axis:frame.axis,up:frame.up};
        }else{
          const scale=featureScale(p),pos=p.pos.map((n,i)=>mul(n,bodyScale[i])),size=p.size.map(n=>mul(n,scale));
          if(p.name==='mouth'||p.name==='tongue'){
            if(recipe.expression==='surprise'){size[0]=mul(size[0],1.55);size[1]=mul(size[1],1.8);}
            if(recipe.expression==='sleepy'){if(p.name==='tongue')continue;size[1]=mul(size[1],.25);}
          }
          props={pos:vector(...pos),size:vector(...size)};
          if(p.angle){props.axis=vector(Math.cos(p.angle),Math.sin(p.angle),0);props.up=vector(-Math.sin(p.angle),Math.cos(p.angle),0);}
        }
        if(props.axis){const direction=props.axis,length=props.size.value[0];props.axis={value:direction.value.map(v=>v*length),code:`${direction.code} * ${props.size.code}.x`};}
        part(p.name,'ellipsoid',{...props,shininess:expr(.28)},color);
      }
    } else {
    egg('body',0,0,0,w,h,d);
    if (preset.id === 'doraemon') {
      egg('face_patch',0,mul(h,-.06),mul(d,.4),mul(w,.85),mul(h,.8),mul(d,.27),'white');
      egg('torso',0,mul(h,-.68),0,mul(w,.72),mul(h,.65),mul(d,.73));
      egg('belly',0,mul(h,-.68),mul(d,.32),mul(w,.5),mul(h,.45),mul(d,.16),'white');
      part('collar','cylinder',{pos:vector(mul(w,-.34),mul(h,-.44),0),axis:vector(mul(w,.68),0,0),radius:mul(h,.07)},'accent');
      sphere('bell',0,mul(h,-.49),mul(d,.42),mul(w,.08),'gold');
      sphere('nose',0,mul(h,.015),mul(d,.64),mul(w,.075),'accent');
    } else if (['penguin','bear','fox'].includes(preset.id)) egg('belly',0,mul(h,-.08),mul(d,.39),mul(w,.72),mul(h,.78),mul(d,.22),'white');
    const limbY = mul(h,preset.id==='doraemon'?-.72:-.15), feetY=mul(h,preset.id==='doraemon'?-1.02:-.48);
    for (const side of [-1,1]) {
      egg(side<0?'left_arm':'right_arm',mul(side,add(mul(w,.46),mul(arm,.15))),limbY,0,arm,mul(arm,.7),mul(arm,.8));
      egg(side<0?'left_foot':'right_foot',mul(w,side*.27),feetY,mul(d,.12),foot,mul(foot,.6),mul(foot,1.3),preset.id==='chiikawa'?'body':'accent');
      if (['rabbit','chiikawa','bear'].includes(preset.id)) {
        const length=preset.id==='bear'?mul(ear,.8):ear;
        const x=mul(w,side*.31),y=add(mul(h,.4),mul(length,.32));
        egg(side<0?'left_ear':'right_ear',x,y,0,mul(w,.24),length,mul(d,.3));
        if(preset.id!=='chiikawa')egg(side<0?'left_inner_ear':'right_inner_ear',x,y,mul(d,.14),mul(w,.12),mul(length,.64),.06,'accent');
      }
      if (['cat','monster'].includes(preset.id)) cone(side<0?'left_ear':'right_ear',mul(w,side*.3),mul(h,.35),0,mul(w,.19),ear,preset.id==='monster'?'white':'body');
      if(cheek.value>.005 && preset.id!=='monster'){
        const x=mul(w,side*.32),y=mul(h,-.08);
        egg(side<0?'left_cheek':'right_cheek',x,y,front(x,y),cheek,mul(cheek,.5),.05,'blush');
      }
    }
    const eyeX = derivedValue('eye_x',mul(w,gap)), eyeY=derivedValue('eye_y',mul(h,.12));
    for (const side of preset.id==='monster'?[0]:[-1,1]) {
      const x=mul(eyeX,side),z=front(x,eyeY,.045),sleep=recipe.expression==='sleepy';
      if(preset.id==='doraemon'||preset.id==='monster')egg(`eye_white_${side}`,x,eyeY,z,mul(eye,2),mul(eye,2.6),mul(eye,.65),'white');
      egg(`eye_${side}`,x,eyeY,add(z,(preset.id==='doraemon'||preset.id==='monster')?mul(eye,.36):0),eye,mul(eye,sleep?.28:1.65),mul(eye,.52),'ink');
      if(!sleep)sphere(`eye_shine_${side}`,sub(x,mul(eye,.12)),add(eyeY,mul(eye,.35)),add(z,mul(eye,.36+(preset.id==='doraemon'||preset.id==='monster'?.36:0))),mul(eye,.16),'white');
    }
    const mouthY=mul(h,-.18),mouthZ=front(0,mouthY,.055);
    if(preset.id==='penguin')part('beak','cone',{pos:vector(0,mouthY,mouthZ),axis:vector(0,0,mul(w,.17)),radius:mul(w,.08)},'accent');
    else if(recipe.expression==='surprise')egg('mouth',0,mouthY,mouthZ,mul(w,.12),mul(h,.13),.07,'ink');
    else for(const side of [-1,1])egg(`smile_${side}`,mul(w,side*.035),add(mouthY,mul(h,.015)),mouthZ,mul(w,.085),mul(h,.025),.06,'ink');
    if(preset.id==='cat')egg('tail',mul(w,.48),mul(h,-.18),mul(d,-.36),mul(w,.24),mul(h,.9),mul(d,.25),'accent');
    }
    if(recipe.accessory==='hat'){
      egg('hat_brim',0,add(mul(h,.49),.03),0,mul(w,.9),.12,mul(d,.8),'accent');
      cone('hat_top',0,mul(h,.5),0,mul(w,.28),mul(h,.5),'accent');
    } else if(recipe.accessory==='bow'){
      for(const side of [-1,1])egg(`bow_${side}`,mul(w,side*.11),mul(h,.5),mul(d,.21),mul(w,.25),mul(h,.15),.15,'accent');
      sphere('bow_knot',0,mul(h,.5),mul(d,.24),mul(w,.07),'gold');
    } else if(recipe.accessory==='antenna'){
      part('antenna','cylinder',{pos:vector(0,mul(h,.46),0),axis:vector(0,mul(h,.4),0),radius:expr(.04)},'accent');
      sphere('antenna_tip',0,mul(h,.88),0,.15,'gold');
    }
  } else if (preset.id === 'bell') {
    egg('bell_shell',0,0,0,w,h,w,'body');
    egg('bell_rim',0,mul(h,-.34),0,mul(w,1.13),mul(h,.21),mul(w,1.13),'body');
    sphere('clapper',0,mul(h,-.49),0,mul(w,.13),'accent');
    part('handle','ring',{pos:vector(0,mul(h,.55),0),axis:vector(0,0,1),radius:mul(w,.15),thickness:mul(w,.045)},'accent');
    if(recipe.bellMode==='waves')for(let i=0;i<3;i++)part('wave_'+i,'ring',{pos:vector(0,0,0),axis:vector(0,0,1),radius:mul(w,.3),thickness:expr(.025),visible:{value:false,code:'False'},opacity:expr(.6)},'accent').effect=true;
  } else if (preset.id === 'ring') {
    part('donut','ring',{pos:vector(0,0,0),axis:vector(0,0,1),radius:mul(w,.5),thickness:mul(w,values.wall)},'body');
  } else if (preset.id === 'dome') {
    // 같은 정규화 면을 Python의 vertex/triangle에도 전달합니다.
    const faces=[],n=12,rows=6,point=(i,j)=>[Math.sin(i*Math.PI/(2*rows))*Math.cos(j*2*Math.PI/n),Math.cos(i*Math.PI/(2*rows)),Math.sin(i*Math.PI/(2*rows))*Math.sin(j*2*Math.PI/n)];
    for(let i=0;i<rows;i++)for(let j=0;j<n;j++){
      faces.push([point(i,j),point(i+1,j+1),point(i+1,j)]);
      if(i>0)faces.push([point(i,j),point(i,j+1),point(i+1,j+1)]);
    }
    for(let j=0;j<n;j++)faces.push([[0,0,0],point(rows,j),point(rows,j+1)]);
    for(const [i,f] of faces.entries())part('dome_'+i,'triangle',{vertices:{value:f.map(p=>{const n=[p[0]/w.value,p[1]/h.value,p[2]/d.value],length=Math.hypot(...n);return {pos:[p[0]*w.value/2,p[1]*h.value/2-h.value/4,p[2]*d.value/2],normal:f.every(p=>Math.abs(p[1])<.000001)?[0,-1,0]:n.map(v=>v/length),color:colors.body};}),code:JSON.stringify(f.map(p=>p.map(v=>Number(v.toFixed(6))))) }},'body');
  } else {
    const profile=[];
    if(preset.id==='star')for(let i=0;i<10;i++){
      const angle=Math.PI/2+i*Math.PI/5,r=i%2?values.point:expr(1);
      profile.push([mul(mul(w,.5*Math.cos(angle)),r),mul(mul(h,.5*Math.sin(angle)),r)]);
    }
    if(preset.id==='heart')for(let i=0;i<48;i++){
      const t=i*2*Math.PI/48;
      profile.push([mul(w,.5*Math.sin(t)**3),mul(h,(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))/34)]);
    }
    if(preset.id==='cup'){
      const contour=r=>Array.from({length:33},(_,i)=>[mul(mul(w,.5*Math.cos(i*2*Math.PI/32)),r),mul(mul(w,.5*Math.sin(i*2*Math.PI/32)),r)]);
      const outer=contour(expr(1)),inner=contour(sub(1,values.wall)).reverse();
      const shape={value:[outer.map(p=>p.map(e=>e.value)),inner.map(p=>p.map(e=>e.value))],code:`[${[outer,inner].map(c=>'['+c.map(p=>'['+p.map(e=>e.code).join(', ')+']').join(', ')+']').join(', ')}]`};
      const path={value:[[0,-h.value/2,0],[0,h.value/2,0]],code:`[vector(0, -body_height/2, 0), vector(0, body_height/2, 0)]`};
      part('cup_wall','extrusion',{pos:vector(0,0,0),path,shape},'body');
      part('cup_base','cylinder',{pos:vector(0,neg(div(h,2)),0),axis:vector(0,.1,0),radius:div(w,2)},'body');
    } else {
      const path={value:[[0,0,-d.value/6],[0,0,d.value/6]],code:'[vector(0, 0, -body_depth/6), vector(0, 0, body_depth/6)]'};
      const shape={value:profile.map(p=>p.map(e=>e.value)),code:'['+profile.map(p=>'['+p.map(e=>e.code).join(', ')+']').join(', ')+']'};
      part(preset.id,'extrusion',{pos:vector(0,0,0),path,shape},'body');
    }
  }
  return {recipe,preset,parts,derived,range:preset.id==='doraemon'?3.1:welcomeKirby?2.5:3,center:preset.id==='doraemon'?[0,-.6,0]:welcomeKirby?[0,.08,0]:[0,.15,0]};
}

export function forgeCommands(model) {
  return model.parts.map(p=>({action:'create',id:'forge_'+p.name,type:p.type,...Object.fromEntries(Object.entries(p.props).map(([key,v])=>[key,v.value]))}));
}
