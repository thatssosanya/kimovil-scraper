import { createSignal, createMemo, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "../../stores/auth";

export default function Login() {
  const navigate = useNavigate();
  const { signIn, error } = useAuth();

  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const [touched, setTouched] = createSignal({ email: false, password: false });

  const emailError = createMemo(() => {
    if (!touched().email) return null;
    if (!email()) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email())) return "Enter a valid email";
    return null;
  });

  const passwordError = createMemo(() => {
    if (!touched().password) return null;
    if (!password()) return "Password is required";
    return null;
  });

  const isValid = createMemo(() => {
    return email() && password() && !emailError() && !passwordError();
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setTouched({ email: true, password: true });

    if (!isValid()) return;

    setSubmitting(true);
    const success = await signIn(email(), password());
    setSubmitting(false);

    if (success) {
      navigate("/");
    }
  };

  const handleBlur = (field: "email" | "password") => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  return (
    <div
      class="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--color-surface)" }}
    >
      <div class="w-full max-w-[420px] animate-fade-in">
        <header class="text-center mb-10">
          <h1
            class="font-serif text-4xl tracking-tight mb-3"
            style={{ color: "var(--color-text-primary)" }}
          >
            Welcome back
          </h1>
          <p
            class="font-sans text-base"
            style={{ color: "var(--color-text-muted)" }}
          >
            Sign in to continue to your account
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
                  autocomplete="current-password"
                  required
                  aria-required="true"
                  aria-invalid={passwordError() ? "true" : "false"}
                  aria-describedby={passwordError() ? "password-error" : undefined}
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  onBlur={() => handleBlur("password")}
                  disabled={submitting()}
                  class="auth-input"
                  placeholder="Enter your password"
                />
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
            </div>

            <button
              type="submit"
              disabled={submitting()}
              aria-disabled={submitting()}
              aria-busy={submitting()}
              class="auth-button mt-8"
            >
              <Show when={submitting()} fallback="Sign in">
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
                  <span>Signing in…</span>
                </span>
              </Show>
            </button>
          </form>
        </main>

        <footer class="mt-8 text-center">
          <p class="font-sans text-sm" style={{ color: "var(--color-text-muted)" }}>
            Don't have an account?{" "}
            <a href="/auth/register" class="auth-link">
              Create one
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
