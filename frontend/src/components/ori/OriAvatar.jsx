export const ORI_EXPRESSIONS = ["neutral", "happy", "wink", "thinking", "idea", "waving"];

export const OriAvatar = ({ expression = "neutral", size = 40, className = "", testId }) => (
  <span
    data-testid={testId || `ori-avatar-${expression}`}
    data-expression={expression}
    className={`ori-avatar inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-slate-200 ${className}`}
    style={{ width: size, height: size }}
  >
    <img src={`/ori/avatar-${expression}.png`} alt={`Ori ${expression}`} className="h-full w-full object-cover" draggable={false} />
  </span>
);

export const OriHero = ({ expression = "waving", className = "h-48", testId }) => (
  <img
    data-testid={testId || `ori-hero-${expression}`}
    data-expression={expression}
    src={`/ori/${expression}.png`}
    alt={`Ori ${expression}`}
    className={`w-auto max-w-full object-contain select-none mix-blend-multiply ${className}`}
    draggable={false}
  />
);
