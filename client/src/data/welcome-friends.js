// 화면과 Python 체험이 같은 기본 도형 명세를 사용합니다. 이름은 아직 정하지 않았습니다.
const text=(ko,en)=>({ko,en});
export const welcomeFriends=[
  {id:'dumpling',label:text('만두 친구','Dumpling'),color:'#ffe4b9',line:text('작은 코드부터, 같이 만들어 볼까?','Let’s make something with a little code!')},
  {id:'flashlight',label:text('손전등 친구','Flashlight'),color:'#b8b2ee',line:text('궁금한 곳을 코드로 비춰 보자!','Let’s shine a light on a new idea!')},
  {id:'toolbox',label:text('공구상자 친구','Toolbox'),color:'#f59282',line:text('만들고, 움직이고, 함께 고쳐 보자!','Let’s build, move, and improve it together!')},
  {id:'kirby',label:text('분홍 친구','Pink friend'),color:'#f5a4c2',line:text('반가워! 같이 만들어 볼까?','Hello! Let’s make something together!')},
];
export const welcomeLighting={
  dumpling:{left:'#ffd393',right:'#f4b8ac',label:text('따뜻한 금빛','Warm golden light')},
  flashlight:{left:'#a4c9ff',right:'#fff0a6',label:text('파랑·레몬빛','Blue and lemon light')},
  toolbox:{left:'#ffb48b',right:'#97ddce',label:text('살구·청록빛','Apricot and mint light')},
  kirby:{left:'#f4afd6',right:'#c4b7ff',label:text('분홍·보랏빛','Pink and violet light')},
};
const ink='#293342',cheek='#f3a6ae',mint='#a7d7c4';
export function welcomeParts(id='dumpling'){
  const parts=[];
  const egg=(name,pos,size,color,angle=0)=>parts.push({name,type:'ellipsoid',pos,size,color,angle});
  const solid=(name,type,props,color)=>parts.push({name,type,...props,color});
  if(id==='kirby'){
    const pink='#f5a4c2';
    solid('body','sphere',{pos:[0,0,0],radius:.86},pink);
    egg('left_foot',[-.38,-.81,.16],[.62,.33,.8],'#df3460');egg('right_foot',[.38,-.81,.16],[.62,.33,.8],'#df3460');
    egg('left_hand',[-.88,-.07,0],[.46,.46,.46],pink);egg('right_hand',[.86,.13,0],[.43,.5,.5],pink,-.6);
    for(const side of [-1,1]){
      // 큰 눈이 둥근 몸 표면을 따라가도록 가로축과 위쪽 축을 맞춥니다.
      const x=side*.235,y=.32,z=Math.sqrt(.86**2-x*x-y*y),normal=[x/.86,y/.86,z/.86];
      const horizontal=Math.hypot(z,x),axis=[z/horizontal,0,-x/horizontal];
      const up=[normal[1]*axis[2],normal[2]*axis[0]-normal[0]*axis[2],-normal[1]*axis[0]];
      const eyePart=(name,offset,size,color)=>{
        const pos=[x,y,z].map((v,i)=>v+axis[i]*offset[0]+up[i]*offset[1]+normal[i]*offset[2]);
        egg(name,pos,size,color);Object.assign(parts.at(-1),{axis,up});
      };
      eyePart('eye_'+side,[0,0,.018],[.255,.48,.105],'#181d34');
      eyePart('eye_blue_'+side,[0,-.135,.068],[.17,.15,.018],'#2456b3');
      eyePart('eye_shine_'+side,[-.018,.115,.066],[.115,.14,.02],'#ffffff');
      egg('cheek_'+side,[side*.48,0,.718],[.21,.08,.035],'#eb759e');
    }
    egg('mouth',[0,-.18,.844],[.16,.18,.04],'#813652');
    egg('tongue',[0,-.215,.866],[.085,.045,.02],'#f4a1bc');
    return parts;
  }
  let faceY=0,faceZ=.54,feetY=-.83;
  if(id==='flashlight'){
    solid('body','cylinder',{pos:[0,-.73,0],axis:[0,1.4,0],radius:.46},'#b8b2ee');
    solid('head','cone',{pos:[0,1.05,0],axis:[0,-.55,0],radius:.69},'#a69de4');
    solid('light','cylinder',{pos:[0,1.05,0],axis:[0,.045,0],radius:.65},'#fff2bf');
    solid('rim','ring',{pos:[0,1.09,0],axis:[0,1,0],radius:.67,thickness:.035},'#8b81c5');
    solid('switch','box',{pos:[0,-.43,.47],size:[.19,.25,.09]},'#ffe4a3');
    faceY=.16;faceZ=.465;feetY=-.84;
  }else if(id==='toolbox'){
    solid('handle','ring',{pos:[0,.83,0],axis:[0,0,1],radius:.32,thickness:.085},'#eacb7e');
    solid('body','box',{pos:[0,-.04,0],size:[1.55,1.05,.85]},'#f59282');
    egg('left_edge',[-.76,-.04,0],[.22,1.05,.85],'#f59282');egg('right_edge',[.76,-.04,0],[.22,1.05,.85],'#f59282');
    solid('lid','box',{pos:[0,.47,0],size:[1.8,.26,.98]},'#f8a18e');
    solid('clasp','box',{pos:[0,.35,.53],size:[.32,.28,.12]},'#f2d28a');
    faceY=-.07;faceZ=.44;feetY=-.72;
  }else{
    egg('body',[0,-.12,0],[1.85,1.36,1.1],'#ffe4b9');
    for(let i=-2;i<=2;i++)egg('fold_'+(i+2),[i*.21,.43+(2-Math.abs(i))*.055,0],[.18,.43,.66],'#f8d6a4',-i*.16);
  }
  egg('left_foot',[-.39,feetY,.09],[.32,.22,.43],mint);egg('right_foot',[.39,feetY,.09],[.32,.22,.43],mint);
  const armX=id==='flashlight'?.57:.96;
  egg('left_hand',[-armX,-.22,0],[.22,.48,.24],id==='flashlight'?'#b8b2ee':mint,-.48);
  egg('right_hand',[armX,.25,0],[.23,.55,.25],id==='flashlight'?'#b8b2ee':mint,-.5);
  for(const side of [-1,1]){
    egg('eye_'+side,[side*.25,faceY+.12,faceZ],[.105,.145,.045],ink);
    egg('cheek_'+side,[side*.43,faceY-.055,faceZ-.035],[.21,.115,.035],cheek);
  }
  const points=Array.from({length:25},(_,i)=>[-.12*Math.cos(i*Math.PI/24),faceY-.09-.08*Math.sin(i*Math.PI/24),faceZ+.02]);
  points.forEach((pos,i)=>{
    solid('smile_joint_'+i,'sphere',{pos,radius:.012},ink);
    if(i)solid('smile_link_'+i,'cylinder',{pos:points[i-1],axis:pos.map((v,j)=>v-points[i-1][j]),radius:.012},ink);
  });
  return parts;
}
export const welcomeWaveAngle=frame=>{let angle=0;for(let i=0;i<=frame;i++)angle+=.024*Math.cos(i*Math.PI/12);return angle;};
export const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const n=value=>Number(value.toFixed(5));
const vec=values=>'vector('+values.map(n).join(', ')+')';
export const welcomeTogether={id:'friends',label:text('프렌즈','Friends'),line:text('친구들과 함께 통통!','A little bounce with friends!')};
export const welcomeTogetherLighting={left:'#abd6ee',right:'#f7c4ba',label:text('함께 빛나는 무대','A stage for everyone')};
export const welcomeLayout=()=>welcomeFriends.map((f,i)=>{
  const minY=Math.min(...welcomeParts(f.id).filter(p=>p.name.endsWith('_foot')).map(p=>p.pos[1]-p.size[1]/2));
  return{id:f.id,scale:.43,origin:[(i-1.5)*.82,-.80-minY*.43,0]};
});
export const welcomeBounce=(time,index)=>.24*Math.abs(Math.sin(time*5+index*Math.PI/4))*Math.max(0,Math.min(1,time/.3,(6-time)/.5));
function welcomeDefinition(id){
  const parts=welcomeParts(id),lines=['def make_'+id+'(origin=None, scale=1):','    origin = vector(0,0,0) if origin is None else origin'];
  for(const part of parts.filter(p=>!p.name.startsWith('smile_'))){
    const props=Object.entries(part).filter(([key])=>!['name','type','angle'].includes(key)).map(([key,value])=>{
      let expression;
      if(key==='color')expression=vec(rgb(value));
      else if(key==='pos')expression='origin+'+vec(value)+'*scale';
      else if(Array.isArray(value))expression=vec(value)+(['size','axis'].includes(key)?'*scale':'');
      else expression=String(value)+(['radius','thickness'].includes(key)?'*scale':'');
      return key+'='+expression;
    });
    const name=part.name.replaceAll('-','minus');lines.push('    '+name+' = '+part.type+'('+props.join(', ')+')');
    if(part.angle)lines.push('    '+name+'.rotate(angle='+part.angle+', axis=vector(0,0,1))');
  }
  const mouth=parts.find(p=>p.name==='smile_joint_0');
  if(mouth)lines.push('    # curve는 compound에 넣을 수 없어, 구와 원기둥으로 매끄럽게 잇습니다.',
    '    mouth = []','    previous = None','    for i in range(25):','        angle = i*pi/24',
    '        point = origin + vector(-0.12*cos(angle), '+n(mouth.pos[1])+'-0.08*sin(angle), '+n(mouth.pos[2])+')*scale',
    '        mouth.append(sphere(pos=point, radius=0.012*scale, color='+vec(rgb(ink))+'))',
    '        if previous is not None:', '            mouth.append(cylinder(pos=previous, axis=point-previous, radius=0.012*scale, color='+vec(rgb(ink))+'))',
    '        previous = point');
  lines.push('    return compound(['+parts.filter(p=>!p.name.startsWith('smile_')).map(p=>p.name.replaceAll('-','minus')).join(', ')+']'+(mouth?' + mouth':'')+')');
  return lines.join('\n');
}
export function welcomeCode(id='dumpling'){
  const together=id==='friends',lighting=together?welcomeTogetherLighting:welcomeLighting[id]||welcomeLighting.dumpling;
  const lines=['from vpython import *','from math import cos, sin, pi','scene.range = '+(together?'2.1':'1.8'),'scene.center = vector(0, 0.05, 0)','scene.forward = vector(-0.12, -0.06, -1)',
    'local_light(pos=vector(-2,3,2), color='+vec(rgb(lighting.left))+')','local_light(pos=vector(2,2,1), color='+vec(rgb(lighting.right))+')',''];
  for(const f of together?welcomeFriends:[{id}])lines.push(welcomeDefinition(f.id),'');
  if(together){
    lines.push('# 각 friend는 독립된 compound, friends는 함께 다루는 목록입니다.','friends = [',...welcomeLayout().map(f=>'    make_'+f.id+'(origin='+vec(f.origin)+', scale='+f.scale+'),'),']',
      'bases = [vector(f.pos.x, f.pos.y, f.pos.z) for f in friends]',
      'for frame in range(180):','    rate(30)','    time = frame / 30','    for i, friend in enumerate(friends):','        fade = min(1, time/0.3, (6-time)/0.5)','        bounce = 0.24 * abs(sin(time*5 + i*pi/4)) * fade','        friend.pos = bases[i] + vector(0,bounce,0)',
      'for friend, base in zip(friends, bases):','    friend.pos = base');
  }else{
    lines.push('# 완제품 하나를 만듭니다. friend.pos로 통째로 움직일 수 있습니다.','friend = make_'+id+'()',
      '# friend.pos.x += 0.1', '# 완제품이 살짝 기울며 인사합니다.',
      'for frame in range(72):','    rate(30)','    angle = 0.024 * cos(frame * pi / 12)',
      '    friend.rotate(angle=angle, axis=vector(0,0,1), origin=vector(0,0,0))');
  }
  return lines.join('\n')+'\n';
}
export const welcomeTutorial={id:'welcome-friend',kind:'lab',duration:text('3~5분 · 기본 도형으로 인사하기','3–5 min · Say hello with shapes'),title:text('첫 화면의 친구를 내 코드로','Build the welcome friend with code'),description:text('만두·손전등·공구상자·분홍 친구를 기본 도형으로 만들고 완제품으로 묶고 인사해 봅니다.','Build a dumpling, flashlight, toolbox, or pink friend with simple shapes and combine the parts into one moving character.'),change:text('도형 한 줄의 color나 발의 size 중 하나를 바꾸고 다시 실행하세요.','Change one shape’s color or a foot’s size and run it again.'),reflect:text('friend.rotate의 angle을 바꾸면 인사가 어떻게 달라지나요?','How does changing the angle in friend.rotate change the wave?')};
export function getWelcomeTutorial(id,step){if(id!==welcomeTutorial.id)return undefined;const friend=step==='friends'?welcomeTogether:welcomeFriends.find(f=>f.id===step)||welcomeFriends[0];return {...welcomeTutorial,code:welcomeCode(friend.id),activeStep:friend.id,variants:[...welcomeFriends,welcomeTogether].map(f=>({id:f.id,title:f.label})),reflect:friend.id==='friends'?text('bounce의 0.24와 i*pi/4를 바꾸면 높이와 박자가 어떻게 달라지나요?','How do 0.24 and i*pi/4 change the bounce height and timing?'):welcomeTutorial.reflect,stepNote:friend.id==='friends'?text('각 friend는 compound입니다. friends 목록에서 하나씩 위치를 바꿉니다.','Each friend is a compound. Move each one independently through the friends list.'):text('이름은 아직 정하지 않았어요. 먼저 내 색과 모양으로 바꿔 보세요.','No name yet. Start by changing the shapes and colors.'),usesSound:false};}
