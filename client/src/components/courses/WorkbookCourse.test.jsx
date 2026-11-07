import { act } from '@testing-library/react';
import { I18nProvider } from '../../i18n';
import useAppStore from '../../stores/appStore';
import { localizeCourse } from '../../i18n/owned-content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkbookCourse from './WorkbookCourse';
import light from '../../data/light-sound-course';
import github from '../../data/github-project-course';

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => act(()=>useAppStore.getState().setLocale('ko')));

describe('단계형 교재에서 학습 내용 접근', () => {
  it('영문 교재에서도 실행·변형·만들기·확인 단계의 내용이 이어진다', () => {
    act(()=>useAppStore.getState().setLocale('en'));
    const course=localizeCourse(light,'en'),lesson=course.lessons[0];
    const view=render(<MemoryRouter><I18nProvider><WorkbookCourse course={course} lessonId={lesson.id}/></I18nProvider></MemoryRouter>);
    expect(screen.getByRole('heading',{name:lesson.title.en})).toBeVisible();
    expect(screen.getByLabelText('Code to predict').textContent).toContain('play_note_and_wait("C4"');
    fireEvent.click(screen.getByRole('button',{name:'Run'}));
    const result=screen.getByText(lesson.guide.observe);
    expect(result.closest('details')).not.toHaveAttribute('open');
    fireEvent.click(result.closest('details').querySelector('summary'));
    expect(result).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'Modify'}));
    expect(screen.getByText(`1. ${lesson.guide.experiments[0].change}`)).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'Create'}));
    expect(screen.getByText(lesson.guide.challenge.task)).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'Check'}));
    expect(screen.getByText(lesson.guide.reflection)).toBeVisible();
    view.unmount();act(()=>useAppStore.getState().setLocale('ko'));
  });

  it('코드를 보며 예상하고 실행·실험·과제·확인까지 빠짐없이 읽을 수 있다', () => {
    const lesson = light.lessons[6];
    render(<MemoryRouter><WorkbookCourse course={light} lessonId={lesson.id} /></MemoryRouter>);
    expect(screen.getByLabelText('예상할 코드').textContent).toBe(lesson.code);
    expect(screen.queryByRole('link', { name: '코드 열고 실습하기 →' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '실행' }));
    expect(screen.getByRole('link', { name: '코드 열고 실습하기 →' })).toHaveAttribute('href', `/sandbox?lesson=${light.id}/${lesson.id}`);
    expect(screen.getByRole('link', { name: '코드 열고 실습하기 →' })).not.toHaveAttribute('target');
    expect(screen.getByText(lesson.guide.support)).toBeVisible();
    expect(screen.getByText('소리 대신 화면으로 해보기').closest('details')).not.toHaveAttribute('open');
    fireEvent.click(screen.getByRole('button', { name: '바꾸기' }));
    expect(screen.getByText(`1. ${lesson.guide.experiments[0].change}`)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '만들기' }));
    expect(screen.getByText(lesson.guide.challenge.task)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(screen.getByText(lesson.guide.checks[0].question)).toBeVisible();
    expect(screen.getByText(lesson.guide.reflection)).toBeVisible();
  });

  it('코드가 없는 GitHub 교재는 네 단계로 실제 절차와 확인을 제공한다', () => {
    const lesson = github.lessons[1];
    render(<MemoryRouter><WorkbookCourse course={github} lessonId={lesson.id} /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: '바꾸기' })).not.toBeInTheDocument();
    expect(screen.getByText(/이 앱은 누구나 볼 수 있는 공개 GitHub 저장소/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '따라 하기' }));
    expect(screen.getByText(lesson.guide.steps[0].body)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(screen.getByText(lesson.guide.challenge.task)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(screen.getByText(lesson.guide.reflection)).toBeVisible();
  });
});
