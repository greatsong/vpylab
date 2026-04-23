import Header from '../components/layout/Header';

const Section = ({ title, children }) => (
  <section
    className="mb-6 pb-6"
    style={{ borderBottom: '1px solid var(--color-border)' }}
  >
    <h2
      className="text-base font-bold mb-3"
      style={{ color: 'var(--color-text-primary)' }}
    >
      {title}
    </h2>
    <div
      className="text-sm leading-relaxed"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      {children}
    </div>
  </section>
);

export default function Privacy() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      <Header />
      <main className="max-w-2xl mx-auto px-6 py-12">
        <header className="mb-8">
          <h1
            className="text-2xl font-bold mb-2 tracking-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            개인정보 처리방침
          </h1>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            최종 수정일: 2026-04-23
          </p>
        </header>

        <Section title="1. 수집 목적">
          <p>
            VPyLab은 학생 식별 및 학습 이력·작품 관리를 위해 최소한의 개인정보를
            수집합니다.
          </p>
        </Section>

        <Section title="2. 수집 항목">
          <ul className="list-disc pl-5 space-y-1">
            <li>이메일, 이름 (Supabase 서울 리전에 저장)</li>
            <li>프로필 이미지 URL (OAuth 제공자가 전달한 경우, 선택)</li>
          </ul>
          <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            로그인은 Google 또는 GitHub OAuth 2.0으로만 진행되며, 비밀번호는
            수집·저장하지 않습니다.
          </p>
        </Section>

        <Section title="3. 보유 및 이용 기간">
          <p>해당 학년도 종료 후 일괄 파기합니다.</p>
        </Section>

        <Section title="4. 외부 API 사용 안내">
          <p className="mb-2">본 서비스는 다음 외부 API를 사용합니다.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>GitHub REST API</strong> — 학생 작품을 GitHub Pages에 발행하기
              위해 코드·제목·설명·메타데이터를 전송합니다. 이메일·이름 등 식별정보는
              전송되지 않습니다.
            </li>
            <li>
              <strong>Upstage Solar Pro</strong> — 선택 기능인 AI 힌트 제공 시
              코드 텍스트만 전송되며, 식별정보는 전송되지 않습니다.
            </li>
          </ul>
          <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            데이터는 서비스 운영을 위한 기술적 처리 목적으로만 사용되며, 외부 API
            제공사에 학생 식별정보가 전달되지 않도록 설계되었습니다.
          </p>
        </Section>

        <Section title="5. 안전성 확보 조치">
          <ul className="list-disc pl-5 space-y-1">
            <li>HTTPS 전 구간 암호화 (HSTS 2년, 서브도메인 포함)</li>
            <li>Supabase Row Level Security (RLS) 기반 접근 제어</li>
            <li>
              CSP, X-Frame-Options DENY, X-XSS-Protection 등 보안 헤더 적용
            </li>
            <li>작품 발행·공유 시 Rate Limiting(발행 3회/분, 공유 10회/분)</li>
            <li>발행 코드 내 API 키·민감정보 자동 검사</li>
            <li>GitHub 토큰은 DB에 저장하지 않고 요청 시 메모리에서만 사용</li>
          </ul>
        </Section>

        <Section title="6. 처리 위탁">
          <p>
            서비스 운영을 위해 다음 업체에 개인정보 처리를 위탁하고 있습니다.
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              <strong>Supabase</strong> (클라우드 데이터베이스, 서울 리전) —
              사용자 프로필·작품 데이터 저장
            </li>
          </ul>
        </Section>

        <Section title="7. 개인정보 보호책임자">
          <p>
            <strong style={{ color: 'var(--color-text-primary)' }}>석리송</strong>{' '}
            (당곡고등학교 정보과 교사)
          </p>
        </Section>

        <Section title="8. 열람 · 정정 · 삭제 요청">
          <p>
            개인정보의 열람, 정정, 삭제를 원하시는 경우 담당 교사에게 직접
            요청하시면 지체없이 처리합니다. 삭제 요청 시 해당 계정의 프로필,
            저장 코드, 미션 제출 기록이 함께 파기됩니다.
          </p>
        </Section>

        <Section title="9. 법령 근거">
          <p>
            본 처리방침은 「개인정보 보호법」 및 「초·중등교육법」 제29조의2에
            따라 작성되었으며, 법령·운영 정책 변경 시 갱신됩니다.
          </p>
        </Section>
      </main>
    </div>
  );
}
