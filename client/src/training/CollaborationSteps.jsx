export default function CollaborationSteps({ program, classroom, activity, value = {} }) {
  const short = program.sessionCount === 3;
  const prefix = program.id === 'three-ai' ? 'ai' : 'no-ai';
  const targets = short ? [['math', '비례 실험 팀'], ['sound', '소리 실험 팀']].map(([key, title]) => ({ title, project: classroom?.projects?.[`${prefix}-${key}`] })) : [];
  const summary = `변경 제안: ${activity.title}\n예상: ${value.prediction || '(작성할 내용)'}\n관찰: ${value.observation || '(작성할 내용)'}\n판단 이유: ${value.reasoning || '(작성할 내용)'}\n짝 검토: ${value.peer || '(작성할 내용)'}\n다음 확인: ${value.nextStep || '(작성할 내용)'}`;
  return <section className="tr-card tr-collaboration">
    <span className="tr-kicker">질문 → 개인 실험 → 변경 제안 → 동료 재현 → 검토·응답 → 팀 반영</span>
    <h2>동료가 실행하고, 근거로 검토합니다.</h2>
    {short && <p>한 조는 제안 하나만 완성합니다. A는 제안·응답, B는 재현·검토를 맡고 마지막 시연에서 역할을 바꿉니다. 기본은 2차시 변경을 정리하는 것이며 새 값 실험은 여유가 있을 때만 합니다.</p>}
    <ol><li>해결할 질문과 바꿀 한 줄, 유지할 조건을 함께 정합니다.</li><li>조작자는 수정하고, 검토자는 원본·수정본을 같은 조건으로 실행합니다.</li><li>교실의 개인 초안에 코드를 옮기고, ‘변경 제안’에 예상·관찰·판단을 넣습니다.</li><li>다른 역할이 구체적인 수치와 질문을 남깁니다. 보완한 뒤 승인하고 팀 버전으로 반영합니다.</li><li>{short ? '마지막 미니 시연에서 역할을 바꾸어 설명하고, 받은 의견을 반영한 이유를 기록합니다.' : '역할을 바꾸고, 받은 의견을 채택하거나 유지한 이유를 기록합니다.'}</li></ol>
    <details className="tr-details"><summary>교실로 옮길 변경 제안 문장 보기</summary><pre className="tr-proposal-summary">{summary}</pre><p>위 문장과 ‘Python 코드’를 복사해 교실의 초안·변경 제안 양식에 옮깁니다. 워크북 기록이 교실에 자동 전송되는 기능은 아닙니다.</p></details>
    <div className="tr-inline">{targets.map(({ title, project }) => <a key={title} className="cr-button" href={project ? `/classroom.html#/projects/${project.id}` : '/classroom.html'} target="_blank" rel="noreferrer">{title} 열기 ↗</a>)}{!short && <a className="cr-button primary" href="/classroom.html" target="_blank" rel="noreferrer">연수용 협력 교실 열기 ↗</a>}</div>
    <p>이 컴퓨터에서 ‘학생 가·학생 나’ 역할을 번갈아 선택하거나, 서로 다른 브라우저 프로필로 역할을 나눠 체험합니다. 다른 노트북의 127.0.0.1 주소는 각자의 컴퓨터를 가리킵니다.</p>
    <p className="tr-note">{classroom?.mode === 'offline' ? '제안·리뷰·팀 반영은 별도 연수 DB에 보존됩니다. ' : '교실 연결이 어려우면 코드 파일과 활동지로 짝 재현을 진행합니다. '}실제 GitHub PR·리뷰는 강사가 테스트 저장소·서로 다른 계정·권한을 미리 준비한 경우에 진행하고, 수행 여부를 따로 기록합니다.</p>
  </section>;
}
