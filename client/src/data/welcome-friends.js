// 화면과 Python 체험이 같은 기본 도형 명세를 사용합니다. 이름은 아직 정하지 않았습니다.
const text=(ko,en)=>({ko,en});
export const welcomeFriends=[
  {id:'dumpling',label:text('만두 친구','Dumpling'),color:'#ffe4b9',line:text('작은 코드부터, 같이 만들어 볼까?','Let’s make something with a little code!')},
  {id:'flashlight',label:text('손전등 친구','Flashlight'),color:'#b8b2ee',line:text('궁금한 곳을 코드로 비춰 보자!','Let’s shine a light on a new idea!')},
  {id:'toolbox',label:text('공구상자 친구','Toolbox'),color:'#f59282',line:text('만들고, 움직이고, 함께 고쳐 보자!','Let’s build, move, and improve it together!')},
  {id:'cloud',label:text('구름 친구','Cloud'),color:'#e4e6ff',line:text('처음이어도 괜찮아. 하나씩 해 보자!','New to coding? Let’s try one thing at a time!')},
];
const ink='#293342',cheek='#f3a6ae',mint='#a7d7c4';
export function welcomeParts(id='dumpling'){
  const parts=[];
  const egg=(name,pos,size,color,angle=0)=>parts.push({name,type:'ellipsoid',pos,size,color,angle});
  const solid=(name,type,props,color)=>parts.push({name,type,...props,color});
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
  }else if(id==='cloud'){
    egg('top',[0,.33,0],[1.22,1.32,1.03],'#f3f2ff');
    egg('left_puff',[-.56,-.02,0],[1.04,1.0,.98],'#f3f2ff');egg('right_puff',[.56,-.02,0],[1.04,1.0,.98],'#f3f2ff');
    egg('base',[0,-.28,0],[1.8,.63,1.02],'#f3f2ff');faceY=-.08;faceZ=.525;feetY=-.7;
  }else{
    egg('body',[0,-.12,0],[1.85,1.36,1.1],'#ffe4b9');
    for(let i=-2;i<=2;i++)egg('fold_'+(i+2),[i*.21,.43+(2-Math.abs(i))*.055,0],[.18,.43,.66],'#f8d6a4',-i*.16);
  }
  egg('left_foot',[-.39,feetY,.09],[.32,.22,.43],mint);egg('right_foot',[.39,feetY,.09],[.32,.22,.43],mint);
  const armX=id==='flashlight'?.57:id==='cloud'?1.05:.96;
  egg('left_hand',[-armX,-.22,0],[.22,.48,.24],id==='flashlight'?'#b8b2ee':mint,-.48);
  egg('right_hand',[armX,.25,0],[.23,.55,.25],id==='flashlight'?'#b8b2ee':mint,-.5);
  for(const side of [-1,1]){
    egg('eye_'+side,[side*.25,faceY+.12,faceZ],[.105,.145,.045],ink);
    egg('cheek_'+side,[side*.43,faceY-.055,faceZ-.035],[.21,.115,.035],cheek);
  }
  parts.push({name:'smile',type:'curve',pos:[[-.12,faceY-.09,faceZ+.015],[-.07,faceY-.15,faceZ+.02],[0,faceY-.17,faceZ+.02],[.07,faceY-.15,faceZ+.02],[.12,faceY-.09,faceZ+.015]],color:ink});
  return parts;
}
export const welcomeWaveAngle=frame=>{let angle=0;for(let i=0;i<=frame;i++)angle+=.06*Math.cos(i*Math.PI/12);return angle;};
export const welcomeWavePivot=id=>[id==='flashlight'?.51:id==='cloud'?.94:.85,.02,0];
export const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const n=value=>Number(value.toFixed(5));
const vec=values=>'vector('+values.map(n).join(', ')+')';
export function welcomeCode(id='dumpling'){
  const parts=welcomeParts(id),lines=['from vpython import *','from math import cos, pi','scene.range = 1.8','scene.center = vector(0, 0.05, 0)','scene.forward = vector(-0.12, -0.06, -1)','', '# 몸통·볼·손발의 색을 바꾸고 실행해 보세요.'];
  for(const part of parts){
    const props=Object.entries(part).filter(([key])=>!['name','type','angle'].includes(key)).map(([key,value])=>key+'='+ (key==='color'?vec(rgb(value)):key==='pos'&&part.type==='curve'?'['+value.map(vec).join(', ')+']':Array.isArray(value)?vec(value):value));
    lines.push(part.name.replaceAll('-','minus')+' = '+part.type+'('+props.join(', ')+')');
    if(part.angle)lines.push(part.name+'.rotate(angle='+part.angle+', axis=vector(0, 0, 1))');
  }
  lines.push('', '# 손을 조금씩 돌려 인사합니다. 반복 횟수와 각도를 바꿔 보세요.', 'for frame in range(72):','    rate(30)','    angle = 0.06 * cos(frame * pi / 12)','    right_hand.rotate(angle=angle, axis=vector(0, 0, 1),', '                      origin='+vec(welcomeWavePivot(id))+')');
  return lines.join('\n')+'\n';
}
export const welcomeTutorial={id:'welcome-friend',kind:'lab',duration:text('3~5분 · 기본 도형으로 인사하기','3–5 min · Say hello with shapes'),title:text('첫 화면의 친구를 내 코드로','Build the welcome friend with code'),description:text('만두·손전등·공구상자·구름을 기본 도형으로 만들고 손을 흔들어 봅니다.','Build a dumpling, flashlight, toolbox, or cloud with simple shapes and make it wave.'),change:text('도형 한 줄의 color나 발의 size 중 하나를 바꾸고 다시 실행하세요.','Change one shape’s color or a foot’s size and run it again.'),reflect:text('right_hand.rotate의 angle을 바꾸면 인사가 어떻게 달라지나요?','How does changing the angle in right_hand.rotate change the wave?')};
export function getWelcomeTutorial(id,step){if(id!==welcomeTutorial.id)return undefined;const friend=welcomeFriends.find(f=>f.id===step)||welcomeFriends[0];return {...welcomeTutorial,code:welcomeCode(friend.id),activeStep:friend.id,variants:welcomeFriends.map(f=>({id:f.id,title:f.label})),stepNote:text('이름은 아직 정하지 않았어요. 먼저 내 색과 모양으로 바꿔 보세요.','No name yet. Start by changing the shapes and colors.'),usesSound:false};}
