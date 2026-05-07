import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';

/* ─────────────────────────────────────────────────────────────────
   공용 작은 부품들
   ───────────────────────────────────────────────────────────────── */

function StepCard({ num, emoji, title, accent = '#4A6CF7', children }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        backgroundColor: 'var(--color-bg-panel)',
        border: '1px solid var(--color-border)',
        borderLeft: `4px solid ${accent}`,
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center font-mono font-bold text-sm shrink-0"
          style={{ backgroundColor: accent, color: 'white' }}
        >
          {num}
        </div>
        <h3
          className="font-display text-lg font-bold flex items-center gap-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          <span className="text-2xl leading-none">{emoji}</span>
          {title}
        </h3>
      </div>
      <div className="text-sm leading-relaxed pl-12" style={{ color: 'var(--color-text-secondary)' }}>
        {children}
      </div>
    </div>
  );
}

function InfoBox({ kind = 'tip', children }) {
  const palette = {
    tip:  { bg: 'rgba(74,108,247,0.08)', border: '#4A6CF7', label: '도움말',     icon: '💡' },
    warn: { bg: 'rgba(240,136,62,0.08)', border: '#F0883E', label: '주의',       icon: '⚠️' },
    safe: { bg: 'rgba(0,184,148,0.08)',  border: '#00B894', label: '안심하세요',  icon: '🛡️' },
  }[kind];
  return (
    <div
      className="rounded-lg p-4 my-3 text-sm"
      style={{
        backgroundColor: palette.bg,
        borderLeft: `3px solid ${palette.border}`,
        color: 'var(--color-text-secondary)',
        lineHeight: 1.7,
      }}
    >
      <div className="font-bold mb-1 flex items-center gap-1.5" style={{ color: palette.border }}>
        <span>{palette.icon}</span>
        {palette.label}
      </div>
      {children}
    </div>
  );
}

function ValueCard({ icon, title, body, example, accent }) {
  return (
    <div
      className="rounded-xl p-5 h-full flex flex-col"
      style={{
        backgroundColor: 'var(--color-bg-panel)',
        border: '1px solid var(--color-border)',
        borderTop: `3px solid ${accent}`,
      }}
    >
      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="font-display font-bold text-base mb-2 leading-snug" style={{ color: 'var(--color-text-primary)' }}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed mb-3 flex-1" style={{ color: 'var(--color-text-secondary)' }}>
        {body}
      </p>
      <div
        className="text-xs leading-relaxed pl-3 py-2 mt-auto"
        style={{
          color: 'var(--color-text-muted)',
          borderLeft: `2px solid ${accent}`,
          backgroundColor: 'var(--color-bg-secondary)',
          borderRadius: '0 6px 6px 0',
        }}
      >
        {example}
      </div>
    </div>
  );
}

function FootprintCard({ icon, title, what }) {
  return (
    <div
      className="rounded-lg p-4 text-center"
      style={{
        backgroundColor: 'var(--color-bg-panel)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="text-3xl mb-2">{icon}</div>
      <div className="font-display font-bold text-sm mb-1" style={{ color: 'var(--color-text-primary)' }}>
        {title}
      </div>
      <div className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
        {what}
      </div>
    </div>
  );
}

function Scenario({ icon, title, when, show, tip, accent }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: 'var(--color-bg-panel)',
        border: '1px solid var(--color-border)',
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <h3
        className="font-display font-bold text-base mb-2 flex items-center gap-2"
        style={{ color: 'var(--color-text-primary)' }}
      >
        <span className="text-xl">{icon}</span>
        {title}
      </h3>
      <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>
        <strong style={{ color: 'var(--color-text-primary)' }}>언제 쓰나요?</strong> {when}
      </p>
      <div className="mb-3">
        <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: accent }}>
          무엇을 보여주면 좋아요?
        </div>
        <ul className="list-disc pl-5 text-sm space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
          {show.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </div>
      <div
        className="text-xs leading-relaxed pl-3 py-2"
        style={{
          color: 'var(--color-text-muted)',
          borderLeft: `2px solid ${accent}`,
          backgroundColor: 'var(--color-bg-secondary)',
          borderRadius: '0 4px 4px 0',
        }}
      >
        💡 <strong>팁.</strong> {tip}
      </div>
    </div>
  );
}

function FAQ({ q, children }) {
  return (
    <div className="py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
      <div
        className="font-display font-bold text-[15px] mb-2 flex items-start gap-2"
        style={{ color: 'var(--color-text-primary)' }}
      >
        <span style={{ color: '#4A6CF7' }}>Q.</span>
        <span>{q}</span>
      </div>
      <div className="text-sm leading-relaxed pl-6" style={{ color: 'var(--color-text-secondary)' }}>
        {children}
      </div>
    </div>
  );
}

function VoyagePreview() {
  return (
    <div
      className="rounded-lg p-5 my-4 font-mono text-[13px] leading-relaxed"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text-primary)',
        overflowX: 'auto',
      }}
    >
      <div style={{ color: 'var(--color-text-muted)' }}># 항해 일지: 5월 8일</div>
      <div className="mt-3" style={{ color: '#4A6CF7' }}>## 오후 2:32 — 공이 바닥을 통과하는 문제 수정</div>
      <div className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
        - 작성자: 김서연<br />
        - 한 일: 충돌 판정 조건을 다시 손봤다.<br />
        - 막힌 점: y 좌표 기준이 모호해서 튕김이 이상하다.<br />
        - 다음 할 일: 좌표 기준 명확화<br />
        - 코드: 38줄
      </div>
      <div className="mt-3" style={{ color: 'var(--color-text-muted)' }}>
        - 오후 2:47 빠른 저장 — y 비교 다시 시도, 이준호<br />
        - 오후 3:01 빠른 저장 — 여전히 안 됨, 이준호
      </div>
      <div className="mt-3" style={{ color: '#4A6CF7' }}>## 오후 3:18 — 원인 발견</div>
      <div className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
        - 작성자: 이준호<br />
        - 한 일: 공의 중심이 아니라 표면 기준으로 비교하도록 변경.<br />
        - 다음 할 일: 김서연이 검토 후 정리<br />
        - 코드: 41줄
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   메인 페이지
   ───────────────────────────────────────────────────────────────── */

export default function Guide() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Header />

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* ===== 헤더 ===== */}
        <header className="mb-10 text-center">
          <div className="text-5xl mb-4">🚢</div>
          <h1
            className="font-display text-3xl md:text-4xl font-black tracking-tight mb-3"
            style={{ color: 'var(--color-text-primary)', lineHeight: 1.15 }}
          >
            팀으로 작품 만들기,<br />처음이어도 괜찮아요
          </h1>
          <p className="text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            VPyLab에서는 친구와 함께 작품을 만들고,<br />
            누가 언제 무엇을 했는지 자동으로 기록됩니다.<br />
            <span style={{ color: 'var(--color-text-muted)' }}>(혼자 해도 똑같이 잘 동작해요)</span>
          </p>
        </header>

        {/* ===== 한눈에 보는 흐름 ===== */}
        <section
          className="rounded-2xl p-6 mb-12"
          style={{
            backgroundColor: 'var(--color-bg-panel)',
            border: '1px solid var(--color-border)',
          }}
        >
          <h2 className="font-display text-lg font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            한눈에 보는 흐름
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <div>
              <div className="font-bold mb-1" style={{ color: '#4A6CF7' }}>1. 시작</div>
              가입 → 팀 만들기 또는 친구 초대 받기
            </div>
            <div>
              <div className="font-bold mb-1" style={{ color: '#00B894' }}>2. 만드는 중</div>
              코드 쓰기 → 저장 → "오늘 뭐 했어?" 한 줄 쓰기
            </div>
            <div>
              <div className="font-bold mb-1" style={{ color: '#F0883E' }}>3. 마무리</div>
              완성 버튼 → 소개글 다듬기 → 끝!
            </div>
          </div>
        </section>

        {/* ===== ❶ 학생에게 뭐가 좋은가 ===== */}
        <h2
          className="font-display text-2xl font-bold mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          이게 나한테 어떻게 도움이 돼요?
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
          귀찮아 보이지만, 한 학기 지나면 가장 고마워하게 되는 부분이에요.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          <ValueCard
            icon="🗒️"
            accent="#4A6CF7"
            title="까먹어도 괜찮아요 — 어제의 내가 오늘의 나를 도와줘요"
            body='저장 버튼만 누르면 "지금 뭘 했고 어디서 막혔는지"가 날짜별로 알아서 쌓여요. 다음날 컴퓨터 앞에서 "어디까지 했더라…"하고 멍해질 일이 사라집니다.'
            example='"어제 공이 바닥을 뚫고 내려갔는데 왜였지?" → 일지를 열어보면 "충돌 판정 빼먹음, 내일 추가 예정"이라고 내가 적어둠. 5초 만에 복귀.'
          />
          <ValueCard
            icon="🔁"
            accent="#6C5CE7"
            title='"막힌 이유"가 보이기 시작해요 — 진짜 실력이 늘어요'
            body="짧은 메모와 30분마다의 정리가 쌓이면, 같은 실수를 반복하는 패턴이 눈에 띕니다. 코드만 쓰는 게 아니라 내 사고 습관을 관찰하게 되는 거예요."
            example='"어, 나 매번 변수 이름 헷갈려서 막히네?" 같은 깨달음이 일주일 안에 와요.'
          />
          <ValueCard
            icon="🌱"
            accent="#00B894"
            title="작은 진전도 다 기록돼요 — 자존감이 떨어지지 않아요"
            body='큰 결과가 안 나와도 "오늘은 색깔 바꾸기 성공"처럼 작은 성공이 글로 남아요. 슬럼프가 오면 일지를 위로 스크롤해보세요. "나 이만큼 왔구나"가 보입니다.'
            example="게임 도전 과제 목록처럼, 깬 것들이 쭉 보이는 느낌."
          />
          <ValueCard
            icon="⚖️"
            accent="#F0883E"
            title="결과만 보고 평가하지 않아요 — 과정이 인정받아요"
            body="완성 코드만 제출하면 '잘한 친구 vs 못한 친구'로 갈리지만, 일지가 있으면 어떻게 고민하고 어떻게 해결했는지가 보입니다. 결과가 평범해도 과정에서 인정받을 수 있어요."
            example="친구는 빨리 끝냈지만, 나는 세 번 막혔다가 스스로 풀어낸 흔적이 일지에 남아 있음."
          />
          <ValueCard
            icon="🤝"
            accent="#E84393"
            title="팀에서 말이 통해요"
            body='"너 뭐 했어?"를 매번 묻지 않아도 됩니다. 서로의 일지를 읽으면 어디까지 됐고 누가 무엇에 막혔는지 한눈에 보여요. 친구가 막힌 부분을 자연스럽게 이어받아 만들 수 있어요.'
            example="단톡방 회의록이 자동으로 써지는 셈."
          />
          <ValueCard
            icon="📜"
            accent="#FF6B6B"
            title="발표 자료가 빈 화면에서 시작하지 않아요"
            body="그동안 쌓인 항해 일지가 그대로 발표 자료의 재료가 됩니다. 무슨 일을 했는지·어디서 막혔는지·어떻게 풀었는지가 다 적혀 있어서, 그중 좋은 부분을 골라 옮기기만 하면 돼요."
            example='"뭐부터 쓰지…" 하며 1시간 멍하던 게, 일지를 위로 스크롤하며 "이 부분 골라 옮겨 적기" 10~15분으로 바뀝니다.'
          />
          <ValueCard
            icon="🎓"
            accent="#00CEC9"
            title="자기소개서에 쓸 진짜 이야기가 생겨요"
            body='"저는 끈기 있어요" 같은 빈말 대신, 언제 어떤 문제에 막혔고 어떻게 풀었는지가 날짜별 증거로 남아요. 진로·면접·생기부에서 구체적으로 말할 재료가 됩니다.'
            example='"3월 12일에 처음 3D 회전이 안 됐는데, 일주일 뒤 각도 계산을 바꿔서 풀었어요" — 이런 문장은 살아본 사람만 쓸 수 있습니다.'
          />
        </div>

        {/* ===== ❷ 단계별 가이드 ===== */}
        <h2
          className="font-display text-2xl font-bold mb-6"
          style={{ color: 'var(--color-text-primary)' }}
        >
          단계별로 따라하기
        </h2>

        <div className="space-y-4 mb-12">
          <StepCard num={1} emoji="🚪" title="가입하고 들어오기" accent="#4A6CF7">
            <p className="mb-3">
              VPyLab을 처음 쓴다면 두 곳에 한 번씩 가입해야 해요.
              둘 다 무료입니다.
            </p>
            <ol className="list-decimal pl-5 space-y-3 mb-1">
              <li>
                <strong style={{ color: 'var(--color-text-primary)' }}>VPyLab 가입</strong>
                <div className="mt-1">
                  구글 계정 같은 평소 쓰는 로그인으로 한 번만 들어오면 끝이에요.
                  이름과 이메일만 사용하고, 새 비밀번호를 만들 필요는 없어요.
                </div>
              </li>
              <li>
                <strong style={{ color: 'var(--color-text-primary)' }}>GitHub 가입 (필수)</strong>
                <div className="mt-1">
                  <a
                    href="https://github.com/signup"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs px-2 py-0.5 rounded no-underline"
                    style={{
                      backgroundColor: 'var(--color-bg-secondary)',
                      color: '#4A6CF7',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    github.com/signup ↗
                  </a>{' '}
                  에서 사용자 이름·이메일·비밀번호를 정해 가입해요.
                  여러분이 만든 작품을 안전하게 보관할 공간이에요. 한 번 만들면 평생 써요.
                </div>
                <div
                  className="text-xs mt-2"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  ※ 만 13세 미만이면 부모님 동의가 필요해요. 어려우면 선생님께 도움 받으세요.
                </div>
              </li>
            </ol>
            <InfoBox kind="tip">
              가입이 끝나면 VPyLab 화면 오른쪽 위의 <strong>"GitHub 연결"</strong> 버튼을
              한 번 눌러주세요. 작품을 저장할 수 있는 준비가 끝납니다.
            </InfoBox>
            <InfoBox kind="safe">
              담당 선생님 외에는 여러분의 정보를 보지 않아요.
              학년이 끝나면 VPyLab 쪽 정보는 모두 안전하게 지워집니다.
              GitHub 계정은 여러분 본인의 것이라 그대로 남아있어요.
            </InfoBox>
          </StepCard>

          <StepCard num={2} emoji="👯" title="팀 만들기 또는 들어가기" accent="#6C5CE7">
            <p className="mb-3">두 가지 방법 중 하나를 선택해요.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong style={{ color: 'var(--color-text-primary)' }}>내가 팀장일 때</strong>:
                "새 팀 프로젝트" 버튼을 누르면 팀의 작품 공간이 만들어지고, 친구들에게 줄
                <em> 초대 코드</em> 한 줄이 생겨요.
                <div
                  className="font-mono text-xs mt-2 inline-block px-3 py-1 rounded"
                  style={{ backgroundColor: 'var(--color-bg-secondary)', color: '#4A6CF7' }}
                >
                  예: VPL-7K2X-4M9P
                </div>
              </li>
              <li>
                <strong style={{ color: 'var(--color-text-primary)' }}>친구가 팀장일 때</strong>:
                "초대 코드로 들어가기"에 친구가 알려준 코드를 입력하면 끝.
                팀의 작품 공간에 자동으로 추가돼요.
              </li>
            </ul>
            <InfoBox kind="tip">
              혼자 하고 싶다면 그냥 새 프로젝트를 만들고 초대 코드를 안 나눠주면 돼요.
              여러분이 1인 팀의 팀장이 됩니다.
            </InfoBox>
            <InfoBox kind="safe">
              <strong>팀 이름은 처음에 정하고, 누가 무엇을 할지는 만들면서 자연스럽게 드러나요.</strong>
              <br />
              미리 못 정해도 괜찮습니다. 작품을 완성할 무렵 항해 일지를 위로 스크롤해보면
              누가 어떤 부분을 많이 했는지 보여요. 그걸 보고 소개글의 "팀과 역할"에
              직접 적으면 됩니다.
            </InfoBox>
          </StepCard>

          <StepCard num={3} emoji="💾" title="코드 쓰고 저장하기" accent="#00B894">
            <p className="mb-2">
              평소처럼 코드를 쓰다가, 마음에 드는 순간에{' '}
              <strong style={{ color: 'var(--color-text-primary)' }}>저장</strong> 버튼을 누르세요.
              저장은 게임의 체크포인트 같은 거예요. 언제든 그 시점으로 되돌아갈 수 있어요.
            </p>
            <p className="mb-2">저장하면 작은 창이 떠서 두 가지를 물어봅니다.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>제목</strong> — 한 줄로 "이번에 뭐 했는지" (예: <em>충돌 판정 추가</em>)</li>
              <li><strong>한 일</strong> — 조금 더 자세히 (예: <em>공이 바닥을 뚫는 문제를 고쳤다</em>)</li>
            </ul>
            <InfoBox kind="tip">
              실험 중이라 잠깐 저장만 하고 싶을 땐 <strong>"빠른 저장"</strong>을 누르면
              제목 한 줄만 적어도 돼요. 그 대신 30분에 한 번씩, 또는 새로 들어온 첫 저장에는
              위 두 가지를 꼭 적게 됩니다. (자기 자신을 위한 기록!)
            </InfoBox>
          </StepCard>

          <StepCard num={4} emoji="📔" title="저장이 곧 항해 일지가 돼요" accent="#E84393">
            <p>
              저장할 때마다 적은 글이 팀의 <strong>항해 일지</strong>에 자동으로 쌓입니다.
              일지를 따로 쓸 필요가 없다는 뜻이에요. 저장만 하면 기록이 됩니다.
              팀의 작품 공간 안{' '}
              <code style={{ fontSize: '0.85em', backgroundColor: 'var(--color-bg-secondary)', padding: '1px 6px', borderRadius: '3px' }}>
                docs/voyage
              </code>{' '}
              폴더에 날짜별로 한 장씩 쌓여요.
            </p>
            <p className="mt-2 mb-1" style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              실제로 이런 모양이 됩니다 ↓
            </p>
            <VoyagePreview />
            <InfoBox kind="safe">
              일지 작성자는 <strong>저장 버튼을 누른 본인</strong>으로 자동 기록돼요.
              친구 이름으로 바꿔서 적을 수 없습니다. 그래서 누가 무엇을 했는지가 자연스럽게 정확히 남아요.
            </InfoBox>
          </StepCard>

          <StepCard num={5} emoji="👀" title="친구가 어디까지 했는지 보기" accent="#F0883E">
            <p>
              팀원 누구나 항해 일지를 열어보면 그날 누가 무엇을 했는지 한눈에 보여요.
              "어디까지 했어?"를 따로 물어볼 필요가 없습니다.
            </p>
            <p className="mt-2">
              팀원이 막히면 일지에 <strong>"막힌 점"</strong>이 그대로 남아 있어서, 다음 사람이
              보고 이어 받을 수 있어요. 위 예시에서 이준호가 막혔던 부분을 김서연이 다음 날
              정리한 것처럼요.
            </p>
          </StepCard>

          <StepCard num={6} emoji="📝" title="다 만들면 소개글 쓰기" accent="#FF6B6B">
            <p>
              작품이 완성되면 팀의 작품 공간에 있는{' '}
              <code style={{ fontSize: '0.85em', backgroundColor: 'var(--color-bg-secondary)', padding: '1px 6px', borderRadius: '3px' }}>
                README.md
              </code>{' '}
              파일을 직접 다듬어주세요. 이게 다른 사람이 여러분 작품을 처음 볼 때
              가장 먼저 읽는 글이에요.
            </p>
            <p className="mt-2">소개글에는 보통 이런 것들이 들어갑니다.</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>이 작품이 뭘 하는 건지 (한 문단)</li>
              <li>실행하는 방법 (또는 미리보기 주소)</li>
              <li>팀원과 각자 한 일</li>
              <li>만들면서 배운 것 / 아직 부족한 것</li>
            </ul>
            <InfoBox kind="tip">
              막막하면 아래 <strong>"소개글, 이렇게 쓰면 돼요"</strong> 섹션의 샘플을 보세요.
              그대로 복사한 다음 여러분 작품에 맞게 고쳐서 써도 됩니다.
              항해 일지를 위로 스크롤해보면 "배운 점"과 "막힌 점"이 다 거기 있어요.
            </InfoBox>
            <InfoBox kind="safe">
              <strong>소개글을 한 번 쓰고 끝이 아니에요.</strong> 작품을 더 고치면
              그에 맞춰 소개글도 같이 다듬으면 됩니다. 평소처럼 저장하면 함께 올라가요.
            </InfoBox>
          </StepCard>
        </div>

        {/* ===== ❸ 모든 과정이 어디에 어떻게 남는가 (4겹 발자국) ===== */}
        <h2
          className="font-display text-2xl font-bold mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          내가 한 일이 어디에 어떻게 남아요?
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
          저장 한 번에 <strong>발자국이 네 곳</strong>에 동시에 찍혀요. 이게 핵심이에요.
        </p>

        <div
          className="rounded-2xl p-6 mb-6"
          style={{
            background: 'linear-gradient(135deg, rgba(74,108,247,0.06), rgba(232,67,147,0.06))',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="text-center mb-5">
            <div className="text-3xl mb-2">💾</div>
            <div
              className="inline-block font-mono text-xs px-3 py-1 rounded"
              style={{ backgroundColor: 'var(--color-bg-panel)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
            >
              저장 버튼 한 번 클릭
            </div>
            <div className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
              아래 네 곳에 동시에 자동으로 ↓
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <FootprintCard
              icon="🪪"
              title="이름 도장"
              what="저장 누른 본인 이름이 자동으로 박혀요. 다른 사람 이름으로 절대 못 바꿔요."
            />
            <FootprintCard
              icon="📓"
              title="일기장 한 페이지"
              what='"오늘 뭐 했고 왜 그렇게 했는지"가 사람이 읽기 좋은 글로 남아요.'
            />
            <FootprintCard
              icon="📊"
              title="성장 다이어리"
              what="며칠 동안 몇 번, 얼마나 작업했는지 시간 순서로 깔끔히 정리돼요."
            />
            <FootprintCard
              icon="🎨"
              title="기여도 그래프"
              what="모둠 작업이면 누가 얼마만큼 했는지 한눈에 보이는 색깔 그래프가 자동으로 그려져요."
            />
          </div>

          <div className="mt-5 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            한 번 눌렀을 뿐인데 네 가지 방식으로 동시에 기록돼요.<br />
            <strong style={{ color: 'var(--color-text-primary)' }}>
              누가 봐도 공정하고, 나중에 내가 다시 봐도 정확합니다.
            </strong>
          </div>
        </div>

        <InfoBox kind="safe">
          이 네 곳은 <strong>서로를 검증</strong>해요. 일지에 "박지민이 카메라 작업"이라 적혀있는데
          이름 도장이 다르면 시스템이 잡아냅니다. 그래서 친구 이름으로 일지를 적는 일이 구조적으로
          불가능합니다 — 본인 발자국은 본인 것만 찍혀요.
        </InfoBox>

        <div className="my-12" />

        {/* ===== ❹ 친구와 같이 코드 만들기 ===== */}
        <h2
          className="font-display text-2xl font-bold mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          친구와 같이 코드 만들기
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
          VPyLab의 팀 작업은 게임 멀티플레이처럼 같은 자리에 동시에 서는 방식이 아니에요.
          오히려 <strong>릴레이 달리기</strong>에 가깝습니다.
        </p>

        {/* 코드 전달 흐름 */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{
            background: 'linear-gradient(135deg, rgba(0,184,148,0.06), rgba(74,108,247,0.06))',
            border: '1px solid var(--color-border)',
          }}
        >
          <h3
            className="font-display text-lg font-bold mb-4"
            style={{ color: 'var(--color-text-primary)' }}
          >
            🏃 코드가 친구에게 어떻게 전달돼요?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            {[
              { num: '1', who: '친구', what: '저장 버튼을 누름', where: '코드가 팀 작품 공간에 올라감', color: '#4A6CF7' },
              { num: '2', who: '나', what: 'VPyLab을 열면', where: '친구의 최신 코드가 자동으로 보임', color: '#6C5CE7' },
              { num: '3', who: '나', what: '코드 고치고 저장', where: '내 작업이 같은 공간에 올라감', color: '#00B894' },
              { num: '4', who: '다른 친구', what: '나중에 열면', where: '내가 한 작업까지 다 보임', color: '#F0883E' },
            ].map((s) => (
              <div
                key={s.num}
                className="rounded-lg p-3"
                style={{
                  backgroundColor: 'var(--color-bg-panel)',
                  border: '1px solid var(--color-border)',
                  borderTop: `3px solid ${s.color}`,
                }}
              >
                <div
                  className="font-mono font-bold text-xs mb-1.5"
                  style={{ color: s.color }}
                >
                  {s.num}단계 · {s.who}
                </div>
                <div
                  className="font-bold text-sm mb-1"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {s.what}
                </div>
                <div
                  className="text-xs leading-relaxed"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  → {s.where}
                </div>
              </div>
            ))}
          </div>
          <div
            className="mt-4 text-center text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            한 명이 저장할 때마다 바통이 다음 친구에게 넘어가는 셈이에요.
          </div>
        </div>

        {/* 시나리오 3개 */}
        <div className="space-y-4 mb-6">
          {/* 시나리오 1 */}
          <div
            className="rounded-xl p-6"
            style={{
              backgroundColor: 'var(--color-bg-panel)',
              border: '1px solid var(--color-border)',
              borderLeft: '4px solid #00B894',
            }}
          >
            <h3
              className="font-display text-lg font-bold mb-2 flex items-center gap-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <span className="text-2xl">🌅</span>
              상황 1. 차례대로 작업하기
              <span
                className="font-mono text-xs px-2 py-0.5 rounded ml-1"
                style={{ backgroundColor: 'rgba(0,184,148,0.15)', color: '#00B894' }}
              >
                가장 안전
              </span>
            </h3>
            <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              오전엔 김서연, 오후엔 이준호. 한 명씩 시간을 나눠 쓰는 방식이에요.
            </p>
            <div
              className="rounded-lg p-4 mb-3 text-sm leading-relaxed"
              style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
            >
              <div style={{ color: 'var(--color-text-primary)', fontWeight: 600, marginBottom: 6 }}>
                🕙 오전 10시 — 김서연
              </div>
              VPyLab 열기 → 충돌 판정 작업 → 12시에 저장 (코드가 팀 작품 공간에 올라감)
              <div style={{ color: 'var(--color-text-primary)', fontWeight: 600, margin: '10px 0 6px' }}>
                🕑 오후 2시 — 이준호
              </div>
              VPyLab 열기 → 김서연의 12시 저장본이 자동으로 보임 → 항해 일지 읽고
              "김서연이 충돌 판정까지 했네" 확인 → 그 위에서 작업 → 4시에 저장
              <div style={{ color: 'var(--color-text-primary)', fontWeight: 600, margin: '10px 0 6px' }}>
                🕗 다음 날 아침 — 김서연
              </div>
              열어보면 이준호의 4시 작업까지 다 들어와 있음
            </div>
            <InfoBox kind="tip">
              작업을 시작하기 전에 <strong>항해 일지를 먼저 열어보세요.</strong> 친구가 어디까지 했고
              어디서 막혔는지 한눈에 보여서, 같은 일을 또 안 합니다.
            </InfoBox>
          </div>

          {/* 시나리오 2 */}
          <div
            className="rounded-xl p-6"
            style={{
              backgroundColor: 'var(--color-bg-panel)',
              border: '1px solid var(--color-border)',
              borderLeft: '4px solid #F0883E',
            }}
          >
            <h3
              className="font-display text-lg font-bold mb-2 flex items-center gap-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <span className="text-2xl">👯</span>
              상황 2. 동시에 작업하기
              <span
                className="font-mono text-xs px-2 py-0.5 rounded ml-1"
                style={{ backgroundColor: 'rgba(240,136,62,0.15)', color: '#F0883E' }}
              >
                가능, 조심
              </span>
            </h3>
            <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              둘이 같은 시간에 작업해야 할 때(쉬는 시간이 짧거나, 발표 직전이거나).
              가능하지만 조금 약속이 필요해요.
            </p>
            <div className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              <div className="font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                안전하게 하는 방법
              </div>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>영역을 나누세요.</strong> "나는 색깔 부분, 너는 움직임 부분"처럼 서로
                  다른 곳을 만지면 부딪히지 않아요.
                </li>
                <li>
                  <strong>단톡방에 "나 시작!"</strong> 한 줄 알리고, 끝나면 "나 저장 끝" 알리세요.
                  순서가 명확해집니다.
                </li>
                <li>
                  <strong>팀원 한 명이 큰 변경을 한다면</strong> 잠깐 다른 친구는 작업을 멈추고
                  그 사람이 저장한 다음 시작하세요.
                </li>
              </ul>
            </div>
            <InfoBox kind="warn">
              <strong>같은 곳을 동시에 고치면?</strong>
              <br />
              누군가가 먼저 저장하면 팀 작품 공간에 올라가고, 다른 사람이 같은 부분을 저장하려 하면
              <em> "친구가 방금 같은 부분을 저장했어요"</em>라는 알림이 떠요. 그때는 한 번 새로고침해서
              친구의 변경을 받은 다음, 내 변경을 다시 적용하면 됩니다.
              <br /><br />
              완벽한 자동 합치기는 아직 안 되니까, 가능하면 <strong>영역을 나누거나 시간을 나누는 게</strong>
              가장 마음 편해요.
            </InfoBox>
          </div>

          {/* 시나리오 3 */}
          <div
            className="rounded-xl p-6"
            style={{
              backgroundColor: 'var(--color-bg-panel)',
              border: '1px solid var(--color-border)',
              borderLeft: '4px solid #6C5CE7',
            }}
          >
            <h3
              className="font-display text-lg font-bold mb-2 flex items-center gap-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <span className="text-2xl">🤝</span>
              상황 3. 친구가 막힌 부분 이어받기
            </h3>
            <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              친구가 디버깅에 막혀 항해 일지에 <em>"막힌 점"</em>을 남겼어요.
              내가 다음 날 그 부분을 풀어보는 흐름이에요.
            </p>
            <div
              className="rounded-lg p-4 mb-3 text-sm leading-relaxed"
              style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
            >
              <div style={{ color: 'var(--color-text-primary)', fontWeight: 600, marginBottom: 6 }}>
                전날 — 이준호
              </div>
              일지에 "y 좌표 기준이 모호해서 튕김이 이상하다"고 적고 작업 종료.
              <div style={{ color: 'var(--color-text-primary)', fontWeight: 600, margin: '10px 0 6px' }}>
                다음 날 — 김서연
              </div>
              VPyLab 열기 → 일지에서 이준호의 "막힌 점" 읽기 →
              코드 열어 이준호가 시도한 흔적 확인 → 다른 접근 시도 → 저장하며
              일지에 "이준호가 막혔던 y 좌표 문제, 표면 기준으로 바꿔 해결" 적기.
            </div>
            <InfoBox kind="safe">
              친구의 시행착오가 그대로 보여서 같은 함정에 안 빠지고,
              <strong> 누가 무엇을 풀었는지가 자동으로 정확히 기록</strong>됩니다.
              발표 자료에서 "이 부분은 친구가 시도하던 걸 제가 이어서 풀었어요"라는
              스토리가 자연스럽게 만들어져요.
            </InfoBox>
          </div>
        </div>

        {/* 한 줄 요약 */}
        <div
          className="rounded-xl p-5 mb-12 text-center"
          style={{
            backgroundColor: 'var(--color-bg-panel)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="text-2xl mb-2">💡</div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>
              한 줄 요약: 한 명이 저장하면 친구에게 자동으로 전달돼요. 같은 곳을 동시에 고치는 일만
              피하면 거의 모든 게 잘 굴러갑니다.
            </strong>
          </p>
        </div>

        {/* ===== ❺ 다 만든 다음에는 어떻게 활용? ===== */}
        <h2
          className="font-display text-2xl font-bold mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          완성한 작품, 어디에 어떻게 써먹어요?
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
          작품 미리보기 + 항해 일지 + 다듬은 소개글, 이 셋을 묶어 다양한 곳에 활용할 수 있어요.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Scenario
            icon="🏫"
            accent="#4A6CF7"
            title="학교 수행평가 제출"
            when="정보·과학·미술·자유학기제처럼 결과물을 내야 하는 수업. 종이 보고서로는 작품이 진짜 움직이는 모습을 보여드리기 어려워요."
            show={[
              '작품 미리보기 주소 한 줄 (선생님이 클릭 한 번에 실행)',
              '항해 일지 캡처 (며칠에 걸쳐 꾸준히 만들었다는 증거)',
              '소개글 중 "배운 점" 부분',
              '팀원 역할 표',
            ]}
            tip="제출 메일 맨 위에 미리보기 주소부터 붙이세요. 선생님이 가장 먼저 누르는 게 그 링크예요."
          />
          <Scenario
            icon="🎓"
            accent="#6C5CE7"
            title="진학 자기소개서 / 진로 발표"
            when='고교·대학 입학 자료, 진로 발표 시간. "관심 있어요"라고 말로만 하지 말고 직접 만든 걸 보여주면 훨씬 진짜처럼 들립니다.'
            show={[
              '작품 한 줄 설명과 미리보기 주소',
              '가장 어려웠던 날과 그걸 어떻게 넘겼는지 (일지에서 발췌)',
              '소개글의 "한계와 다음에 해보고 싶은 것"',
              '작품 화면 사진 1~2장',
            ]}
            tip='"왜 이걸 만들고 싶었나"를 두 문장으로 먼저 쓰세요. 그게 가장 인상에 남아요.'
          />
          <Scenario
            icon="👨‍👩‍👧"
            accent="#00B894"
            title="가족에게 자랑하기"
            when="식사 자리, 명절, 부모님 직장 동료 모임. 코딩 모르시는 분들께도 5분 안에 보여드릴 수 있어요."
            show={[
              '휴대폰으로 미리보기 주소 열어 직접 만져보게 하기',
              '소개글 첫 문단 (어려운 말 없이 다듬은 버전)',
              '작품 움직이는 짧은 영상',
            ]}
            tip='"이거 만드는 데 며칠 걸렸어요"를 꼭 말씀드리세요. 결과보다 과정에 더 감동하세요.'
          />
          <Scenario
            icon="📱"
            accent="#E84393"
            title="친구·후배에게 공유"
            when="동아리 모집, 후배에게 작품 보여주기, 단톡방 자랑."
            show={[
              '미리보기 주소 (메신저에 그대로 붙여넣기)',
              '작품 화면 GIF 한 장',
              '소개글에서 재밌었던 에피소드 한 줄',
              '"처음엔 이것부터 했어" 같은 짧은 따라하기 안내',
            ]}
            tip="단톡방엔 긴 설명 대신 GIF + 주소만. 궁금한 친구가 먼저 물어봐요."
          />
          <Scenario
            icon="🗂️"
            accent="#F0883E"
            title="나만의 작품 모음집"
            when="1년, 3년 뒤 내가 얼마나 자랐는지 돌아볼 때. 작품이 일기처럼 쌓여요."
            show={[
              '작품 목록을 시간 순으로 정리한 노트',
              '각 작품마다 미리보기 주소, 만든 날짜, 그때의 기분 한 줄',
              '항해 일지에서 "가장 뿌듯했던 순간" 모음',
              '다음에 도전하고 싶은 것 메모',
            ]}
            tip="한 학기에 한 번 모아 보세요. 처음 작품과 비교하면 성장이 눈에 보입니다."
          />
        </div>

        {/* 다듬기 5요령 */}
        <div
          className="rounded-2xl p-6 mb-12"
          style={{
            backgroundColor: 'var(--color-bg-panel)',
            border: '1px solid var(--color-border)',
          }}
        >
          <h3
            className="font-display text-lg font-bold mb-4 flex items-center gap-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <span>✨</span> 소개글을 잘 다듬는 5가지 요령
          </h3>
          <ol className="space-y-3 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            <li>
              <strong style={{ color: '#4A6CF7' }}>① 움직이는 화면 한 장</strong>{' '}
              (GIF나 짧은 영상)을 맨 위에 넣으세요. 글보다 먼저 눈을 사로잡아요.
            </li>
            <li>
              <strong style={{ color: '#6C5CE7' }}>② 팀원 기여를 솔직하게</strong>{' '}
              적으세요. <em>"내가 다 했다"</em>보다 <em>"친구가 음악을 골라줬다"</em>가
              훨씬 멋져 보여요.
            </li>
            <li>
              <strong style={{ color: '#00B894' }}>③ 한계를 숨기지 마세요.</strong>{' '}
              "아직 휴대폰에선 느려요" 같은 솔직함이 오히려 신뢰를 줍니다.
            </li>
            <li>
              <strong style={{ color: '#F0883E' }}>④ 어려운 말을 빼고</strong>,
              친구에게 말하듯 다시 읽어보세요. 4번째 줄에서 막히면 그 문장은
              너무 어려운 거예요.
            </li>
            <li>
              <strong style={{ color: '#FF6B6B' }}>⑤ 만들면서 바뀐 마음</strong>을
              한 줄 넣으세요. <em>"처음엔 게임을 만들려 했는데, 그림 그리는 게
              더 재밌어졌어요"</em> 같은 문장이 글에 온도를 더해줘요.
            </li>
          </ol>
        </div>

        {/* ===== 소개글 샘플 3개 ===== */}
        <h2
          className="font-display text-2xl font-bold mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          소개글, 이렇게 쓰면 돼요
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
          막막할 땐 아래 샘플을 골라 그대로 복사한 뒤, 여러분 작품에 맞게 고쳐 쓰세요.
          모두 <code style={{ fontSize: '0.85em', backgroundColor: 'var(--color-bg-secondary)', padding: '1px 6px', borderRadius: '3px' }}>README.md</code>{' '}
          파일에 넣어요.
        </p>

        {/* 샘플 1 */}
        <div
          className="rounded-xl mb-4 overflow-hidden"
          style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}
        >
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <h3 className="font-display font-bold text-base flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <span>📝</span> 샘플 1. 혼자 만든 짧은 작품
            </h3>
            <span
              className="font-mono text-xs px-2 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(74,108,247,0.15)', color: '#4A6CF7' }}
            >
              1인 작품
            </span>
          </div>
          <pre
            className="px-5 py-4 text-[12.5px] leading-relaxed font-mono whitespace-pre-wrap m-0"
            style={{
              color: 'var(--color-text-primary)',
              backgroundColor: 'var(--color-bg-secondary)',
              overflowX: 'auto',
            }}
          >{`# 흔들리는 별빛

밤하늘 같은 배경 위에서 별들이 잔잔히 흔들리는 작품이에요.
숙제 하다가 잠깐 켜놓고 보면 마음이 편안해져요.

## 미리보기
👉 https://github.com/내이름/starlight-sway 의 페이지

## 실행하는 방법
VPyLab에서 main.py 열고 ▶ 실행 버튼만 누르면 돼요.

## 만든 사람
김서연 (당곡고등학교 1학년)

## 배운 점
- sin 함수로 부드럽게 흔들리는 움직임을 만들 수 있다는 걸 알게 됐어요.
- 처음엔 별이 너무 빨리 흔들려서 어지러웠는데, 시간 단위를 0.001로
  줄였더니 자연스러워졌어요.

## 아직 부족한 점
- 휴대폰에서는 약간 느려요.
- 별 색깔이 다 같아서 다음엔 무지개로 바꿔보고 싶어요.
`}</pre>
        </div>

        {/* 샘플 2 */}
        <div
          className="rounded-xl mb-4 overflow-hidden"
          style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}
        >
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <h3 className="font-display font-bold text-base flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <span>👯</span> 샘플 2. 팀 프로젝트 (3명)
            </h3>
            <span
              className="font-mono text-xs px-2 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(108,92,231,0.15)', color: '#6C5CE7' }}
            >
              팀 작품
            </span>
          </div>
          <pre
            className="px-5 py-4 text-[12.5px] leading-relaxed font-mono whitespace-pre-wrap m-0"
            style={{
              color: 'var(--color-text-primary)',
              backgroundColor: 'var(--color-bg-secondary)',
              overflowX: 'auto',
            }}
          >{`# 튕기는 공 시뮬레이션

지면에 떨어진 공이 자연스럽게 튕기다가 멈추는 모습을
물리 법칙대로 보여주는 작품입니다.

## 미리보기
👉 https://github.com/팀이름/bouncing-ball 의 페이지

## 만든 동기
체육 시간에 농구공이 튀는 모습을 보다가
"저걸 코드로 똑같이 만들 수 있을까?" 궁금해서 시작했어요.

## 만든 팀
당곡고등학교 1학년 — 김서연, 이준호, 박지민

## 팀과 역할
| 이름 | 한 일 |
|------|-------|
| 김서연 | 기획, 코드 정리, 함수로 나누기 |
| 이준호 | 중력·충돌 만들기, 핵심 버그 해결 |
| 박지민 | 배경·색깔·카메라 각도 |

## 만들면서 배운 것
- 충돌 판정에서 공의 "중심"이 아니라 "표면"을 기준으로 비교해야
  자연스럽다는 걸 알게 됐어요.
- 시간을 나눠 쓰니 의외로 동시에 작업하는 것보다 빨랐어요.
- 막힌 점을 항해 일지에 솔직하게 적으니까 다음 사람이 이어 받기 쉬웠어요.

## 아직 부족한 점
- 벽에 부딪혀서 튕기는 효과는 못 만들었어요.
- 공 여러 개를 동시에 시뮬레이션하면 느려져요.

## 다음에 해보고 싶은 것
- 공 색깔을 시간에 따라 바뀌게 하기
- 마우스 클릭으로 공을 던지는 모드 추가
`}</pre>
        </div>

        {/* 샘플 3 */}
        <div
          className="rounded-xl mb-6 overflow-hidden"
          style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}
        >
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <h3 className="font-display font-bold text-base flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <span>🎵</span> 샘플 3. 음악·예술 융합 작품
            </h3>
            <span
              className="font-mono text-xs px-2 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(232,67,147,0.15)', color: '#E84393' }}
            >
              융합 작품
            </span>
          </div>
          <pre
            className="px-5 py-4 text-[12.5px] leading-relaxed font-mono whitespace-pre-wrap m-0"
            style={{
              color: 'var(--color-text-primary)',
              backgroundColor: 'var(--color-bg-secondary)',
              overflowX: 'auto',
            }}
          >{`# 무지개 피아노 — 소리에 색을 입히다

키보드를 누르면 소리가 나면서, 그 소리에 맞는 색깔의 도형이
화면 위로 떠오르는 작품이에요.
"음악을 눈으로도 듣는다"는 느낌을 주고 싶었어요.

## 미리보기
👉 https://github.com/내이름/rainbow-piano 의 페이지

## 영감 받은 곳
- 미술 시간에 배운 "공감각" — 칸딘스키가 음악을 그림으로 그렸다는 이야기
- VPyLab의 "무지개 피아노" 예제

## 어떻게 만들었나
- 도(C)는 빨강, 레(D)는 주황... 무지개 순서대로 색깔을 정했어요.
- 키보드 입력은 if-elif 문으로, 색깔은 RGB 값을 직접 적었어요.
- 도형이 위로 떠오르면서 점점 작아지게 했더니 풍선 같아졌어요.

## 만든 사람
박지민 (당곡고등학교 1학년)

## 배운 점
- 소리와 색은 둘 다 "파동"이라는 걸 책에서 봤는데, 코드로
  연결해보니 진짜 그런 느낌이 들었어요.
- 키 12개를 if-elif로 다 적었더니 너무 길어졌어요.
  다음엔 dict로 정리해보고 싶어요.

## 부족한 점
- 동시에 두 키를 누르면 한 소리만 나요.
- 아직 흑건(검은 키)은 만들지 않았어요.
`}</pre>
        </div>

        <InfoBox kind="tip">
          <strong>샘플 그대로 써도 돼요.</strong> 이름·작품 내용·배운 점만 여러분 것으로 바꾸면 됩니다.
          항해 일지에 적어둔 "막힌 점", "다음 할 일", "한 일"이 그대로 소개글 재료가 돼요.
          글이 어색하면 친구에게 한 번 읽어 달라고 부탁해보세요.
        </InfoBox>

        <div className="my-12" />

        {/* ===== ❻ FAQ ===== */}
        <h2
          className="font-display text-2xl font-bold mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          자주 묻는 질문
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
          학생들이 자주 물어본 것들이에요.
        </p>

        <div className="mb-12">
          <FAQ q="혼자 해도 되나요?">
            네, 똑같이 잘 동작해요. 1인 팀의 팀장이 되는 거예요.
            저장하고 일지가 쌓이는 흐름은 그대로입니다.
          </FAQ>

          <FAQ q="완성 버튼을 누른 다음에도 계속 수정할 수 있나요?">
            네, 얼마든지요. 완성 버튼은 끝맺음이 아니라{' '}
            <strong>"여기까지 됐으니 소개글 한 번 만들어볼래요?"</strong> 정도의 의미예요.
            누른 뒤에도 코드 저장은 평소처럼 되고, 새 아이디어로 다시 고쳐도 됩니다.
            완성 버튼을 또 눌러서 소개글을 다시 만들어도 돼요.
            여러분이 직접 다듬은 소개글은 사라지지 않습니다.
          </FAQ>

          <FAQ q="GitHub 가입을 꼭 해야 하나요?">
            네, 작품을 안전하게 보관하려면 GitHub 가입이 필요해요. 한 번만 만들어두면
            평생 쓸 수 있어요. 가입이 어렵게 느껴지면 선생님이나 옆자리 친구에게
            도움을 받으세요.
          </FAQ>

          <FAQ q="실수로 잘못 저장했어요. 되돌릴 수 있나요?">
            네. 저장 하나하나가 체크포인트라서 이전 시점으로 언제든 돌아갈 수 있어요.
            "저장 기록" 화면에서 원하는 시점을 골라 코드를 그때로 복원할 수 있습니다.
          </FAQ>

          <FAQ q="친구가 저랑 같은 시간에 저장하면 어떻게 돼요?">
            걱정 안 해도 돼요. 시스템이 알아서 두 사람의 저장을 차례대로 정리합니다.
            아주 드물게 "잠시 후 다시 저장하세요" 메시지가 뜨면, 한 번 더 누르면 됩니다.
          </FAQ>

          <FAQ q="일지 안 쓰고 저장만 하면 안 돼요?">
            괜찮아요. 빠른 저장을 누르면 제목 한 줄만 써도 됩니다.
            다만 처음 들어와서 첫 저장 때, 그리고 30분 만에 다시 저장할 때는
            "오늘 뭐 했는지" 한 번씩 적게 됩니다. 나중에 회고할 때 본인이 가장 고마워해요.
          </FAQ>

          <FAQ q="친구 이름으로 일지를 쓸 수 있나요?">
            아니요. 일지의 작성자는 <em>저장 버튼을 누른 사람</em>으로 자동 기록돼서
            바꿀 수 없어요. 그래서 누가 무엇을 했는지가 항상 정확히 남습니다.
          </FAQ>

          <FAQ q="작품을 다른 사람에게 보여주고 싶어요.">
            저장하면 작품을 바로 볼 수 있는 미리보기 페이지가 자동으로 만들어져요.
            그 주소를 친구나 가족에게 보내주면 됩니다. 코드를 모르는 사람도 결과만 볼 수 있어요.
          </FAQ>

          <FAQ q="제 작품을 평가받을 때 뭘 보여주면 되나요?">
            평가 자료는 세 가지로 준비돼요. 두 개는 자동, 한 개는 직접 써요.
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li>
                <strong>완성된 작품</strong> (미리보기 페이지) —{' '}
                <span style={{ color: '#00B894' }}>저장하면 자동</span>으로 만들어져요.
              </li>
              <li>
                <strong>항해 일지</strong> (그동안의 과정) —{' '}
                <span style={{ color: '#00B894' }}>저장할 때마다 자동</span>으로 쌓여요.
              </li>
              <li>
                <strong>소개글(README)</strong> —{' '}
                <span style={{ color: '#F0883E' }}>여러분이 직접</span>{' '}
                다듬어요. 위의 <em>"소개글, 이렇게 쓰면 돼요"</em> 샘플을 참고하세요.
              </li>
            </ul>
            <span className="block mt-2">
              이 셋만 있으면 "내가 무엇을, 왜, 어떻게 만들었는지"가 다 설명돼요.
            </span>
          </FAQ>
        </div>

        {/* ===== 시작 버튼 ===== */}
        <section
          className="rounded-2xl p-8 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(74,108,247,0.08), rgba(0,184,148,0.08))',
            border: '1px solid var(--color-border)',
          }}
        >
          <h2
            className="font-display text-xl font-bold mb-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            준비됐어요!
          </h2>
          <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
            처음에는 가볍게, 좋아하는 예제 하나를 열어보는 것부터 시작해도 좋아요.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link to="/sandbox" className="btn-primary no-underline">
              프로젝트 시작하기
            </Link>
            <Link to="/examples" className="btn-secondary no-underline">
              예제 둘러보기
            </Link>
            <Link to="/missions" className="btn-secondary no-underline">
              미션으로 연습하기
            </Link>
          </div>
        </section>

        <footer
          className="text-center text-xs mt-12 pt-8"
          style={{ color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)' }}
        >
          <p>잘 모르겠는 게 있으면 담당 선생님이나 옆자리 친구에게 물어봐도 좋아요.</p>
        </footer>
      </main>
    </div>
  );
}
