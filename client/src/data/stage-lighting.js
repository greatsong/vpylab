export const STAGE_LIGHT_RANGES={position:[[-2.5,2.5],[.6,2.6],[-2,2.5]],rotation:[[-45,45],[-45,45],[-45,45]],size:[.5,1.8],brightness:[0,2]};
export const defaultStageLights=()=>[-1,1].map(side=>({position:[side*1.58,1.65,.4],rotation:[0,0,0],size:1,brightness:1,color:null}));
const clamp=(value,range,fallback)=>Number.isFinite(value)?Math.max(range[0],Math.min(range[1],value)):fallback;
export function normalizeStageLights(value){
 if(!Array.isArray(value))return null;
 return defaultStageLights().map((base,i)=>{const source=value[i]||{};return{position:base.position.map((v,j)=>clamp(source.position?.[j],STAGE_LIGHT_RANGES.position[j],v)),rotation:base.rotation.map((v,j)=>clamp(source.rotation?.[j],STAGE_LIGHT_RANGES.rotation[j],v)),size:clamp(source.size,STAGE_LIGHT_RANGES.size,1),brightness:clamp(source.brightness,STAGE_LIGHT_RANGES.brightness,1),color:/^#[0-9a-f]{6}$/i.test(source.color||'')?source.color:null};});
}
export function lightHue(hex){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),[r,g,b]=rgb,max=Math.max(...rgb),d=max-Math.min(...rgb);if(!d)return 0;const h=max===r?(g-b)/d:max===g?(b-r)/d+2:(r-g)/d+4;return(h*60+360)%360;}
export function lightColorFromHue(hue){const h=((hue%360)+360)%360/60,c=.7*(1-Math.abs(2*.7-1)),x=c*(1-Math.abs(h%2-1)),m=.7-c/2;const channels=h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];return'#'+channels.map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('');}
