const labels={problem:'문제 정의',experiment:'제작·실험',reasoning:'선택과 추론',collaboration:'동료 검토',nextStep:'다음 계획'};
const criteriaKinds={problem:['issue','issue_comment'],experiment:['commit','push'],reasoning:['pull_request','review_comment'],collaboration:['review','review_comment','issue_comment'],nextStep:['issue','pull_request']};

export function verifiedGitHubIdentity(identities) {
  if(!Array.isArray(identities))return null;
  const candidates=[];
  for(const identity of identities) {
    if(identity?.provider!=='github'||!identity.identity_data||typeof identity.identity_data!=='object')continue;
    const data=identity.identity_data,values=[data.provider_id,data.sub,data.id].filter(value=>typeof value==='string'||typeof value==='number').filter(value=>/^\d+$/.test(String(value))).map(Number);
    const ids=[...new Set(values.filter(value=>Number.isSafeInteger(value)&&value>0))];
    if(ids.length!==1)continue;
    const rawLogin=data.user_name??data.preferred_username??data.login,login=typeof rawLogin==='string'&&/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(rawLogin)?rawLogin:null;
    candidates.push({githubId:ids[0],login});
  }
  const ids=[...new Set(candidates.map(candidate=>candidate.githubId))];
  return ids.length===1?candidates.find(candidate=>candidate.githubId===ids[0]):null;
}

export function summarizeLearningEvidence(events,{checkpoints=[],reviews=[],reflections=[],peerReviews=[],hasMore=false,coverageNotice=''}={}) {
  const byKind={};for(const event of events)byKind[event.kind]=(byKind[event.kind]||0)+1;
  // 교실 안(지역) 근거: 팀 간 동료 리뷰는 GitHub 기록과 별도로 협업 영역에 셉니다. 건수는 성적이 아닙니다.
  const localEvidence={collaboration:`동료 리뷰 ${peerReviews.length}건`};
  const signals=Object.entries(criteriaKinds).map(([criterion,kinds])=>{
    const matching=events.filter(event=>kinds.includes(event.kind));
    return {criterion,label:labels[criterion],evidenceIds:matching.map(event=>event.id),...(localEvidence[criterion]?{localEvidence:localEvidence[criterion],localEvidenceIds:peerReviews.map(review=>review.id)}:{}),observation:matching.length?`표시된 GitHub 기록에서 ${labels[criterion]} 영역에 연결해 살펴볼 근거 ${matching.length}건이 있습니다. 원문과 학생의 설명을 함께 확인해주세요.`:`표시된 GitHub 기록에는 ${labels[criterion]} 영역에 연결한 근거가 없습니다. 로컬 실험과 대화에서 확인한 내용도 함께 살펴보세요.`};
  });
  const nextQuestions=[
    '이번 작업에서 해결하려던 문제와 성공 기준은 무엇이며, 어떤 기록에서 확인할 수 있나요?',
    '최근 코드 변경 전후에 무엇을 비교했고, 관찰한 결과는 처음 가설과 어떻게 달랐나요?',
    'PR이나 설명에 담은 선택 외에 어떤 대안을 생각했으며, 지금의 방법을 선택한 근거는 무엇인가요?',
    '동료의 질문이나 검토 중 무엇을 반영했으며, 반영하지 않은 의견에는 어떤 이유가 있나요?',
    '다음에 한 가지 조건을 바꾼다면 무엇을 확인하고 싶으며, 어떤 결과가 나오면 설명을 수정할 건가요?',
  ];
  return {evidenceCount:events.length,byKind,lastActivityAt:events.map(event=>event.occurredAt||event.receivedAt).filter(Boolean).sort().at(-1)||null,signals,nextQuestions,localEvidenceCounts:{checkpoints:checkpoints.length,reviews:reviews.length,reflections:reflections.length,peerReviews:peerReviews.length},limitations:[
    '이 요약은 관찰할 기록과 다음 질문을 정리합니다. 활동 건수로 성적이나 사고력 수준을 자동 판정하지 않습니다.',
    '숫자 GitHub 사용자 ID가 검증된 학생 계정과 연결된 기록만 개인 근거로 묶습니다. 로그인 이름, 이메일, 커밋 서명 이름으로 추측하지 않습니다.',
    'VPyLab 제출자는 실제 서버 작업의 요청자입니다. GitHub의 실제 작성자가 App 봇인 경우 그 작성자와 학생 제출자를 구분하여 표시합니다.',
    '수정·삭제·재검토는 여러 사건으로 남을 수 있습니다. 기록 건수는 독립적인 학습 성취의 수가 아닙니다.',
    ...(hasMore?['더 오래된 기록이 화면 범위 밖에 있습니다. 현재 목록만으로 전체 참여나 미참여를 판정하지 마세요.']:[]),
    ...(coverageNotice?[coverageNotice]:[]),
  ]};
}
