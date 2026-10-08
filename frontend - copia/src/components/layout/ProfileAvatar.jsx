export const PROFILE_COLORS = ["#1B2A3A", "#16B8A7", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#10B981", "#64748B"];

export const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

export const ProfileAvatar = ({ profile, size = 36, className = "" }) => (
  <span
    className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${className}`}
    style={{ width: size, height: size, background: profile?.color || "#1B2A3A", fontSize: size * 0.38 }}
  >
    {initials(profile?.name)}
  </span>
);
