import { welcomeParts, welcomeLayout } from '../../data/welcome-friends';
export default function StillFriend({id}){
 if(id==='friends')return <div className="welcome-still" style={{display:'flex',alignItems:'center'}}>{welcomeLayout().map(f=><div key={f.id} style={{width:'25%',position:'relative',height:'55%'}}><StillFriend id={f.id}/></div>)}</div>;
 const scale=90,x=v=>160+v*scale,y=v=>156-v*scale;
 return <svg viewBox="0 0 320 300" className="welcome-still" aria-hidden="true">
  <ellipse cx="160" cy="251" rx="90" ry="12" fill="#8ca59b" opacity=".13"/>
  {welcomeParts(id).map(p=>{
   const common={fill:p.color};
   if(p.type==='cylinder'&&p.name.startsWith('smile_'))return <line key={p.name} x1={x(p.pos[0])} y1={y(p.pos[1])} x2={x(p.pos[0]+p.axis[0])} y2={y(p.pos[1]+p.axis[1])} stroke={p.color} strokeWidth={p.radius*scale*2} strokeLinecap="round"/>;
   if(p.type==='sphere')return <circle key={p.name} {...common} cx={x(p.pos[0])} cy={y(p.pos[1])} r={p.radius*scale}/>;
   if(p.type==='ellipsoid')return <ellipse key={p.name} {...common} cx={x(p.pos[0])} cy={y(p.pos[1])} rx={p.size[0]*scale/2} ry={p.size[1]*scale/2} transform={`rotate(${-p.angle*180/Math.PI},${x(p.pos[0])},${y(p.pos[1])})`}/>;
   if(p.type==='box')return <rect key={p.name} {...common} x={x(p.pos[0]-p.size[0]/2)} y={y(p.pos[1]+p.size[1]/2)} width={p.size[0]*scale} height={p.size[1]*scale}/>;
   if(p.type==='ring')return <ellipse key={p.name} cx={x(p.pos[0])} cy={y(p.pos[1])} rx={p.radius*scale} ry={p.radius*scale*(p.axis[1]? .18:1)} fill="none" stroke={p.color} strokeWidth={p.thickness*scale*2}/>;
   if(p.type==='cone')return <path key={p.name} {...common} d={`M ${x(p.pos[0]-p.radius)} ${y(p.pos[1])} L ${x(p.pos[0]+p.radius)} ${y(p.pos[1])} L ${x(p.pos[0])} ${y(p.pos[1]+p.axis[1])} Z`}/>;
   return <rect key={p.name} {...common} x={x(p.pos[0]-p.radius)} y={y(p.pos[1]+p.axis[1])} width={p.radius*scale*2} height={Math.max(Math.abs(p.axis[1])*scale,5)}/>;
  })}
 </svg>;
}
