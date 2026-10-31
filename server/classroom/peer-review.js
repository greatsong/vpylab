// 팀 간 동료 리뷰의 순수 규칙. 저장소나 HTTP에 의존하지 않아 단독으로 검증할 수 있습니다.
// 설계 원칙(바꾸지 않음): 배정은 교사가 하고, 형식은 "I like / I wish" 두 칸의 긍정적 피드백이며 점수·등급·승인 판정은 없습니다.

export const PEER_REVIEW_MIN_LENGTH = 20;
export const PEER_REVIEW_MAX_LENGTH = 1000;
export const PEER_REVIEW_MAX_PER_TEAM = 10;
export const PEER_REVIEW_MIN_DISTINCT = 5;

/**
 * 순환 배정: i번 팀이 i+1 … i+N번 팀을 검토합니다. 팀 수가 N+1보다 적으면 가능한 만큼만 배정하며,
 * 어떤 팀도 자기 팀을 검토하지 않습니다.
 */
export function planRoundRobin(projectIds, reviewsPerTeam) {
  const ids = [...new Set(projectIds)];
  const count = ids.length;
  const perTeam = Math.max(0, Math.min(reviewsPerTeam, count - 1));
  const pairs = [];
  for (let index = 0; index < count; index++) {
    for (let step = 1; step <= perTeam; step++) pairs.push({ reviewerProjectId: ids[index], targetProjectId: ids[(index + step) % count] });
  }
  return pairs;
}

/** like·wish 본문을 다듬고 길이를 확인합니다. 통과하면 다듬은 값을, 아니면 오류 코드를 돌려줍니다. */
export function normalizePeerReviewText(value, label) {
  if (typeof value !== 'string') return { error: 'peer_review_text_required', message: `${label} 칸을 적어주세요.` };
  const text = value.trim();
  if (!text) return { error: 'peer_review_text_required', message: `${label} 칸을 적어주세요.` };
  if (text.length < PEER_REVIEW_MIN_LENGTH) return { error: 'peer_review_text_too_short', message: `${label} 칸은 ${PEER_REVIEW_MIN_LENGTH}자 이상 적어주세요. 어떤 장면에서 그렇게 느꼈는지 함께 적으면 좋습니다.` };
  if (text.length > PEER_REVIEW_MAX_LENGTH) return { error: 'peer_review_text_too_long', message: `${label} 칸은 ${PEER_REVIEW_MAX_LENGTH}자까지 적을 수 있습니다.` };
  // 같은 글자 반복(ㅋㅋㅋㅋ…)이나 공백·기호만으로 길이를 채운 입력은 받지 않습니다. 서로 다른 글자·숫자가 5자 미만이면 거부합니다.
  if (new Set([...text].filter((char) => /[\p{L}\p{N}]/u.test(char))).size < PEER_REVIEW_MIN_DISTINCT) return { error: 'peer_review_text_repetitive', message: `${label} 칸에는 같은 글자를 반복하지 말고 어떤 장면에서 그렇게 느꼈는지 문장으로 적어주세요.` };
  return { text };
}
