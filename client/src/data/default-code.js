export const DEFAULT_CODE = `from vpython import *

# 구를 만들고 움직여보세요
ball = sphere(pos=vector(0, 0, 0), radius=0.5, color=color.cyan)
ball.velocity = vector(1, 0, 0)

dt = 0.01
while True:
    rate(100)
    ball.pos = ball.pos + ball.velocity * dt

    # 벽에 부딪히면 반사
    if abs(ball.pos.x) > 5:
        ball.velocity.x = -ball.velocity.x
`;

export function getDefaultCode(locale = 'ko') {
  return locale === 'en' ? DEFAULT_CODE.replace('# 구를 만들고 움직여보세요', '# Create and move a sphere').replace('# 벽에 부딪히면 반사', '# Bounce at the walls') : DEFAULT_CODE;
}
