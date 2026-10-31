// 동료 리뷰의 화면 쪽 규칙. 서버의 server/classroom/peer-review.js와 같은 길이 기준을 사용합니다.
export const PEER_REVIEW_MIN = 20;
export const PEER_REVIEW_MAX = 1000;
export const fields = [
  { key: 'like', label: 'I like — 좋았던 점', guide: '동료의 작품에서 좋았던 장면과 그렇게 느낀 이유를 적습니다.', example: '빛이 음악에 맞춰 바뀌는 부분이 인상적이었어요.' },
  { key: 'wish', label: 'I wish — 이렇게 되면 더 좋겠어요', guide: '바꿔 보면 더 좋아질 것 같은 점을 제안으로 적습니다. 잘못을 지적하는 칸이 아닙니다.', example: '카메라가 조금 더 천천히 돌면 더 잘 보일 것 같아요.' },
];

/** 두 칸을 모두 20~1000자로 적었는지 확인합니다. 서버와 같은 기준입니다. */
export function validatePeerReview(form) {
  for (const { key, label } of fields) {
    const length = (form[key] || '').trim().length;
    if (!length) return `${label} 칸을 적어주세요.`;
    if (length < PEER_REVIEW_MIN) return `${label} 칸은 ${PEER_REVIEW_MIN}자 이상 적어주세요. 어떤 장면에서 그렇게 느꼈는지 함께 적으면 좋습니다.`;
    if (length > PEER_REVIEW_MAX) return `${label} 칸은 ${PEER_REVIEW_MAX}자까지 적을 수 있습니다.`;
  }
  return '';
}
