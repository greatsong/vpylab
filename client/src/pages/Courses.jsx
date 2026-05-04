import { useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import courses, { getCourseById } from '../data/courses';

/**
 * Courses — 한 페이지에서 3가지 모드를 라우팅 파라미터로 분기
 *   /courses                      → 전체 목록(트랙별 그룹)
 *   /courses/:courseId            → 코스 상세
 *   /courses/:courseId/:lessonId  → 코스 상세 + 차시 활성(우측 sticky 패널)
 *
 * 디자인 원칙: 단색 + 1px 보더 + 굵은 좌측 액센트 보더. 그라데이션·shadow 금지.
 */

const TRACK_ORDER = ['beginner', 'fusion', 'tutorial'];

const TRACK_LABEL = {
  beginner: { ko: '입문', desc: '코딩이 처음인 학생용. 짧은 성공 경험을 빠르게 쌓는다.' },
  fusion: { ko: '융합', desc: '교과(수학·과학·미술·음악)와 코딩이 만나는 6~7차시.' },
  tutorial: { ko: '튜토리얼', desc: '자기 프로젝트의 시작 코드 — 베이스라인 모음.' },
};

// 단색+보더 톤. 카드 액센트는 좌측 4px 굵은 보더 + 라벨 텍스트 색만.
const COLOR_CLASS = {
  sky:     { ring: 'border-sky-500',     text: 'text-sky-700',     softBg: 'bg-sky-50',     hex: '#0EA5E9' },
  emerald: { ring: 'border-emerald-500', text: 'text-emerald-700', softBg: 'bg-emerald-50', hex: '#10B981' },
  amber:   { ring: 'border-amber-500',   text: 'text-amber-700',   softBg: 'bg-amber-50',   hex: '#F59E0B' },
  indigo:  { ring: 'border-indigo-500',  text: 'text-indigo-700',  softBg: 'bg-indigo-50',  hex: '#4F46E5' },
  rose:    { ring: 'border-rose-500',    text: 'text-rose-700',    softBg: 'bg-rose-50',    hex: '#E11D48' },
  teal:    { ring: 'border-teal-500',    text: 'text-teal-700',    softBg: 'bg-teal-50',    hex: '#0D9488' },
  slate:   { ring: 'border-slate-500',   text: 'text-slate-700',   softBg: 'bg-slate-100',  hex: '#64748B' },
  blue:    { ring: 'border-blue-500',    text: 'text-blue-700',    softBg: 'bg-blue-50',    hex: '#2563EB' },
};
const fallbackColor = COLOR_CLASS.sky;

const TEXTBOOK_BASE_URL = (
  import.meta.env?.VITE_TEXTBOOK_BASE_URL || 'https://greatsong.github.io/vpylab-textbook'
).replace(/\/$/, '');
const textbookSiteUrl = (course) => `${TEXTBOOK_BASE_URL}/${course.id}/`;

const trackLabel = (track) =>
  track === 'beginner' ? '입문' : track === 'fusion' ? '융합' : '튜토리얼';

// ─── 카드 (목록 페이지) ──────────────────────────────────
function CourseCard({ course }) {
  const c = COLOR_CLASS[course.color] || fallbackColor;
  return (
    <Link
      to={`/courses/${course.id}`}
      className={`group relative block no-underline border rounded-xl overflow-hidden transition-colors`}
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg-panel)',
      }}
    >
      {/* 좌측 액센트 보더 */}
      <span className={`absolute left-0 top-0 h-full w-1 ${c.ring}`} style={{ backgroundColor: 'currentColor' }} />
      <div className="pl-6 pr-5 py-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none mt-0.5">{course.icon}</span>
          <div className="flex-1 min-w-0">
            <div className={`text-[10px] font-bold uppercase tracking-[0.08em] ${c.text}`}>
              {trackLabel(course.track)} · {course.subject || '코딩'} · {course.sessions}차시
            </div>
            <h3
              className="font-display text-[15px] font-bold mt-1.5 leading-snug"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {course.title.ko}
            </h3>
            <p
              className="text-[12.5px] mt-2 line-clamp-3 leading-relaxed"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {course.description}
            </p>
          </div>
        </div>
        <div
          className="mt-4 pt-3 text-[11px] flex items-center justify-between"
          style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
        >
          <span>{course.targetGrade}</span>
          <span className={`${c.text} font-semibold transition-transform group-hover:translate-x-0.5`}>
            자세히 →
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── 코스 목록 ──────────────────────────────────────────
function CourseList() {
  const grouped = useMemo(() => {
    const map = {};
    for (const c of courses) (map[c.track] ||= []).push(c);
    return map;
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
      <header className="mb-12 max-w-2xl">
        <p
          className="text-[11px] font-bold uppercase tracking-[0.1em] mb-2"
          style={{ color: 'var(--color-accent)' }}
        >
          Learning Tracks
        </p>
        <h1
          className="font-display text-[28px] md:text-[34px] font-bold leading-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          7개의 학습 코스
        </h1>
        <p
          className="text-[14px] mt-3 leading-relaxed"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          입문 3 · 융합 3 · 튜토리얼 1. 각 코스는 VPyLab 실습과
          교사용 Starlight 교재가 한 짝으로 움직입니다.
        </p>
      </header>

      {TRACK_ORDER.map((trackKey) => {
        const list = grouped[trackKey] || [];
        if (list.length === 0) return null;
        const meta = TRACK_LABEL[trackKey];
        return (
          <section key={trackKey} className="mb-14">
            <div className="flex items-baseline justify-between mb-1">
              <h2
                className="font-display text-[18px] font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {meta.ko}
              </h2>
              <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {list.length}개 코스
              </span>
            </div>
            <p className="text-[12.5px] mb-5" style={{ color: 'var(--color-text-muted)' }}>
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

// ─── 차시 리스트 (한 줄씩) ───────────────────────────────
function LessonRow({ course, lesson, idx, active, color }) {
  return (
    <Link
      to={`/courses/${course.id}/${lesson.id}`}
      className="group relative block no-underline transition-colors"
      style={{
        backgroundColor: active ? 'var(--color-accent-bg)' : 'transparent',
      }}
    >
      <span
        className={`absolute left-0 top-0 h-full transition-all ${color.ring}`}
        style={{
          width: active ? '4px' : '0px',
          backgroundColor: 'currentColor',
        }}
      />
      <div className="flex items-center gap-4 px-5 py-3.5">
        <span
          className={`flex-none w-8 h-8 rounded-full text-[12.5px] font-bold flex items-center justify-center border ${color.ring} ${color.text}`}
          style={{
            backgroundColor: active ? 'var(--color-bg-primary)' : 'transparent',
          }}
        >
          {idx + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p
            className="text-[14px] font-semibold leading-snug"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {lesson.title.ko}
          </p>
          <p
            className="text-[12px] mt-0.5 line-clamp-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {lesson.summary}
          </p>
        </div>
        <span
          className={`text-[12px] ${color.text} opacity-60 group-hover:opacity-100 transition-opacity`}
        >
          {active ? '●' : '→'}
        </span>
      </div>
    </Link>
  );
}

// ─── 코스 디테일 ─────────────────────────────────────────
function CourseDetail({ courseId, lessonId }) {
  const navigate = useNavigate();
  const course = getCourseById(courseId);

  if (!course) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p style={{ color: 'var(--color-text-secondary)' }}>코스를 찾을 수 없습니다.</p>
        <Link to="/courses" className="text-sm mt-4 inline-block underline" style={{ color: 'var(--color-accent)' }}>
          ← 코스 목록으로
        </Link>
      </div>
    );
  }

  const c = COLOR_CLASS[course.color] || fallbackColor;
  const textbookUrl = textbookSiteUrl(course);
  const activeLesson = lessonId ? course.lessons.find((x) => x.id === lessonId) : null;

  const audienceFields = [
    ['프로필', course.audience?.profile],
    ['사전 지식', course.audience?.prerequisites],
    ['학습 동기', course.audience?.motivation],
    ['교실 환경', course.audience?.classroomSetting],
    ['교육과정 연계', course.audience?.curriculumLink],
    ['평가 가이드', course.audience?.assessmentHint],
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <Link
        to="/courses"
        className="inline-flex items-center gap-1 text-[12px] mb-6 no-underline"
        style={{ color: 'var(--color-text-muted)' }}
      >
        ← 코스 목록
      </Link>

      {/* 코스 헤더 — 좌측 굵은 보더 액센트 */}
      <header
        className={`relative pl-6 mb-12 max-w-3xl`}
        style={{ borderLeft: `4px solid ${c.hex}` }}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl leading-none">{course.icon}</span>
          <div className={`text-[11px] font-bold uppercase tracking-[0.1em] ${c.text}`}>
            {trackLabel(course.track)} · {course.subject} · {course.sessions}차시
          </div>
        </div>
        <h1
          className="font-display text-[28px] md:text-[36px] font-bold mt-3 leading-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {course.title.ko}
        </h1>
        <p
          className="text-[15px] mt-3 leading-relaxed"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {course.description}
        </p>
        <p className="text-[12px] mt-3" style={{ color: 'var(--color-text-muted)' }}>
          대상: {course.targetGrade}
        </p>
      </header>

      {/* 2-column: 좌측 메인, 우측 sticky */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-x-12 gap-y-10">

        {/* ── 좌측 메인 ── */}
        <div className="min-w-0 space-y-12">

          {/* 대상 학습자 */}
          {course.audience && (
            <section>
              <h2
                className="font-display text-[15px] font-bold mb-4 uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                대상 학습자
              </h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                {audienceFields.map(([k, v]) => (
                  <div key={k} className="border-l-2 pl-4" style={{ borderColor: 'var(--color-border)' }}>
                    <dt className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
                      {k}
                    </dt>
                    <dd className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                      {v || '—'}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* 차시 일람 */}
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <h2
                className="font-display text-[15px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                차시 일람
              </h2>
              <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                총 {course.lessons.length}차시
              </span>
            </div>
            <ol
              className="rounded-lg overflow-hidden"
              style={{
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-panel)',
              }}
            >
              {course.lessons.map((l, i) => (
                <li key={l.id} style={{
                  borderTop: i === 0 ? 'none' : '1px solid var(--color-border)',
                }}>
                  <LessonRow
                    course={course}
                    lesson={l}
                    idx={i}
                    active={l.id === lessonId}
                    color={c}
                  />
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* ── 우측 sticky 패널 ── */}
        <aside className="lg:sticky lg:top-20 lg:self-start space-y-4">

          {/* 활성 lesson */}
          {activeLesson ? (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-panel)' }}
            >
              <div className={`px-5 py-4 border-b ${c.softBg}`} style={{ borderColor: 'var(--color-border)' }}>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${c.text} mb-1`}>
                  현재 차시
                </div>
                <h3
                  className="font-display text-[16px] font-bold leading-snug"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {activeLesson.title.ko}
                </h3>
                <p className="text-[12px] mt-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  {activeLesson.summary}
                </p>
              </div>
              <pre
                className="text-[11.5px] leading-[1.55] p-4 overflow-auto"
                style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  maxHeight: 280,
                  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                }}
              >
                <code>{activeLesson.code}</code>
              </pre>
              <div className="px-5 py-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                <button
                  onClick={() => navigate(
                    `/sandbox?lesson=${encodeURIComponent(course.id)}/${encodeURIComponent(activeLesson.id)}`,
                  )}
                  className="btn-primary w-full text-[13px] !py-2"
                >
                  ✏️ 프로젝트(샌드박스)에서 실습
                </button>
              </div>
            </div>
          ) : (
            <div
              className="rounded-xl p-5"
              style={{
                border: '1px dashed var(--color-border)',
                backgroundColor: 'var(--color-bg-panel)',
              }}
            >
              <p className="text-[12.5px]" style={{ color: 'var(--color-text-muted)' }}>
                좌측에서 차시를 선택하면 코드와 실습 버튼이 여기에 나타납니다.
              </p>
            </div>
          )}

          {/* 교재 사이트 */}
          <div
            className="rounded-xl p-5"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-panel)' }}
          >
            <div className={`text-[10px] font-bold uppercase tracking-wider ${c.text} mb-2`}>
              교사용 교재
            </div>
            <h3
              className="font-display text-[15px] font-bold mb-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              📘 Starlight 교재 사이트
            </h3>
            <p className="text-[12px] mb-4 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              이론 본문·미스컨셉션·교사 노트가 차시별로 정리된 정적 사이트입니다.
              실습(VPyLab) → 이론(교재) → 변형 도전을 한 흐름으로.
            </p>
            <a
              href={textbookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold no-underline"
              style={{ color: 'var(--color-accent)' }}
            >
              교재 사이트 열기 →
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── 페이지 엔트리 ──────────────────────────────────────
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
