import { useId } from 'react'
import type { Ref } from 'react'
import { PANEL_CLASS_NAME, PANEL_HEADING_CLASS_NAME, PRIMARY_BUTTON_CLASS_NAME } from './classNames'

interface SignInPromptProps {
  onSignIn: () => void
  /** Позволяет родителю перевести фокус на кнопку после выбора комнаты */
  buttonRef?: Ref<HTMLButtonElement>
}

export function SignInPrompt({ onSignIn, buttonRef }: SignInPromptProps) {
  const headingId = useId()

  return (
    <section
      className={`flex flex-col items-start gap-3 p-5 ${PANEL_CLASS_NAME}`}
      aria-labelledby={headingId}
    >
      <h2 className={PANEL_HEADING_CLASS_NAME} id={headingId}>
        Новая бронь
      </h2>
      <p>Смотреть расписание можно без входа. Чтобы забронировать комнату, войдите через GitHub.</p>
      <button
        ref={buttonRef}
        type="button"
        className={PRIMARY_BUTTON_CLASS_NAME}
        onClick={onSignIn}
      >
        Войти через GitHub
      </button>
    </section>
  )
}
