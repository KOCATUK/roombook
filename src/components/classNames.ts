// Общие наборы классов: одинаковые элементы в разных компонентах не должны расходиться

export const FOCUS_RING_CLASS_NAME =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)'

export const PRIMARY_BUTTON_CLASS_NAME = `cursor-pointer rounded-lg bg-(--accent) px-4 py-2.5 font-medium text-white transition-[filter] duration-150 ease-[ease] enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:bg-(--border) disabled:text-(--text) dark:enabled:text-[#16171d] ${FOCUS_RING_CLASS_NAME}`

/** Карточка-панель без внутренних отступов: они у панелей разные */
export const PANEL_CLASS_NAME =
  'rounded-xl border border-(--border) bg-(--bg) text-(--text) shadow-(--shadow)'

export const PANEL_HEADING_CLASS_NAME = 'text-[20px] leading-[1.2]'
