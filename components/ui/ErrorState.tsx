// components/ui/ErrorState.tsx
interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
      <p className="text-mc-lo font-mono text-xs tracking-[0.14em] uppercase">Signal lost</p>
      <p className="text-mc-mid text-sm max-w-sm">
        {message ?? 'Something went wrong generating your session. Check your API key in .env.local.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-mono text-mc-coral border border-mc-border rounded px-4 py-2 hover:border-mc-coral transition-colors"
        >
          ⟳ Try again
        </button>
      )}
    </div>
  );
}
