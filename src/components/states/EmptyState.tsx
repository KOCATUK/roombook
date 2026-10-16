interface EmptyStateProps {
  message: string
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <p className="rounded-xl border border-dashed border-(--border) p-5 text-center text-(--text)">
      {message}
    </p>
  )
}
