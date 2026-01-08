import { createSignal, createMemo, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "../../stores/auth";

export default function Register() {
  const navigate = useNavigate();
  const { signUp, error } = useAuth();

  const [name, setName] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const [touched, setTouched] = createSignal({
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  const nameError = createMemo(() => {
    if (!touched().name) return null;
    if (!name()) return "Name is required";
    if (name().length < 2) return "Name must be at least 2 characters";
    return null;
  });

  const emailError = createMemo(() => {
    if (!touched().email) return null;
    if (!email()) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email())) return "Enter a valid email";
    return null;
  });

  const passwordError = createMemo(() => {
    if (!touched().password) return null;
    if (!password()) return "Password is required";
    if (password().length < 8) return "Password must be at least 8 characters";
    return null;
  });

  const confirmPasswordError = createMemo(() => {
    if (!touched().confirmPassword) return null;
    if (!confirmPassword()) return "Please confirm your password";
    if (password() !== confirmPassword()) return "Passwords do not match";
    return null;
  });

  const passwordStrength = createMemo(() => {
    const p = password();
    if (!p) return { score: 0, label: "", color: "" };

    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^a-zA-Z0-9]/.test(p)) score++;

    if (score <= 1) return { score: 1, label: "Weak", color: "#ef4444" };
    if (score <= 2) return { score: 2, label: "Fair", color: "#f59e0b" };
    if (score <= 3) return { score: 3, label: "Good", color: "#84cc16" };
    return { score: 4, label: "Strong", color: "#22c55e" };
  });

  const isValid = createMemo(() => {
    return (
      name() &&
      email() &&
      password() &&
      confirmPassword() &&
      !nameError() &&
      !emailError() &&
      !passwordError() &&
      !confirmPasswordError()
    );
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, confirmPassword: true });

    if (!isValid()) return;

    setSubmitting(true);
    const success = await signUp(email(), password(), name());
    setSubmitting(false);

    if (success) {
      navigate("/");
    }
  };

  const handleBlur = (field: "name" | "email" | "password" | "confirmPassword") => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  return (
    <div
      class="min-h-screen flex items-center justify-center p-4 py-12"
      style={{ background: "var(--color-surface)" }}
    >
      <div class="w-full max-w-[420px] animate-fade-in">
        <header class="text-center mb-10">
          <h1
            class="font-serif text-4xl tracking-tight mb-3"
            style={{ color: "var(--color-text-primary)" }}
          >
            Create an account
          </h1>
          <p
            class="font-sans text-base"
            style={{ color: "var(--color-text-muted)" }}
          >
            Join us and get started today
          </p>
        </header>

        <main
          class="p-8 rounded-xl"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
          }}
        >
          <Show when={error()}>
            <div
              role="alert"
              aria-live="polite"
              class="auth-error mb-6 animate-slide-in"
            >
              <svg
                aria-hidden="true"
                class="w-5 h-5 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clip-rule="evenodd"
                />
              </svg>
              <span>{error()}</span>
            </div>
          </Show>

          <form onSubmit={handleSubmit} novalidate>
            <div class="space-y-5">
              <div>
                <label for="name" class="auth-label">
                  Full name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autocomplete="name"
                  required
                  aria-required="true"
                  aria-invalid={nameError() ? "true" : "false"}
                  aria-describedby={nameError() ? "name-error" : undefined}
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                  onBlur={() => handleBlur("name")}
                  disabled={submitting()}
                  class="auth-input"
                  placeholder="Your name"
                />
                <Show when={nameError()}>
                  <p
                    id="name-error"
                    role="alert"
                    class="mt-2 text-sm animate-slide-in"
                    style={{ color: "#fca5a5" }}
                  >
                    {nameError()}
                  </p>
                </Show>
              </div>

              <div>
                <label for="email" class="auth-label">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autocomplete="email"
                  inputmode="email"
                  required
                  aria-required="true"
                  aria-invalid={emailError() ? "true" : "false"}
                  aria-describedby={emailError() ? "email-error" : undefined}
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                  onBlur={() => handleBlur("email")}
                  disabled={submitting()}
                  class="auth-input"
                  placeholder="you@example.com"
                />
                <Show when={emailError()}>
                  <p
                    id="email-error"
                    role="alert"
                    class="mt-2 text-sm animate-slide-in"
                    style={{ color: "#fca5a5" }}
                  >
                    {emailError()}
                  </p>
                </Show>
              </div>

              <div>
                <label for="password" class="auth-label">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autocomplete="new-password"
                  required
                  aria-required="true"
                  aria-invalid={passwordError() ? "true" : "false"}
                  aria-describedby="password-hint password-error"
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  onBlur={() => handleBlur("password")}
                  disabled={submitting()}
                  class="auth-input"
                  placeholder="Create a password"
                />
                <Show when={password() && touched().password}>
                  <div class="mt-3 space-y-2 animate-slide-in">
                    <div class="flex gap-1.5">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          class="h-1 flex-1 rounded-full transition-colors duration-300"
                          style={{
                            background:
                              passwordStrength().score >= level
                                ? passwordStrength().color
                                : "var(--color-border)",
                          }}
                        />
                      ))}
                    </div>
                    <p
                      id="password-hint"
                      class="text-xs font-sans"
                      style={{ color: passwordStrength().color }}
                    >
                      {passwordStrength().label}
                    </p>
                  </div>
                </Show>
                <Show when={passwordError()}>
                  <p
                    id="password-error"
                    role="alert"
                    class="mt-2 text-sm animate-slide-in"
                    style={{ color: "#fca5a5" }}
                  >
                    {passwordError()}
                  </p>
                </Show>
              </div>

              <div>
                <label for="confirm-password" class="auth-label">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  autocomplete="new-password"
                  required
                  aria-required="true"
                  aria-invalid={confirmPasswordError() ? "true" : "false"}
                  aria-describedby={
                    confirmPasswordError() ? "confirm-password-error" : undefined
                  }
                  value={confirmPassword()}
                  onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                  onBlur={() => handleBlur("confirmPassword")}
                  disabled={submitting()}
                  class="auth-input"
                  placeholder="Confirm your password"
                />
                <Show when={confirmPasswordError()}>
                  <p
                    id="confirm-password-error"
                    role="alert"
                    class="mt-2 text-sm animate-slide-in"
                    style={{ color: "#fca5a5" }}
                  >
                    {confirmPasswordError()}
                  </p>
                </Show>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting()}
              aria-disabled={submitting()}
              aria-busy={submitting()}
              class="auth-button mt-8"
            >
              <Show when={submitting()} fallback="Create account">
                <span class="inline-flex items-center gap-2">
                  <svg
                    class="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    />
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Creating account…</span>
                </span>
              </Show>
            </button>
          </form>
        </main>

        <footer class="mt-8 text-center">
          <p class="font-sans text-sm" style={{ color: "var(--color-text-muted)" }}>
            Already have an account?{" "}
            <a href="/auth/login" class="auth-link">
              Sign in
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
