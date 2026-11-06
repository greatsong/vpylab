import { describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import * as THREE from 'three';
import { generateStandaloneHTML } from './export-html';
import course from '../data/light-sound-course';
import { hasPython, runPythonJobs } from '../test/python-runner';
import source from '../engine/student-code-transform.py?raw';
import CameraSystem from '../engine/camera-system';

function exportedApi(html) {
  const match = html.match(/const vpythonApi = (`[\s\S]*?`);/);
  expect(match).not.toBeNull();
  return runInNewContext(match[1]);
}

function finalObjects(commands) {
  const objects = new Map();
  for (const command of commands) {
    if (command.action === 'create') objects.set(command.id, { ...command });
    if (command.action === 'update' && objects.has(command.id)) Object.assign(objects.get(command.id), command);
  }
  return [...objects.values()].map(object => Object.fromEntries(
    ['id', 'type', 'pos', 'color', 'radius', 'emissive'].map(key => [key, object[key]]),
  ));
}

describe.skipIf(!hasPython())('교재 작품의 편집기와 공유 HTML 실행 비교', () => {
  it('8차시 작품의 최종 도형과 소리 순서·길이가 동일하다', () => {
    const jobs = course.lessons.map(lesson => ({ id: lesson.id, label: 'export', code: lesson.code }));
    const html = generateStandaloneHTML(jobs[0].code);
    const result = spawnSync('python3', ['-I', 'src/test/run-export-python.py'], {
      input: JSON.stringify({ api: exportedApi(html), transform: source, jobs }) + '\n',
      encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 15000,
    });
    expect(result.status, result.stderr).toBe(0);
    const editor = runPythonJobs(jobs);
    for (const exported of JSON.parse(result.stdout)) {
      const original = editor.get(`${exported.id}:export`);
      expect(exported.error, exported.id).toBeNull();
      expect(finalObjects(exported.commands), exported.id).toEqual(finalObjects(original.commands));
      const sounds = commands => commands.filter(command => command.action === 'sound');
      expect(sounds(exported.commands), exported.id).toEqual(sounds(original.commands));
      const range = commands => commands.filter(command => command.action === 'scene' && command.property === 'range');
      expect(range(exported.commands), exported.id).toEqual(range(original.commands));
      const background = commands => commands.filter(command => command.action === 'scene' && command.property === 'background');
      expect(background(exported.commands), exported.id).toEqual(background(original.commands));
    }
  });
});

function startExport(width, height) {
  document.body.innerHTML = '<div id="viewport"></div><div id="console"></div><div id="loading"></div><div id="progress"></div>';
  const html = generateStandaloneHTML(course.lessons[1].code);
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]
    .replace("import * as THREE from 'three';", '')
    .replace("import { OrbitControls } from 'three/addons/controls/OrbitControls.js';", '');
  const listeners = {};
  class Renderer {
    domElement = document.createElement('canvas');
    setSize() {}
    setPixelRatio() {}
    render() {}
  }
  class Controls {
    target = new THREE.Vector3();
    update() {}
  }
  const context = {
    THREE: { ...THREE, WebGLRenderer: Renderer }, OrbitControls: Controls, document,
    window: { addEventListener: (name, handler) => { listeners[name] = handler; } },
    navigator: {}, innerWidth: width, innerHeight: height, devicePixelRatio: 1,
    requestAnimationFrame: vi.fn(), console, setTimeout, clearTimeout,
  };
  runInNewContext(`${script}\nglobalThis.testExport = { camera, controls, processCmd };`, context);
  return { ...context.testExport, context, listeners };
}

describe('공유 페이지의 시야 범위', () => {
  it.each([[1440, 900], [390, 844]])('짧은 변의 절반이 scene.range가 되도록 카메라를 맞춘다 (%i×%i)', (width, height) => {
    const runtime = startExport(width, height);
    runtime.processCmd({ action: 'scene', property: 'range', value: 3 });
    const camera = runtime.camera;
    const halfHeight = camera.position.distanceTo(runtime.controls.target) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    expect(halfHeight * Math.min(1, camera.aspect)).toBeCloseTo(3);
    const editorCamera = camera.clone();
    const editorControls = { target: runtime.controls.target.clone() };
    const editor = new CameraSystem(editorCamera, editorControls, new THREE.Scene());
    editor.setExplicitRange(3);
    expect(camera.position.distanceTo(runtime.controls.target)).toBeCloseTo(editorCamera.position.distanceTo(editorControls.target));
    runtime.context.innerWidth = height;
    runtime.context.innerHeight = width;
    runtime.listeners.resize();
    const resizedHalfHeight = camera.position.distanceTo(runtime.controls.target) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    expect(resizedHalfHeight * Math.min(1, camera.aspect)).toBeCloseTo(3);
    editor.dispose();
  });

  it('화면 회전 후에도 사용자가 확대하고 회전한 방향과 중심을 유지한다', () => {
    const runtime = startExport(1440, 900);
    runtime.processCmd({ action: 'scene', property: 'range', value: 3 });
    runtime.controls.target.set(1, 2, 3);
    const direction = new THREE.Vector3(1, 1, 2).normalize();
    const distance = runtime.camera.position.length() / 2;
    runtime.camera.position.copy(runtime.controls.target).addScaledVector(direction, distance);
    const range = distance * Math.tan(THREE.MathUtils.degToRad(runtime.camera.fov / 2));
    runtime.context.innerWidth = 390;
    runtime.context.innerHeight = 844;
    runtime.listeners.resize();
    const offset = runtime.camera.position.clone().sub(runtime.controls.target);
    expect(offset.clone().normalize().distanceTo(direction)).toBeCloseTo(0);
    expect(runtime.controls.target.toArray()).toEqual([1, 2, 3]);
    expect(offset.length() * Math.tan(THREE.MathUtils.degToRad(runtime.camera.fov / 2)) * runtime.camera.aspect).toBeCloseTo(range);
  });
});
