/**
 * Centralized onboarding strings for localization.
 * Use exact copy from spec.
 */

export interface TutorialStep {
  title: string
  titleMobile?: string
  text: string
  textMobile?: string
  target?: string
  targetMobile?: string
  isInfoStep?: boolean
}

export const welcomeModal = {
  title: 'Welcome to Tigement',
  oneLiner: 'Plan → Change → Auto-fix.',
  body: 'Tigement is a timeline day planner. Plan with durations, and when reality changes, everything after it recalculates instantly—so your day stays realistic.',
  bullets: [
    'Instant reroute scheduling: change a duration → the rest updates immediately.',
    'Now / Next execution: the Timer helps you run the day.',
    'Two table types: Day tables (scheduled) + LIST tables (unscheduled).',
    'Local-first by default: data stays in your browser; export/backup when needed.',
  ],
  tutorialLink: 'Try the interactive tutorial (example Day + LIST tables)',
  videoLabel: 'Watch short video',
  footnote: 'Free local data can be lost if browser/site data is cleared—use Export/Backup if it matters.',
  buttons: {
    primary: 'Start tutorial',
    tertiary: 'Skip',
  },
  checkbox: "Don't show this again",
}

/** Copy for public (unauthenticated) landing: Register/Login CTAs */
export const publicLanding = {
  register: 'Register',
  login: 'Login',
  getStarted: 'Get started',
}

export const tutorialSteps: TutorialStep[] = [
  {
    title: 'A day plan that adapts',
    text: 'This is a safe demo. Try everything here—your real workspace won\'t change.',
    textMobile: undefined,
    target: undefined,
    isInfoStep: false,
  },
  {
    title: 'Set your day start',
    text: 'Click the day start time and set when your day begins. Watch the other task times recalculate automatically.',
    textMobile: undefined,
    target: 'day-start',
    isInfoStep: false,
  },
  {
    title: 'Edit a task name',
    text: 'Click a task name, edit it, then press Enter.',
    textMobile: undefined,
    target: 'task-breakfast-name',
    isInfoStep: false,
  },
  {
    title: 'Set a duration',
    text: 'Click Duration and choose a time (e.g., 30m, 45m, 1h). Watch start and finish times of tasks below update—so you know when each begins and whether you can fit them all in.',
    textMobile: undefined,
    target: 'task-plan-duration',
    isInfoStep: false,
  },
  {
    title: 'Fine-tune fast',
    titleMobile: 'Adjust duration',
    text: 'Hover Duration and use the mouse wheel to adjust. Tip: Shift = 1 min, Alt = 15 min (if supported). Notice how later tasks shift.',
    textMobile: 'Tap the duration, then use the +/- buttons or presets to change it. Notice how later tasks shift.',
    target: 'task-plan-duration',
    isInfoStep: false,
  },
  {
    title: 'Watch the reroute',
    text: 'When you change a duration or start time, finish times—and everything after—recalculate instantly. That\'s the core of Tigement.',
    textMobile: undefined,
    target: undefined,
    isInfoStep: true,
  },
  {
    title: 'Move a task in the day',
    text: 'Drag a task to a new position. The timeline reflows automatically.',
    textMobile: 'Tap the ▲ or ▼ buttons to move a task up or down. The timeline reflows automatically.',
    target: 'task-exercise-drag',
    targetMobile: 'task-exercise-row',
    isInfoStep: false,
  },
  {
    title: 'Switch between tables',
    text: 'Use the dropdown at the bottom to switch between your Day and LIST tables.',
    textMobile: 'Use the dropdown at the bottom to switch between your Day and LIST tables.',
    target: 'tutorial-table-dropdown',
    targetMobile: 'tutorial-table-dropdown',
    isInfoStep: false,
  },
  {
    title: 'Pull a LIST task into your schedule',
    text: 'Move a task from LIST into the Day table to schedule it.',
    textMobile: 'Long-press the task name, then choose the Day table to schedule it.',
    target: 'task-email-triage-name',
    isInfoStep: false,
  },
  {
    title: 'Push it back to LIST',
    text: 'Move a task from the Day table back into LIST to unschedule it.',
    textMobile: 'Long-press the task name, then choose the LIST table to unschedule it.',
    target: 'task-email-triage-name',
    isInfoStep: false,
  },
  {
    title: "You're ready",
    text: "Click Finish to close the tutorial and start planning.",
    textMobile: undefined,
    target: undefined,
    isInfoStep: false,
  },
]

export const tutorialButtons = {
  start: 'Start',
  back: 'Back',
  next: 'Next',
  skip: 'Skip',
  finish: 'Finish',
  resetDemo: 'Reset demo',
}
