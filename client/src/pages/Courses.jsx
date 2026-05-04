import { useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import courses, { getCourseById, COURSE_TRACKS } from '../data/courses';

/**
 * Courses — 한 페이지에서 3가지 모드를 라우팅 파라미터로 분기
 *   /courses                      → 전체 목록(트랙별 그룹화)
 *   /courses/:courseId            → 코스 상세(차시 일람)
 *   /courses/:courseId/:lessonId  → 코스 상세 + 해당 차시 활성
 *
 * 톤: 단색 + 보더 미니멀(그라데이션·과한 shadow 금지). UI Tailwind color는
 * `course.color`를 그대로 클래스로 사용. starlightTheme은 에듀플로 교재 사이트
 * 배포 색이며 본 페이지에는 직접 영향 없음(딥링크 패널의 색상 점으로만 노출).
 */

const TRACK_ORDER = ['beginner', 'fusion', 'tutorial'];

const TRACK_LABEL = {
  beginner: { ko: '입문 트랙', desc: '코딩이 처음인 학생용. 짧은 성공 경험을 빠르게 쌓는다.' },
  fusion: { ko: '융합 트랙', desc: '교과(수학·과학·미술·음악AI)와 코딩이 만나는 6~10차시.' },
  tutorial: { ko: '튜토리얼 트랙', desc: '자기 프로젝트의 시작 코드 — 베이스라인 모음.' },
};

// Tailwind 색상 키 → 보더/뱃지 클래스 매핑(JIT가 정적 추출하도록 명시)
const COLOR_CLASS = {
  sky: { border: 'border-sky-300', text: 'text-sky-600', bg: 'bg-sky-50' },
  emerald: { border: 'border-emerald-300', text: 'text-emerald-600', bg: 'bg-emerald-50' },
  amber: { border: 'border-amber-300', text: 'text-amber-700', bg: 'bg-amber-50' },
  indigo: { border: 'border-indigo-300', text: 'text-indigo-600', bg: 'bg-indigo-50' },
  rose: { border: 'border-rose-300', text: 'text-rose-600', bg: 'bg-rose-50' },
  teal: { border: 'border-teal-300', text: 'text-teal-700', bg: 'bg-teal-50' },
  slate: { border: 'border-slate-300', text: 'text-slate-700', bg: 'bg-slate-50' },
  blue: { border: 'border-blue-300', text: 'text-blue-700', bg: 'bg-blue-50' },
};

const fallbackColor = COLOR_CLASS.sky;

const EDUFLOW_BASE_URL = (import.meta.env?.VITE_EDUFLOW_BASE_URL || '').replace(/\/$/, '');
function eduflowSiteUrl(course) {
  // 에듀플로 배포 사이트 패턴: <eduflow>/p/vpylab-<courseId>/site/
  // VITE_EDUFLOW_BASE_URL 미설정 시 코스 detail 페이지에 안내만 표시
  if (!EDUFLOW_BASE_URL) return null;
  return `${EDUFLOW_BASE_URL}/p/vpylab-${course.id}/site/`;
}

function CourseCard({ course }) {
  const c = COLOR_CLASS[course.color] || fallbackColor;
  return (
    <Link
      to={`/courses/${course.id}`}
      className={`block no-underline rounded-xl border-2 ${c.border} p-5 transition-all hover:-translate-y-0.5`}
      style={{ backgroundColor: 'var(--color-bg-panel)' }}
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl leading-none">{course.icon}</div>
        <div className="flex-1 min-w-0">
          <div className={`text-[11px] font-semibold uppercase tracking-wider ${c.text}`}>
            {course.subject || '코딩'} · {course.sessions}차시
          </div>
          <h3 className="font-display text-base font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>
            {course.title.ko}
          </h3>
          <p className="text-xs mt-2 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
            {course.description}
          </p>
          <p className="text-[11px] mt-3" style={{ color: 'var(--color-text-muted)' }}>
            {course.targetGrade}
          </p>
        </div>
      </div>
    </Link>
  );
}

function CourseList() {
  const grouped = useMemo(() => {
    const map = {};
    for (const c of courses) {
      (map[c.track] ||= []).push(c);
    }
    return map;
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      <header className="mb-8">
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          코스
        </h1>
        <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
          7개 주제로 묶인 학습 트랙. 입문 3 · 융합 3 · 튜토리얼 1.
          각 코스는 VPyLab 실습과 에듀플로 교재(이론)가 한 짝으로 움직입니다.
        </p>
      </header>

      {TRACK_ORDER.map((trackKey) => {
        const list = grouped[trackKey] || [];
        if (list.length === 0) return null;
        const meta = TRACK_LABEL[trackKey];
        return (
          <section key={trackKey} className="mb-10">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {meta.ko}
              </h2>
              <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {list.length}개 코스
              </span>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
              {meta.desc}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CourseDetail({ courseId, lessonId }) {
  const navigate = useNavigate();
  const course = getCourseById(courseId);
  if (!course) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-center">
        <p style={{ color: 'var(--color-text-secondary)' }}>코스를 찾을 수 없습니다.</p>
        <Link to="/courses" className="text-sm mt-3 inline-block" style={{ color: 'var(--color-accent)' }}>
          ← 코스 목록으로
        </Link>
      </div>
    );
  }
  const c = COLOR_CLASS[course.color] || fallbackColor;
  const eduflowUrl = eduflowSiteUrl(course);

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
      <Link
        to="/courses"
        className="inline-block text-xs mb-5 no-underline"
        style={{ color: 'var(--color-text-muted)' }}
      >
        ← 코스 목록
      </Link>

      <header className={`rounded-xl border-2 ${c.border} ${c.bg} p-6 mb-8`}>
        <div className="flex items-start gap-4">
          <div className="text-4xl leading-none">{course.icon}</div>
          <div className="flex-1">
            <div className={`text-[11px] font-semibold uppercase tracking-wider ${c.text}`}>
              {course.track === 'beginner' ? '입문' : course.track === 'fusion' ? '융합' : '튜토리얼'}
              {' · '}{course.subject} · {course.sessions}차시
            </div>
            <h1 className="font-display text-2xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>
              {course.title.ko}
            </h1>
            <p className="text-sm mt-3" style={{ color: 'var(--color-text-secondary)' }}>
              {course.description}
            </p>
          </div>
        </div>
      </header>

      {course.audience && (
        <section className="mb-8">
          <h2 className="font-display text-base font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            대상 학습자
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {[
              ['프로필', course.audience.profile],
              ['사전 지식', course.audience.prerequisites],
              ['학습 동기', course.audience.motivation],
              ['교실 환경', course.audience.classroomSetting],
              ['교육과정 연계', course.audience.curriculumLink],
              ['평가 가이드', course.audience.assessmentHint],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border p-3"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-panel)' }}>
                <dt className="font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>{k}</dt>
                <dd style={{ color: 'var(--color-text-secondary)' }}>{v || '—'}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="mb-8">
        <h2 className="font-display text-base font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
          차시 일람
        </h2>
        <ol className="space-y-2">
          {course.lessons.map((l, idx) => {
            const active = l.id === lessonId;
            return (
              <li key={l.id}>
                <Link
                  to={`/courses/${course.id}/${l.id}`}
                  className={`block no-underline rounded-lg border p-3 transition-all ${active ? c.border : ''}`}
                  style={{
                    borderColor: active ? undefined : 'var(--color-border)',
                    backgroundColor: active ? 'var(--color-accent-bg)' : 'var(--color-bg-panel)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex-none w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center border ${c.border} ${c.text}`}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {l.title.ko}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                        {l.summary}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      {lessonId && (() => {
        const lesson = course.lessons.find((x) => x.id === lessonId);
        if (!lesson) return null;
        const sandboxHref = `/sandbox?lesson=${encodeURIComponent(course.id)}/${encodeURIComponent(lesson.id)}`;
        return (
          <section className={`rounded-xl border-2 ${c.border} p-5 mb-8`} style={{ backgroundColor: 'var(--color-bg-panel)' }}>
            <h2 className="font-display text-base font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              ▶ {lesson.title.ko}
            </h2>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>{lesson.summary}</p>
            <pre className="text-[11px] leading-relaxed rounded-lg p-3 overflow-auto"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                maxHeight: 320,
              }}>
              <code>{lesson.code}</code>
            </pre>
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={() => navigate(sandboxHref)}
                className="btn-primary text-xs !py-1.5 !px-3.5"
              >
                ✏️ 프로젝트(샌드박스)에서 실습
              </button>
            </div>
          </section>
        );
      })()}

      <section className="rounded-xl border p-5 mb-8"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-panel)' }}>
        <h2 className="font-display text-base font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
          📘 교사용 교재 (에듀플로)
        </h2>
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          이 코스의 이론 본문·미스컨셉션·교사 노트는 별도 Starlight 사이트로 발행됩니다.
          학생은 실습(VPyLab) → 이론(에듀플로) → 변형 도전을 한 흐름으로 진행합니다.
        </p>
        {eduflowUrl ? (
          <a
            href={eduflowUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-xs !py-1.5 !px-3.5 inline-block no-underline"
          >
            📘 교재 사이트 열기
          </a>
        ) : (
          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            교재 사이트 URL이 환경변수(<code>VITE_EDUFLOW_BASE_URL</code>)에 설정되면
            여기에 직접 링크가 노출됩니다. 시드된 프로젝트 ID:
            <code className="ml-1">vpylab-{course.id}</code>
          </p>
        )}
      </section>
    </div>
  );
}

export default function Courses() {
  const { courseId, lessonId } = useParams();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-primary)' }}>
      <Header />
      {courseId ? (
        <CourseDetail courseId={courseId} lessonId={lessonId} />
      ) : (
        <CourseList />
      )}
    </div>
  );
}
