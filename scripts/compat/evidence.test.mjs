import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sameCompatibilityEvidence } from './evidence.mjs';

test('옛 결과·다른 엔진·다른 코퍼스 결과를 현재 결과와 합치지 않는다', () => {
  const a = { api: 'a', corpus: 'b' };
  assert.equal(sameCompatibilityEvidence(a, { corpus: 'b', api: 'a' }), true);
  assert.equal(sameCompatibilityEvidence(a, { ...a, api: 'changed' }), false);
  assert.equal(sameCompatibilityEvidence(a, { ...a, corpus: 'changed' }), false);
  assert.equal(sameCompatibilityEvidence(a, undefined), false);
  assert.equal(sameCompatibilityEvidence({}, {}), false);
});
