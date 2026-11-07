import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { HOME_CHANGED, personalHomeKey, parsePersonalHome } from '../utils/personal-home';
export default function usePersonalHome(userId){
 const key=personalHomeKey(userId);
 const subscribe=useCallback(notify=>{const changed=e=>{if(e.type===HOME_CHANGED?e.detail?.key===key:e.key===key||e.key===null)notify();};window.addEventListener('storage',changed);window.addEventListener(HOME_CHANGED,changed);return()=>{window.removeEventListener('storage',changed);window.removeEventListener(HOME_CHANGED,changed);};},[key]);
 const snapshot=useCallback(()=>{try{return localStorage.getItem(key);}catch{return null;}},[key]);
 const raw=useSyncExternalStore(subscribe,snapshot,()=>null);
 return useMemo(()=>parsePersonalHome(raw),[raw]);
}
