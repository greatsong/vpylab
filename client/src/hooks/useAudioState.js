import { useSyncExternalStore } from 'react';
import { getAudioState, subscribeAudioState } from '../engine/sound-system';
export default function useAudioState(){return useSyncExternalStore(subscribeAudioState,getAudioState,getAudioState);}
