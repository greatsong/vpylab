const word = (id, meaning, reading, explanation, example, english) => ({ id, meaning, reading, explanation, example, english });
export const codeVocabulary = [
  word('radius', '반지름', '레이디어스', '동그라미의 중심에서 가장자리까지의 길이예요. 두 배로 하면 전체 너비도 두 배가 돼요.', 'sphere(radius=0.5)', 'The distance from the centre to the edge.'),
  word('opacity', '불투명도', '오패서티', '얼마나 비치지 않는지를 뜻해요. 0은 완전히 투명, 1은 불투명해요. 0.5면 반쯤 비쳐요.', 'sphere(opacity=0.5)', '0 is transparent; 1 is opaque. Try 0.5 for a see-through shape.'),
  word('pos', '위치', '포즈 · position의 줄임말', '어디에 놓을지 정해요. 기본 좌표에서 x는 좌우, y는 위아래, z는 앞뒤예요.', 'ball.pos.x += 0.1', 'Position. Change pos.x to move along the x axis.'),
  word('size', '크기', '사이즈', '기본 방향에서 가로·높이·앞뒤 두께를 차례로 정해요. 도형을 돌리면 이 방향도 함께 돌아가요.', 'box(size=vector(2, 1, 0.5))', 'Length, height and depth along the object’s own axes.'),
  word('vector', '세 값 묶음', '벡터', 'x, y, z 세 값을 묶어요. 위치·방향·크기뿐 아니라 빛의 빨강·초록·파랑 값에도 써요.', 'vector(1, 2, 0)', 'Three values used for position, direction, size or RGB colour.'),
  word('sphere', '구', '스피어', '공처럼 둥근 입체 도형을 만들어요. radius로 반지름을 바꿔 보세요.', 'sphere(radius=0.5)', 'A ball-shaped object.'),
  word('box', '상자', '박스', '상자 모양의 입체 도형을 만들어요. size로 각 방향의 크기를 바꿔 보세요.', 'box(size=vector(1, 1, 1))', 'A box-shaped object.'),
  word('ellipsoid', '타원체', '일립소이드', '공을 늘이거나 납작하게 만든 모양이에요. 몸통·발·눈을 만들기 좋아요.', 'ellipsoid(size=vector(2, 1, 1))', 'A stretched or flattened sphere.'),
  word('cylinder', '원기둥', '실린더', '통이나 막대 같은 모양이에요. radius는 굵기, axis는 뻗는 방향과 길이를 정해요.', 'cylinder(radius=0.2, axis=vector(0, 1, 0))', 'A cylinder. Use radius for thickness and axis for direction and length.'),
  word('cone', '원뿔', '콘', '끝이 뾰족한 모양이에요. radius는 밑면의 반지름이에요.', 'cone(radius=0.5, axis=vector(0, 1, 0))', 'A cone with a pointed tip.'),
  word('ring', '고리', '링', '도넛 같은 고리를 만들어요. radius는 고리의 반지름, thickness는 관의 반지름이에요.', 'ring(radius=0.5, thickness=0.1)', 'A ring. Thickness is the radius of its tube.'),
  word('length', '길이', '렝스', '도형의 길이예요. 기본 방향에서는 x축을 따라 늘어나요. 도형을 돌리면 길이 방향도 함께 돌아가요.', 'box(length=2)', 'Length along the object’s own x axis.'),
  word('height', '높이', '하이트', '도형의 높이예요. 기본 방향에서는 y축을 따라 늘어나요.', 'box(height=1)', 'Height along the object’s own y axis.'),
  word('width', '앞뒤 두께', '위드스', 'VPython에서는 기본 방향의 z축, 즉 앞뒤 두께예요. 가로 길이를 바꾸려면 length를 써요.', 'box(width=0.5)', 'Depth along the object’s own z axis in VPython.'),
  word('thickness', '고리의 굵기', '시크니스', '고리를 이루는 관의 반지름이에요. 값을 키우면 고리가 두툼해져요.', 'ring(radius=0.5, thickness=0.1)', 'The radius of the tube that forms a ring.'),
  word('axis', '방향', '액시스', '도형이 어느 쪽을 향하는지 정해요. 원기둥·원뿔에서는 이 벡터의 길이가 도형의 길이이기도 해요.', 'cylinder(axis=vector(0, 2, 0))', 'The direction of an object. For cylinders and cones, its magnitude is also the length.'),
  word('angle', '각도', '앵글', '얼마나 돌릴지 정해요. 코드에서는 라디안을 써요. pi/2는 90도예요.', 'ball.rotate(angle=pi/2, axis=vector(0, 1, 0))', 'An angle in radians. pi/2 means 90 degrees.'),
  word('rotate', '회전하기', '로테이트', '도형을 돌려요. angle은 돌리는 양, axis는 회전축이에요.', 'ball.rotate(angle=0.1, axis=vector(0, 1, 0))', 'Rotate an object around an axis.'),
  word('compound', '하나로 합치기', '컴파운드', '여러 도형을 하나의 완제품으로 묶어요. 합친 뒤에는 완제품 전체를 움직여요.', 'friend = compound([body, eye])', 'Combine several shapes into one object.'),
  word('rate', '반복 속도', '레이트', '반복문의 속도를 조절하고 화면이 바뀔 시간을 줘요. rate(30)은 초당 최대 30번 반복하도록 해요.', 'while True:\n    rate(30)', 'Limit loop speed and give the screen time to update.'),
  word('visible', '보이기', '비저블', 'True면 보이고 False면 숨겨요. 숨겨도 변수와 도형은 남아 있어요.', 'ball.visible = False', 'True shows the object; False hides it.'),
  word('emissive', '스스로 밝게', '이미시브', '조명을 받지 않아도 밝게 보여요. 다른 도형을 비추는 광원이 되는 것은 아니에요.', 'sphere(emissive=True)', 'Looks bright without lighting; it does not illuminate other objects.'),
];

export function vocabularyForCode(code = '') {
  // 주석·문자열에 우연히 등장한 단어는 안내 대상으로 고르지 않습니다.
  const source = String(code).slice(0, 100_000).replace(/"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|#[^\n]*/g, match => ' '.repeat(match.length));
  return codeVocabulary.map(term => ({ term, index: source.search(new RegExp('\\b' + term.id + '\\b')) }))
    .filter(item => item.index >= 0).sort((a, b) => a.index - b.index).map(item => vocabularyWord(item.term.id, source.slice(0,item.index+item.term.id.length)));
}

export function vocabularyWord(id,prefix=''){
 const term=codeVocabulary.find(w=>w.id===id);if(!term)return undefined;
 if(['width','height'].includes(id)&&/\bscene[ \t]*\.[ \t]*(?:width|height)[ \t]*=?[ \t]*$/.test(prefix)){
  const horizontal=id==='width';return{...term,meaning:horizontal?'화면 가로 크기':'화면 세로 크기',explanation:horizontal?'3D 화면의 가로 길이예요. 단위는 픽셀이고, 도형의 두께와는 달라요.':'3D 화면의 세로 길이예요. 단위는 픽셀이고, 도형의 높이와는 달라요.',example:'scene.'+id+' = '+(horizontal?'800':'500')};
 }
 return term;
}
