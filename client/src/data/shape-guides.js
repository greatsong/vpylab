import { domeHelper } from './shape-helpers.js';
const text=(ko,en)=>({ko,en});
const guide=(id,title,en,description,config)=>({id,category:'shape-guides',origin:'guide',title:text(title,en),description:text(description,config.descriptionEn||en),...config});
const from='from vpython import *\nscene.range = 3\n';
const change=(instruction,en,before,after,expect,enExpect)=>({instruction:text(instruction,en),before,after,expect:text(expect,enExpect)});

export const shapeGuides=[
 guide('shape-start','모양 만들기 시작','Start making shapes','먼저 보이는 모양을 예상하고, 숫자 하나를 바꾼 뒤 다시 실행하세요. AI 없이 기본 도형부터 직접 만듭니다.',{
  goal:text('위치·크기·방향을 구별합니다.','Distinguish position, size, and direction.'),
  predict:text('radius를 두 배로 하면 공의 지름도 두 배가 될까요?','Will doubling radius double the diameter?'),
  code:from+'ball = sphere(radius=0.5, color=color.cyan)\n',
  changes:[change('radius=0.5를 1로 바꾸세요.','Change radius from 0.5 to 1.','radius=0.5','radius=1','공의 지름이 1에서 2로 커집니다. 위치는 그대로입니다.','Diameter grows from 1 to 2; position stays fixed.')],
  explain:text('pos는 위치, size는 세 방향 크기, axis는 방향입니다. 원기둥·원뿔의 axis에는 길이도 들어갑니다. scene.range를 고정하면 크기 변화를 비교하기 쉽습니다.','pos controls position, size controls dimensions, and axis controls direction. Cylinder and cone axes also carry length. A fixed scene.range makes size changes easier to compare.'),
  related:['shape-stretch','shape-direction','shape-combine','shape-dome','shape-cup','feature-origins'],diagram:'axes',
 }),
 guide('shape-stretch','늘이고 납작하게','Stretch and flatten','타원체의 세 숫자를 바꿔 달걀·물방울·납작한 돌 모양을 만듭니다.',{
  goal:text('size의 x·y·z가 어느 방향을 바꾸는지 찾습니다.','Find which direction each size component changes.'),
  predict:text('size의 가운데 숫자만 키우면 어느 방향으로 늘어날까요?','Which direction grows if only the middle number increases?'),diagram:'axes',
  code:from+'body = ellipsoid(size=vector(1.6, 0.8, 0.6), color=color.cyan)\n',
  changes:[change('가운데 0.8을 1.6으로 바꾸세요.','Change the middle 0.8 to 1.6.','vector(1.6, 0.8, 0.6)','vector(1.6, 1.6, 0.6)','위아래 높이만 두 배가 됩니다.','Only the height doubles.'),change('이번에는 마지막 0.6을 0.2로 바꾸세요. 옆으로 돌려 확인하세요.','Change the last 0.6 to 0.2, then rotate the view.','vector(1.6, 0.8, 0.6)','vector(1.6, 0.8, 0.2)','앞뒤 두께가 얇아집니다. 정면에서만 보면 차이가 작을 수 있습니다.','Depth becomes thinner; a front view may hide the difference.')],
  explain:text('기본 방향에서는 size=vector(x 방향 길이, y 방향 높이, z 방향 두께)입니다. pos를 바꾸면 크기는 유지한 채 위치만 옮깁니다.','In the default orientation, size sets x length, y height, and z depth. Changing pos moves the object without resizing it.'),related:['ellipsoid','object_length_size','shape-combine'],
 }),
 guide('shape-direction','방향과 길이 바꾸기','Change direction and length','원기둥과 원뿔의 axis를 바꿔 기둥·막대·나뭇가지처럼 배치합니다.',{
  goal:text('시작점 pos와 시작점에서 끝점까지의 axis를 구별합니다.','Distinguish the start position from the axis to the endpoint.'),
  predict:text('axis=vector(0,2,0)의 끝점은 어디일까요?','Where is the endpoint of axis=vector(0,2,0)?'),
  code:from+'pole = cylinder(pos=vector(0, 0, 0), axis=vector(0, 2, 0), radius=0.15, color=color.orange)\n',
  changes:[change('axis의 2를 y 자리에서 x 자리로 옮기세요.','Move the 2 from the y component to x.','axis=vector(0, 2, 0)','axis=vector(2, 0, 0)','같은 길이의 막대가 오른쪽을 향합니다.','The same length points to the right.'),change('x와 y를 모두 1로 바꾸세요.','Set both x and y to 1.','axis=vector(0, 2, 0)','axis=vector(1, 1, 0)','대각선을 향하고 길이는 √2입니다. 두 성분을 더한 2가 아닙니다.','The diagonal length is √2, not the sum 2.')],
  explain:text('끝점 = pos + axis입니다. axis는 vector(끝점) 자체가 아닙니다. cylinder를 cone으로 바꾸면 같은 방향의 원뿔을 볼 수 있습니다.','Endpoint = pos + axis. axis is not an absolute endpoint. Replace cylinder with cone to make a cone pointing the same way.'),related:['cylinder','cone','object-rotate','scene_camera'],
 }),
 guide('shape-combine','부품 합쳐 내 모양','Combine parts','타원체 몸통과 둥근 머리로 내 캐릭터를 만들고, 전체 색과 투명도를 바꿉니다.',{
  goal:text('부품의 위치를 정하고 compound로 한 번에 다룹니다.','Position parts, then manipulate the compound together.'),
  predict:text('흰 부품을 묶고 전체 색을 바꾸면 두 부품이 어떻게 보일까요?','How will both white parts look when the compound color changes?'),
  code:from+'body = ellipsoid(size=vector(1.4, 0.7, 0.6), color=color.white)\nhead = sphere(pos=vector(0.7, 0.5, 0), radius=0.35, color=color.white)\nmodel = compound([body, head])\nmodel.color = color.cyan\nmodel.opacity = 1\n',
  changes:[change('머리의 x 위치 0.7을 -0.7로 바꾸세요.','Change the head x position from 0.7 to -0.7.','pos=vector(0.7, 0.5, 0)','pos=vector(-0.7, 0.5, 0)','머리가 반대쪽으로 옮겨갑니다.','The head moves to the opposite side.'),change('opacity를 0.4로 바꾸세요.','Change opacity to 0.4.','model.opacity = 1','model.opacity = 0.4','두 부품이 함께 반투명해집니다.','Both parts become translucent.')],
  explain:text('compound.color는 원래 부품 색에 곱하는 필터입니다. 부품을 흰색으로 시작하면 원하는 전체 색을 표현하기 쉽습니다. color.white로 원래 색을 복원합니다. 묶은 뒤 부품을 따로 움직이려면 group을 쓰세요.','compound.color multiplies the original part colors. Starting with white parts makes uniform tinting easy. White restores the original colors. Use group if parts must remain independently editable.'),related:['compound','group','shape-triangle'],
 }),
 guide('shape-triangle','삼각형에서 지붕으로','From a triangle to a roof','세 점으로 삼각형을 만들고, 같은 단면에 깊이를 주어 지붕을 만듭니다.',{
  goal:text('평면의 꼭짓점과 입체의 깊이를 구별합니다.','Distinguish flat vertices from solid depth.'),
  predict:text('지붕의 가운데 꼭짓점을 높이면 어느 부분이 달라질까요?','What changes if the middle roof vertex moves up?'),
  code:from+'outline = [[-1, 0], [1, 0], [0, 0.9], [-1, 0]]\nroof = extrusion(shape=outline, path=[vector(0, 0, -0.6), vector(0, 0, 0.6)], color=color.red)\n',
  changes:[change('꼭짓점의 높이 0.9를 1.5로 바꾸세요.','Change the apex height from 0.9 to 1.5.','[0, 0.9]','[0, 1.5]','폭과 깊이는 같고 지붕만 높아집니다.','Only roof height increases; width and depth stay fixed.'),change('경로 양 끝 z 좌표를 -1과 1로 바꾸세요.','Change the path z endpoints to -1 and 1.','vector(0, 0, -0.6), vector(0, 0, 0.6)','vector(0, 0, -1), vector(0, 0, 1)','같은 삼각형 단면으로 앞뒤 깊이가 늘어납니다.','The same triangular cross section becomes deeper.')],
  explain:text('outline의 [x,y]는 앞에서 본 단면입니다. 마지막 점을 처음 점과 같게 해 닫습니다. path의 vector 두 개는 입체가 뻗는 3D 경로입니다. 한 장의 면은 vertex와 triangle로도 만들 수 있습니다.','outline is an xy cross section, closed by repeating the first point. The two path vectors define its 3D depth. Use vertex and triangle for a single flat face.'),related:['vertex','triangle','extrusion','shape-dome'],
  compatibility:[text('이 예제는 실습 화면에서 검증했습니다. 공유 HTML은 extrusion의 지원 범위가 좁아 같은 결과를 보장하지 않습니다.','Verified in the workspace. Standalone HTML supports a narrower extrusion API and may differ.')],
 }),
 guide('shape-dome','반구와 돔 만들기','Make a hemisphere and dome','제공 함수를 도구로 사용해 반지름·높이·삼각형 조각 수를 바꿉니다.',{
  goal:text('반지름과 높이가 같으면 반구, 다르면 돔임을 비교합니다.','Compare a hemisphere with equal radius and height against a dome.'),
  predict:text('반지름은 1로 두고 높이만 0.5로 줄이면 어떤 모양일까요?','What happens when height becomes 0.5 while radius remains 1?'),
  helperNotice:text('make_dome은 VPython 내장 명령이 아닙니다. VPython으로 작성한 제공 함수입니다. 실습 열기·전체 복사에는 함수도 포함됩니다.','make_dome is a supplied function written with VPython, not a built-in API. Opening or copying the complete example includes the function.'),
  supportCode:domeHelper,
  displayCode:'dome = compound(make_dome(\n    radius=1,\n    height=1,\n    segments=16,\n    paint=color.white\n))\ndome.color = color.cyan\n',
  code:from+'\n'+domeHelper+'\n# ▼ 여기 숫자부터 하나씩 바꾸세요\ndome = compound(make_dome(\n    radius=1,\n    height=1,\n    segments=16,\n    paint=color.white\n))\ndome.color = color.cyan\n',
  changes:[change('height=1만 0.5로 바꾸세요.','Change only height=1 to 0.5.','    height=1,','    height=0.5,','바닥 반지름은 그대로이고 높이만 절반인 돔입니다.','The base radius stays fixed while height halves.'),change('segments=16을 4로 바꾸세요. 그다음 32도 비교하세요.','Change segments=16 to 4, then compare 32.','    segments=16,','    segments=4,','면이 각져 보입니다. 32로 늘려도 곡면 자체가 아닌 삼각형 근사입니다.','It looks coarse. Even 32 segments still approximate a curve using triangles.')],
  explain:text('함수 전체의 삼각함수 유도는 선택입니다. 먼저 호출 줄의 숫자를 바꾸세요. 바닥은 y=0에서 닫혀 있고, compound의 pos는 바닥이 아니라 경계 상자 중심입니다. 옮길 때 dome.pos += vector(2,0,0)처럼 이동량을 더할 수 있습니다.','Deriving the helper is optional. Start with its arguments. The base is closed at y=0; compound.pos is the bounding-box center, not the base. Add an offset to dome.pos when moving it.'),related:['vertex','triangle','compound','shape-cup'],
  compatibility:[text('radius·height는 양수, segments는 4~32 사이의 정수입니다. 조각 수를 높이면 그리는 면도 늘어납니다.','radius and height must be positive; segments must be an integer from 4 to 32. More segments create more faces.')],
 }),
 guide('shape-cup','안이 빈 컵 만들기','Make an open hollow cup','구멍이 있는 단면으로 벽을 만들고, 얇은 원기둥을 바닥으로 더합니다.',{
  goal:text('막힌 원기둥과 실제로 속이 빈 모양을 구별합니다.','Distinguish a solid cylinder from a genuinely hollow shape.'),
  predict:text('원기둥 두 개를 겹치면 안이 빌까요? 위에서 내려다보며 확인하세요.','Does stacking two solid cylinders make a cavity? Look down from above.'),
  code:from+'scene.forward = vector(-1, -0.8, -1)\nheight = 1.6\nradius = 1\nthickness = 0.12\nwall = extrusion(path=[vector(0, 0, 0), vector(0, height, 0)],\n                 shape=shapes.circle(radius=radius, thickness=thickness), color=color.cyan)\nbase = cylinder(pos=vector(0, 0, 0), axis=vector(0, 0.12, 0), radius=radius, color=color.cyan)\n',
  changes:[change('height를 1.6에서 2.2로 바꾸세요.','Change height from 1.6 to 2.2.','height = 1.6','height = 2.2','구멍과 반지름은 그대로, 벽만 높아집니다.','Wall height increases; the hole and radius stay unchanged.'),change('thickness를 0.12에서 0.25로 바꾸세요.','Change thickness from 0.12 to 0.25.','thickness = 0.12','thickness = 0.25','바깥 반지름은 같고 벽이 두꺼워져 안쪽 구멍이 작아집니다.','The outer radius stays fixed; thicker walls make the hole smaller.')],
  explain:text('shapes.circle의 thickness는 반지름에 대한 비율입니다. radius=1, thickness=0.12이면 안쪽 반지름은 0.88입니다. 벽의 윗면은 고리 모양이며 가운데를 막지 않습니다. base의 0.12는 바닥의 실제 높이로, 벽 두께 비율과 다른 값입니다.','shapes.circle thickness is a fraction of radius: radius 1 and thickness 0.12 give inner radius 0.88. The wall top is an annulus with an open center. The base axis 0.12 is an absolute base height, not the wall thickness fraction.'),related:['shapes-paths','extrusion','cylinder','scene_camera'],
  compatibility:[text('현재 실습 화면에서 지원합니다. 공유 HTML에서는 구멍이 있는 단면과 shapes.circle의 동일 동작을 지원하지 않습니다.','Supported in the workspace. Standalone HTML does not currently support the same hollow cross-section and shapes.circle behavior.')],
 }),
 guide('feature-origins','표준과 자체 기능','Standard and VPyLab features','VPython API, VPyLab이 추가한 기능, 코드 안에 정의한 예제 함수를 구별하세요.',{
  goal:text('다른 환경으로 코드를 옮길 때 함께 옮길 부분을 판단합니다.','Identify what must travel with code moved to another environment.'),
  explain:text('VPython API 배지는 표준 이름과 규칙을 따르는 항목입니다. 모든 환경에서 화면까지 같다는 뜻은 아닙니다. VPyLab 확장은 별도로 표시하며, 혼합 항목은 추가한 인자에 표시합니다. 제공 함수는 함수 정의까지 함께 복사해야 합니다.','The VPython API label identifies standard names and rules; it does not guarantee identical rendering everywhere. VPyLab extensions are marked separately, including extended parameters in mixed topics. Supplied functions must be copied with their definitions.'),
  originIndex:true,related:['compound','scene_camera','korean-colors','play_note','object-attach-trail','attach-trail-function'],
 }),
];

export function getGuideVariants(doc) {
 return (doc.changes||[]).map((step,index)=>{const at=doc.code.lastIndexOf(step.before);if(at<0)throw new Error('Guide change is missing: '+doc.id);return {id:`${doc.id}-change-${index+1}`,code:doc.code.slice(0,at)+step.after+doc.code.slice(at+step.before.length)};});
}
