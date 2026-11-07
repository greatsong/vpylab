const text = (ko, en) => ({ ko, en });

const spaceInstrument = `from vpython import *
scene.background = vector(0.025, 0.035, 0.08)
scene.range = 4.5
scene.title = "우주 악기 / Space instrument"
scene.caption = "화면을 클릭한 뒤 A S D F · 또는 아래 버튼 / Click the scene, then A S D F, or use buttons"
notes = ["C4", "E4", "G4", "B4"]
keys = ["a", "s", "d", "f"]
colors = [color.cyan, color.magenta, color.orange, color.green]
planets = []
for i in range(4):
    position = vector((i - 1.5) * 1.8, 0, 0)
    planets.append(sphere(pos=position, radius=0.32, color=colors[i]))
    ring(pos=position, axis=vector(0, 1, 1), radius=0.65, thickness=0.025, color=colors[i])
    label(pos=position + vector(0, -1, 0), text=keys[i].upper() + " / " + notes[i], box=False, height=15)

def select_note(index):
    for planet in planets:
        planet.radius = 0.32
        planet.emissive = False
    planets[index].radius = 0.55
    planets[index].emissive = True
    play_note(notes[index], duration=0.35, type="musicbox", volume=0.22)

def on_key(event):
    if event.key.lower() in keys:
        select_note(keys.index(event.key.lower()))

scene.bind("keydown", on_key)
for i in range(4):
    button(text=keys[i].upper() + " / " + notes[i], bind=lambda b, index=i: select_note(index))
`;

const glowArpeggio = `from vpython import *
scene.background = vector(0.035, 0.025, 0.07)
scene.range = 4
scene.title = "빛나는 아르페지오 / Glowing arpeggio"
scene.caption = "아르페지오는 화음의 음을 하나씩 펼쳐 연주합니다 / An arpeggio plays chord notes one at a time"
notes = ["C4", "E4", "G4", "B4"]
beat = 0.3
lamps = []
for i in range(4):
    x = (i - 1.5) * 1.6
    cylinder(pos=vector(x, -1.3, 0), axis=vector(0, 1, 0), radius=0.06, color=color.gray(0.35))
    lamps.append(sphere(pos=vector(x, 0, 0), radius=0.3, color=vector(0.4 + i * 0.15, 0.6, 1)))
    label(pos=vector(x, -1.6, 0), text=notes[i], box=False, height=15)

def perform(b):
    for index in [0, 1, 2, 3, 2, 1, 0, 3]:
        lamps[index].radius = 0.5
        lamps[index].emissive = True
        play_note(notes[index], duration=beat * 0.85, type="piano", volume=0.22)
        sleep(beat)
        lamps[index].radius = 0.3
        lamps[index].emissive = False

button(text="8음 연주 / Play 8 notes", bind=perform)
`;

const stages = (code, modified) => [
  { id: 'demo', title: text('1. 완성작 체험', '1. Try the piece'), code, note: text('실행 뒤 버튼을 눌러 보세요. 스스로 소리가 나지는 않습니다. 음을 듣기 어려워도 위치와 크기로 비교할 수 있습니다.', 'Run, then press a button. Sound starts only when you play. Compare position and size as well as sound.') },
  { id: 'modify', title: text('2. 한 가지 바꾸기', '2. Change one thing'), code: modified, note: text('음 목록의 E4를 Eb4로 바꾼 코드입니다. 원래 작품과 번갈아 실행해 분위기 차이를 예상하고 비교하세요.', 'This version changes E4 to Eb4. Predict and compare its mood with the original.') },
  { id: 'create', title: text('3. 내 작품 만들기', '3. Make your own'), code, note: text('시작 코드를 바탕으로 음 네 개를 고르고 작품 이름을 지으세요. 마지막에는 바꾼 줄과 관찰한 차이를 설명합니다.', 'Choose four notes and a title using the starter code. Explain the lines you changed and the differences you noticed.') },
];

// 기존 튜토리얼 안에서 완성작 → 수정 → 창작으로 이어지는 오리지널 작품입니다.
export const lightSoundLabs = [
  {
    id: 'space-instrument', kind: 'lab', duration: text('10~15분 · 키보드 또는 터치', '10–15 min · Keyboard or touch'),
    title: text('키보드 우주 악기', 'Keyboard space instrument'),
    description: text('A·S·D·F로 네 행성을 연주합니다. 선택한 행성은 커지고 빛나며, 연주 중인 음도 화면에 표시됩니다.', 'Play four planets with A, S, D, and F. The selected planet grows and glows, with the sounding note shown on screen.'),
    prerequisite: text('버튼 체험 다음 · 목록과 함수 살펴보기', 'After the button experience · Explore lists and functions'),
    code: spaceInstrument, variants: stages(spaceInstrument, spaceInstrument.replace('"E4"', '"Eb4"')),
    change: text('notes 목록의 음 하나만 바꾸세요. 화면 아래 A / C4 같은 표기도 새 음을 따릅니다.', 'Change just one note in notes. The A / C4 labels follow your choice.'),
    reflect: text('음 목록만 바꾸면 행성의 색도 달라지나요? 소리와 모양을 정하는 줄을 각각 찾아 설명하세요.', 'Does editing notes also change a planet’s color? Explain which lines control sound and shape.'),
    tasks: [text('C4·D4·E4·G4·A4 중 네 개를 골라 짧은 우주 신호를 만드세요.', 'Choose four of C4, D4, E4, G4, and A4 and compose a short space signal.'), text('크기·위치·음 이름 중 두 가지로 음을 구별하고, 소리를 끈 상태에서도 연주 순서를 따라가 보세요.', 'Distinguish notes with two of size, position, and note labels; follow the pattern muted too.')],
    peerTest: text('친구가 만든 4음 신호를 듣거나 보고 따라 해 보세요. 구별하기 어려운 음은 어느 것인가요?', 'Repeat a friend’s four-note signal by listening or watching. Which notes are hard to distinguish?'),
    tips: [text('키 입력은 3D 화면을 클릭한 뒤에 받습니다. 휴대전화에서는 화면의 네 버튼을 쓰세요.', 'Click the 3D scene to focus it before using keys. On a phone, use the four buttons.'), text('행성의 빛은 마지막 선택을 유지합니다. 아래 ♪ 표시는 실제로 연주되는 동안만 보입니다. play_note는 VPyLab 확장입니다.', 'A planet keeps the last selection. The ♪ indicator appears only while a note plays. play_note is a VPyLab extension.')],
  },
  {
    id: 'glow-arpeggio', kind: 'lab', duration: text('15~20분 · 반복과 리듬', '15–20 min · Repetition and rhythm'),
    title: text('빛나는 아르페지오', 'Glowing arpeggio'),
    description: text('네 개의 빛을 오가며 오리지널 8음 선율을 연주합니다. 음 목록·순서·박자 중 하나씩 바꿔 보세요.', 'Play an original eight-note pattern across four lights. Change notes, order, or timing one at a time.'),
    prerequisite: text('빛과 소리 체험 다음 · 목록·반복·초 단위 시간', 'After light and sound · Lists, loops, and time in seconds'),
    code: glowArpeggio, variants: stages(glowArpeggio, glowArpeggio.replace('"E4"', '"Eb4"')),
    change: text('beat = 0.3을 0.45로 바꾸세요. 음 높이를 그대로 둔 채 연주 속도와 빛의 길이를 비교합니다.', 'Change beat = 0.3 to 0.45. Keep pitches fixed and compare speed and glow duration.'),
    reflect: text('같은 음 네 개로 순서만 바꾸면 어떤 분위기가 되나요? 반복 목록과 notes 목록의 역할을 구별해 설명하세요.', 'How does changing only the order affect the mood? Explain the roles of the loop list and notes.'),
    tasks: [text('반복 목록의 숫자는 0~3을 씁니다. 숫자 여덟 개로 나만의 오르내리는 선율을 만드세요.', 'Use indices 0–3. Make your own rising and falling eight-note pattern.'), text('scene.title의 작품 이름을 바꾸고, 원본과 수정본에서 달라진 점을 한 문장으로 남기세요.', 'Give your work a title in scene.title and describe one difference from the original.')],
    peerTest: text('친구에게 먼저 빛만 보여주고 흐름을 예상하게 하세요. 소리를 켠 뒤에도 같은 느낌인가요?', 'Show only the lights first and ask a friend to predict the flow. Does sound suggest the same mood?'),
    tips: [text('연주 버튼은 한 번 누르고 끝날 때까지 기다리세요. 도중에 멈추려면 실습 화면의 정지를 누릅니다.', 'Press Play once and wait for it to finish. Use Stop in the workspace to interrupt it.'), text('sleep(beat)는 빛이 유지되는 시간입니다. duration=beat * 0.85는 음 사이에 작은 쉼을 만듭니다. play_note는 VPyLab 확장입니다.', 'sleep(beat) holds the glow. duration=beat * 0.85 leaves a short gap between notes. play_note is a VPyLab extension.')],
  },
];

export function getLightSoundLab(id, step) {
  const lab = lightSoundLabs.find(item => item.id === id);
  if (!lab) return undefined;
  const variant = lab.variants.find(item => item.id === step) || lab.variants[0];
  return { ...lab, code: variant.code, activeStep: variant.id, stepNote: variant.note, usesSound: true };
}
