import { describe, expect, it } from 'vitest';
import { embedCode, embedUrl, isGalleryId, workUrl } from './embed';

describe('임베드 주소와 코드', () => {
  it('uuid는 갤러리, 짧은 id는 공유 코드로 본다', () => {
    expect(isGalleryId('2f1c9a4e-5b6d-4c7e-8f90-123456789abc')).toBe(true);
    expect(isGalleryId('abc12345')).toBe(false);
    expect(workUrl('2f1c9a4e-5b6d-4c7e-8f90-123456789abc', 'https://vpylab.vercel.app')).toBe('https://vpylab.vercel.app/gallery/2f1c9a4e-5b6d-4c7e-8f90-123456789abc');
    expect(workUrl('abc12345', 'https://vpylab.vercel.app')).toBe('https://vpylab.vercel.app/s/abc12345');
  });

  it('임베드 코드는 배포 주소의 /embed/:id 를 가리키는 iframe이다', () => {
    expect(embedUrl('abc12345', 'https://vpylab.vercel.app')).toBe('https://vpylab.vercel.app/embed/abc12345');
    expect(embedCode('abc12345', { origin: 'https://vpylab.vercel.app' }))
      .toBe('<iframe src="https://vpylab.vercel.app/embed/abc12345" width="800" height="500" allow="autoplay; fullscreen" loading="lazy" title="VPyLab"></iframe>');
    // 주소에 들어갈 수 없는 글자는 이스케이프한다
    expect(embedUrl('a"b', 'https://x')).toBe('https://x/embed/a%22b');
  });
});
