import { describe, expect, it } from 'vitest';
import { lightSoundLabs } from './light-sound-labs';
import { getTutorial } from './tutorials';
import { hasPython, runPythonJobs } from '../test/python-runner';

describe.skipIf(!hasPython())('빛과 소리 대표 작품', () => {
  it('모든 단계는 자동 연주 없이 열리고 버튼과 키보드에서 음·모양이 함께 바뀐다', () => {
    const jobs = lightSoundLabs.flatMap(lab => lab.variants.flatMap(stage => [
      { id: lab.id, label: stage.id, code: stage.code },
      { id: lab.id, label: stage.id + '-play', code: stage.code + (lab.id === 'space-instrument' ? '\nselect_note(1)\n' : '\nperform(None)\n') },
    ]));
    jobs.push({ id: 'space-instrument', label: 'keyboard', code: lightSoundLabs[0].code, events: [{ name: 'keydown', key: 'D' }, { name: 'keydown', key: 'x' }] });
    const runs = runPythonJobs(jobs);
    for (const run of runs.values()) {
      expect(run.error, run.id + ':' + run.label).toBeNull();
      expect(run.pendingTasks).toBe(0);
      const sounds = run.commands.filter(command => command.action === 'sound');
      const playing = run.label.endsWith('-play') || run.label === 'keyboard';
      expect(sounds).toHaveLength(playing ? (run.id === 'space-instrument' ? 1 : 8) : 0);
      if (playing) expect(run.commands.some(command => command.action === 'update' && command.emissive === true)).toBe(true);
    }
    expect(runs.get('space-instrument:demo-play').commands.find(command => command.action === 'sound').name).toBe('E4');
    expect(runs.get('space-instrument:modify-play').commands.find(command => command.action === 'sound').name).toBe('Eb4');
    expect(runs.get('space-instrument:keyboard').commands.find(command => command.action === 'sound').name).toBe('G4');
    expect(getTutorial('glow-arpeggio', 'modify').activeStep).toBe('modify');
  });
});
