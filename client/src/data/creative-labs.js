import { domeHelper } from './shape-helpers.js';
const text = (ko, en) => ({ ko, en });

const signalShape = `from vpython import *
scene.range = 3
lamp = sphere(radius=0.4, color=color.cyan)
def signal(b):
    lamp.radius = 0.9
button(text="신호 보내기 / Signal", bind=signal)
`;
const signalLight = signalShape.replace('    lamp.radius = 0.9', '    lamp.radius = 0.9\n    lamp.emissive = True');
const signalSound = signalLight.replace('    lamp.emissive = True', '    lamp.emissive = True\n    play_note("C4", duration=0.2, volume=0.15)  # VPyLab 확장: 이 줄을 지워도 시각 신호는 동작합니다');

// 새 메뉴나 완료율을 만들지 않는 선택 활동. 완성 작품보다 작은 출발 코드를 제공합니다.
export const creativeLabs = [
  {
    id: 'shape-lab', kind: 'lab', duration: text('10~15분 · 혼자 또는 2명', '10–15 min · Solo or pairs'),
    title: text('세 숫자로 나만의 모양', 'Design a shape with three numbers'),
    description: text('타원체를 늘이고, 납작하게 만들고, 부품을 더해 내가 고른 대상을 표현합니다.', 'Stretch and flatten an ellipsoid, then combine parts to express something you choose.'),
    prerequisite: text('3D 체험 다음 · 변수와 좌표를 몰라도 시작', 'After the 3D experience · No variables or coordinates required'),
    change: text('body의 size=vector(1.6, 0.8, 0.6)에서 숫자 하나만 바꿔 먼저 비교하세요.', 'Change just one number in the body’s size=vector(1.6, 0.8, 0.6).'),
    reflect: text('세 숫자는 길이·높이·폭입니다. 내가 바꾼 방향과 예상이 맞았나요?', 'The numbers mean length, height, and width. Did the changed direction match your prediction?'),
    code: `from vpython import *
scene.range = 3
body = ellipsoid(size=vector(1.6, 0.8, 0.6), color=color.cyan)
part = ellipsoid(pos=vector(0.6, 0.5, 0), size=vector(0.5, 0.8, 0.3), color=color.yellow)
`,
    tasks: [text('다음에는 도형 세 개 이하로 다른 대상을 만드세요. 이제 여러 값을 함께 바꿔도 됩니다.', 'Then represent a different subject with at most three shapes. You may now change several values together.'), text('친구의 추측을 듣고, 특징 한 부분을 고친 뒤 어떤 줄을 바꿨는지 설명하세요.', 'Hear a friend’s guess, change one distinctive part, and explain the line you edited.')],
    peerTest: text('코드를 보지 않고 무엇으로 보이는지, 어떤 부분이 단서인지 말해 주세요.', 'Without reading the code, what does it look like, and which part gave you that clue?'),
    tips: [text('size는 vector(길이, 높이, 폭)입니다. pos는 위치이므로 크기와 따로 바꾸세요.', 'size is vector(length, height, width). pos changes position; change it separately.'), text('모양이 안 커 보이면 scene.range = 3이 남아 있는지 확인하세요. 카메라 범위를 고정해 비교합니다.', 'Keep scene.range = 3 so automatic camera fitting does not hide a size change.')],
    extensionId: 'hemisphere',
  },
  {
    id: 'signal-lab', kind: 'lab', duration: text('15~20분 · 혼자 또는 2명', '15–20 min · Solo or pairs'),
    title: text('나만의 신호: 모양 → 빛 → 소리', 'Your signal: shape → glow → sound'),
    description: text('버튼과 크기 변화부터 시작해 빛, 짧은 소리를 한 단계씩 더합니다.', 'Start with a button and a size change, then add glow and a short note one step at a time.'),
    prerequisite: text('버튼 체험 다음 · 함수의 들여쓰기 확인', 'After the button experience · Check function indentation'),
    change: text('0.9를 바꾸기 전에 버튼을 누르면 공이 어떻게 변할지 예상해 보세요.', 'Predict how the sphere will change before editing 0.9 and pressing the button.'),
    reflect: text('버튼을 누르기 전과 후를 소리 없이도 구별할 수 있나요?', 'Can you distinguish before and after without sound?'),
    code: signalShape,
    variants: [
      { id: 'shape', title: text('1. 모양', '1. Shape'), code: signalShape, note: text('실행한 뒤 버튼을 눌러 보세요. 같은 공의 크기만 바뀝니다.', 'Run, then press the button. Only the same sphere’s size changes.') },
      { id: 'light', title: text('2. 빛 더하기', '2. Add glow'), code: signalLight, note: text('emissive=True는 공을 밝게 보이게 합니다. 주변 물체를 비추는 조명은 아닙니다.', 'emissive=True makes the sphere appear bright. It does not illuminate nearby objects.') },
      { id: 'sound', title: text('3. 소리 더하기', '3. Add sound'), code: signalSound, extension: true, note: text('play_note는 VPyLab 확장입니다. 버튼을 누른 뒤 0.2초만 재생하며, 이 줄을 지워도 모양·빛은 남습니다.', 'play_note is a VPyLab extension. It plays for 0.2 seconds after a press; removing the line preserves shape and glow.') },
    ],
    tasks: [text('신호가 무엇을 뜻하는지 정하고 색 말고 크기나 모양으로도 구별되게 만드세요.', 'Choose a meaning for the signal; distinguish it through size or shape as well as color.'), text('소리 단계에서는 음 높이 또는 길이 하나를 바꾸고 신호의 뜻과 어울리는 이유를 적으세요.', 'At the sound stage, change the pitch or duration and explain how it fits the signal’s meaning.')],
    peerTest: text('소리를 끄고 한 번, 켜고 한 번 보세요. 각각 어떤 상태라고 생각하나요?', 'Try once muted and once with sound. What state do you think each represents?'),
    tips: [text('버튼이 안 보이면 마지막 button 줄이 함수 밖에 있는지 확인하세요.', 'If the button is missing, check that the last button line is outside the function.'), text('반응이 없으면 def signal(b):의 콜론, 아래 줄의 들여쓰기, bind=signal을 확인하세요.', 'If nothing changes, check the colon in def signal(b):, the indentation, and bind=signal.'), text('소리를 함께 시험할 시간을 정하세요. 소리 줄을 지우거나 화면의 소리를 꺼도 활동할 수 있습니다.', 'Agree on a sound testing time. You can remove the sound line or mute the workspace.')],
  },
  {
    id: 'team-signals', kind: 'lab', duration: text('25~35분 · 2~3명', '25–35 min · Teams of 2–3'),
    title: text('친구가 알아보는 팀 신호', 'A team signal others can understand'),
    description: text('두 상태의 뜻을 함께 정하고, 다른 팀의 해석을 듣고, 약속표와 코드를 고칩니다.', 'Agree on two meanings, listen to another team’s interpretation, and revise the plan and code.'),
    prerequisite: text('나만의 신호 다음 · 함수와 버튼 두 개', 'After Your signal · Two functions and buttons'),
    change: text('코드를 고치기 전에 두 신호의 뜻과 모양·크기를 종이에 함께 적으세요.', 'Before editing code, write down both meanings and their shapes and sizes together.'),
    reflect: text('“___가 ___로 오해되어 ___를 바꿨다”를 말하거나 주석·메모로 남기세요.', 'Say or write: “___ was mistaken for ___, so we changed ___.”'),
    code: `from vpython import *
scene.range = 3
lamp = ellipsoid(size=vector(0.8, 0.8, 0.8), color=color.white)
def first_signal(b):
    lamp.size = vector(1.8, 0.5, 0.5)
    lamp.color = color.cyan
    lamp.emissive = False
def second_signal(b):
    lamp.size = vector(0.5, 1.8, 0.5)
    lamp.color = color.yellow
    lamp.emissive = True
button(text="신호 A / Signal A", bind=first_signal)
button(text="신호 B / Signal B", bind=second_signal)
`,
    tasks: [text('소리는 선택입니다. 필요하면 각 함수에 play_note("C4", duration=0.2, volume=0.15) 한 줄을 넣고 서로 다른 음으로 바꾸세요. 이 줄은 VPyLab 확장입니다.', 'Sound is optional. Add play_note("C4", duration=0.2, volume=0.15) to each function and choose different notes. This line is a VPyLab extension.'), text('뜻을 설명하지 않고 다른 팀에 시험하세요. 오해한 신호 하나를 골라 약속표와 코드에서 함께 고치세요.', 'Test with another team before explaining the meanings. Revise one misunderstood signal in both the plan and the code.')],
    peerTest: text('소리와 색을 단서로 쓰지 않아도 A와 B를 구별할 수 있나요? 뜻은 어떻게 추측했나요?', 'Can you distinguish A and B without relying on sound or color? How did you guess their meanings?'),
    team: [text('약속표: 상태 | 전달할 뜻 | 모양·크기 | 소리(선택). 각자 아이디어 하나씩 내고 함께 결정하세요.', 'Shared plan: state | meaning | shape and size | optional sound. Everyone contributes an idea before the team decides.'), text('한 명은 입력, 한 명은 예상·검토를 맡고, 세 명이면 관찰·기록을 더합니다. 작은 수정 하나를 끝내거나 8분이 지나면 역할을 교대하세요.', 'One types; one predicts and reviews. With three people, add an observer. Swap after one small edit or eight minutes.'), text('한 기기의 코드를 기준으로 삼으세요. 로그인한 팀은 기존 프로젝트 패널의 초대·저장·항해 일지로 수정 이유를 남길 수 있습니다. 다른 기기에서 편집하기 전에 최신 코드를 가져오세요.', 'Keep one device as the source. Signed-in teams can use project invitations, saves, and the log to record decisions. Load the latest code before editing on another device.'), text('마지막에는 모두가 자기가 바꾼 한 줄과 동료 의견으로 달라진 결정을 설명하거나 기록하세요.', 'At the end, each person explains or records one edited line and one decision changed by peer feedback.')],
    tips: [text('이 예제는 깜빡임 없이 상태를 유지합니다. 버튼을 번갈아 여러 번 누르거나 소리를 꺼도 시험하세요.', 'This example holds each state without flashing. Test alternating presses and muted playback.'), text('팀 프로젝트는 코드를 실시간으로 함께 타이핑하는 편집기가 아닙니다. 같은 코드를 동시에 덮어쓰지 않도록 차례로 저장하세요.', 'Team projects do not provide simultaneous typing. Take turns saving to avoid overwriting each other’s code.')],
  },
];


const domeCall = 'make_dome(radius=1, height=1, segments=16)';

export const shapeExtensions = [{
  id: 'hemisphere', kind: 'extension', duration: text('선택 심화 · 10~15분', 'Optional extension · 10–15 min'),
  title: text('삼각형으로 만든 반구와 돔', 'A hemisphere and dome made of triangles'),
  description: text('제공 함수를 도구로 써서 반지름·높이·조각 수를 바꿉니다. 삼각함수 유도는 필수 목표가 아닙니다.', 'Use the supplied function to change radius, height, and resolution. Deriving the trigonometry is optional.'),
  prerequisite: text('세 숫자로 나만의 모양 다음 · 제공 함수를 사용하는 심화 활동', 'After Design a shape · An extension using a provided function'),
  change: text('먼저 height=1을 height=0.5로 바꾸세요. 반지름과 높이가 같을 때 반구, 다르면 반타원체(돔)입니다.', 'First change height=1 to height=0.5. Equal radius and height make a hemisphere; otherwise this is a half ellipsoid (dome).'),
  reflect: text('segments를 4, 16, 32로 바꾸면 윤곽이 어떻게 달라지나요? 곡면은 작은 평면 조각의 근사입니다.', 'How does the outline change with 4, 16, or 32 segments? The curved surface is approximated with small flat faces.'),
  code: `from vpython import *\nscene.range = 3\n\n${domeHelper}\n${domeCall}\n`,
  displayCode: domeCall,
  supportCode: domeHelper,
  tasks: [text('반지름과 높이가 같은 모양, 다른 모양을 만들어 친구에게 차이를 설명하세요.', 'Make one shape with equal radius and height and one with different values. Explain the difference to a friend.'), text('조각 수를 늘려도 실제 원의 곡면 자체가 되는 것은 아닙니다. 더 많은 평면 조각으로 가까이 표현합니다.', 'More segments still form a mesh of flat faces; they approximate a curve more closely.')],
  peerTest: text('반구인지 돔인지, 표면이 매끈한지 각져 있는지 코드 없이 비교해 주세요.', 'Compare hemisphere versus dome and smooth versus coarse without looking at the code.'),
  tips: [text('make_dome은 파일 안의 제공 함수이며 VPython 내장 명령이 아닙니다. 다른 VPython 환경에 옮길 때 함수도 함께 복사하세요.', 'make_dome is a supplied function, not a built-in VPython command. Copy the function too when moving the code.'), text('바닥면은 닫혀 있습니다. radius·height는 양수, segments는 4~32 정수입니다. 다시 실행하면 새 모양을 비교할 수 있습니다.', 'The base is closed. radius and height must be positive; segments is an integer from 4 to 32. Run again to compare a new shape.')],
}];

export function getCreativeLab(id, step) {
  const lab = [...creativeLabs, ...shapeExtensions].find(item => item.id === id);
  if (!lab) return undefined;
  const variant = lab.variants?.find(item => item.id === step) || lab.variants?.[0];
  return variant ? { ...lab, code: variant.code, activeStep: variant.id, stepNote: variant.note, usesSound: !!variant.extension } : lab;
}
