import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';

function GuideSection({ title, children }) {
  return (
    <section className="mb-10">
      <h2 className="font-display text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
        {title}
      </h2>
      <div className="text-sm leading-relaxed space-y-3" style={{ color: 'var(--color-text-secondary)' }}>
        {children}
      </div>
    </section>
  );
}

export default function Guide() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <header className="mb-10">
          <h1 className="font-display text-3xl font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            팀 프로젝트 안내
          </h1>
          <p className="text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            친구와 코드를 나누어 만들고, 실행 결과를 비교하며 함께 문제를 해결합니다.
            저장 이력과 작업 기록을 보며 서로의 시도를 이어갈 수 있습니다.
          </p>
        </header>

        <p className="mb-10 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          GitHub 연결이 처음이라면{' '}
          <Link to="/courses/beg-github-project" style={{ color: 'var(--color-accent)' }}>GitHub 프로젝트 시작하기</Link>
          에서 프로젝트 생성부터 저장·복원·공유까지 순서대로 실습할 수 있습니다.
        </p>

        <GuideSection title="함께 만들며 배우는 것">
          <ul className="list-disc pl-5 space-y-2">
            <li>예상한 움직임과 실제 실행 결과를 비교하며 코드의 원리를 이해합니다.</li>
            <li>오류가 생긴 조건과 수정 방법을 설명하며 자신의 생각을 점검합니다.</li>
            <li>친구의 코드와 해결 방법을 읽고, 다른 접근을 자신의 작품에 적용합니다.</li>
            <li>이전 버전과 작업 기록을 돌아보며 다음에 시도할 일을 정합니다.</li>
          </ul>
        </GuideSection>

        <GuideSection title="1. 프로젝트 만들기와 합류">
          <ol className="list-decimal pl-5 space-y-2">
            <li>VPyLab에 로그인한 뒤 프로젝트 화면을 엽니다.</li>
            <li>한 명이 새 프로젝트를 만들고, 팀 멤버 화면에서 초대 코드를 공유합니다.</li>
            <li>팀원은 프로젝트 목록의 초대 코드 입력란에 코드를 넣고 합류합니다.</li>
          </ol>
          <p>
            VPyLab 안에서 함께 편집하고 저장하는 데 GitHub 연결은 필수가 아닙니다.
            혼자 작업할 때도 프로젝트 저장과 이력 복원을 사용할 수 있습니다.
          </p>
        </GuideSection>

        <GuideSection title="2. 역할 나누고 실행하기">
          <p>
            움직임, 충돌 조건, 소리처럼 맡을 부분을 정합니다.
            한 가지씩 바꾸고 실행해 예상한 결과가 나오는지 확인하세요.
          </p>
          <p>
            예를 들어 공의 속도를 바꾸기 전에 궤적이 어떻게 달라질지 예상해 보고,
            실행 결과를 친구와 비교합니다. 결과가 다르면 변수와 조건문을 함께 살펴봅니다.
          </p>
          <p>
            팀원이 저장한 뒤에는 최신 코드를 가져와 확인하고 이어서 작업합니다.
            같은 부분을 동시에 수정하려면 먼저 순서를 정하세요.
          </p>
        </GuideSection>

        <GuideSection title="3. 코드 저장과 기록 남기기">
          <div
            className="rounded-xl p-5 space-y-3"
            style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}
          >
            <p><strong>코드 저장</strong>은 현재 에디터의 코드를 프로젝트에 반영합니다.</p>
            <p>
              <strong>기록 남기기</strong>는 코드를 바꾸지 않고 한 일, 막힌 점, 다음 할 일을 남깁니다.
              역할 분담이나 시도한 방법을 적을 때 사용합니다.
            </p>
          </div>
          <p>
            기록 예: “공이 바닥을 통과해서 중심 좌표 대신 반지름을 포함해 충돌을 판단했다.
            다음에는 속도가 빠를 때도 확인한다.”
          </p>
          <p>
            기록은 직접 작성합니다. 무엇을 바꿨고 결과가 어땠는지 적어두면
            다음 시간에 작업을 이어가거나 팀원에게 도움을 요청하기 좋습니다.
          </p>
        </GuideSection>

        <GuideSection title="4. 저장 이력 확인과 복원">
          <p>
            프로젝트 상단의 <strong>📜 저장 이력</strong>에서 저장한 사람과 시점을 확인합니다.
            필요하면 이전 버전을 에디터로 복원해 실행 결과를 다시 확인할 수 있습니다.
          </p>
          <p>
            복원한 코드를 실행해 결과를 확인한 뒤 코드 저장으로 반영하세요.
            GitHub에도 반영하려면 복원 후 코드 저장이 필요합니다.
          </p>
        </GuideSection>

        <GuideSection title="GitHub 연결과 작품 공유">
          <p>
            GitHub를 연결하면 코드를 저장소에 반영하고 GitHub Pages 실행 페이지로 공유할 수 있습니다.
            갤러리 발행으로 작품을 공유하는 방법도 있습니다.
          </p>
          <p>
            VPyLab 초대 코드는 앱 안의 편집 권한입니다.
            팀원이 GitHub 저장소에도 직접 반영하려면 GitHub 공동작업자 권한이 추가로 필요합니다.
            연결 상태와 반영 결과는 저장 후 안내에서 확인하세요.
          </p>
        </GuideSection>

        <div className="flex gap-3 flex-wrap">
          <Link to="/sandbox" className="btn-primary no-underline">프로젝트 열기</Link>
          <Link to="/tutorials" className="btn-secondary no-underline">튜토리얼 체험하기</Link>
        </div>
      </main>
    </div>
  );
}
