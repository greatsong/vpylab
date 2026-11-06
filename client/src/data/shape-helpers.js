export const domeHelper = `# 제공 코드: 작은 삼각형으로 바닥이 닫힌 반구/돔을 만듭니다.
# 지금은 함수를 모두 읽지 않아도 됩니다. 아래 호출의 숫자 세 개부터 바꾸세요.
def make_dome(radius=1, height=1, segments=16, paint=color.cyan):
    if radius <= 0 or height <= 0:
        raise ValueError("radius와 height는 양수여야 합니다")
    if not isinstance(segments, int) or not 4 <= segments <= 32:
        raise ValueError("segments는 4~32 사이의 정수여야 합니다")
    rows = max(2, segments // 2)
    rings = []
    for i in range(rows + 1):
        angle = (pi / 2) * i / rows
        ring = []
        for j in range(segments):
            turn = 2 * pi * j / segments
            direction = vector(sin(angle)*cos(turn), cos(angle), sin(angle)*sin(turn))
            point = vector(radius*direction.x, height*direction.y, radius*direction.z)
            normal = norm(vector(direction.x/radius, direction.y/height, direction.z/radius))
            ring.append(vertex(pos=point, normal=normal, color=paint))
        rings.append(ring)
    faces = []
    for i in range(rows):
        for j in range(segments):
            k = (j + 1) % segments
            faces.append(triangle(vs=[rings[i][j], rings[i+1][k], rings[i+1][j]]))
            if i > 0:
                faces.append(triangle(vs=[rings[i][j], rings[i][k], rings[i+1][k]]))
    bottom = vertex(pos=vector(0,0,0), normal=vector(0,-1,0), color=paint)
    edge = [vertex(pos=v.pos, normal=vector(0,-1,0), color=paint) for v in rings[-1]]
    for j in range(segments):
        faces.append(triangle(vs=[bottom, edge[j], edge[(j+1) % segments]]))
    return faces
`;
