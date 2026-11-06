import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkbookCourse from './WorkbookCourse';
import light from '../../data/light-sound-course';
import github from '../../data/github-project-course';

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('단계형 교재에서 학습 내용 접근', () => {
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
