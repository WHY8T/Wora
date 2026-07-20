import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { BookOpenText, Check, MessagesSquare, Sparkles, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: BookOpenText, title: "Track your reading", text: "Shelves for want-to-read, reading, and finished — plus yearly goals." },
  { icon: Users, title: "Join communities", text: "Reddit-style groups for every genre, with votes and threaded discussions." },
  { icon: Sparkles, title: "Discover books", text: "Search millions of titles and see what readers like you love." },
  { icon: MessagesSquare, title: "Follow readers", text: "A living feed of what your circle is reading, rating, and debating." },
];

type PasswordStrength = {
  score: 0 | 1 | 2 | 3;
  label: string;
  color: string;
  checks: { label: string; passed: boolean }[];
};

function getPasswordStrength(password: string): PasswordStrength {
  const checks = [
    { label: "At least 8 characters", passed: password.length >= 8 },
    { label: "Upper and lowercase letters", passed: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: "A number or symbol", passed: /[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password) },
  ];
  const passedCount = checks.filter((c) => c.passed).length;
  const longEnough = password.length >= 8;

  if (!longEnough || passedCount <= 1) {
    return { score: password.length === 0 ? 0 : 1, label: "Weak", color: "bg-red-500", checks };
  }
  if (passedCount === 2 || password.length < 12) {
    return { score: 2, label: "Okay", color: "bg-orange-500", checks };
  }
  return { score: 3, label: "Strong", color: "bg-green-500", checks };
}

export default function Login() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [signupStep, setSignupStep] = useState<1 | 2>(1);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const onAuthSuccess = async () => {
    await utils.invalidate();
    navigate("/");
  };

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: onAuthSuccess,
    onError: (err) => setFormError(err.message),
  });
  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess: onAuthSuccess,
    onError: (err) => setFormError(err.message),
  });

  const isPending = loginMutation.isPending || signupMutation.isPending;

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    setSignupStep(1);
    setFormError(null);
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const nameValid = name.trim().length > 0;

  const handleStep1Continue = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!nameValid || !emailValid) {
      setFormError("Enter your name and a valid email to continue.");
      return;
    }
    setSignupStep(2);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    loginMutation.mutate({ email, password });
  };

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (strength.score < 2) {
      setFormError("Choose a stronger password before continuing.");
      return;
    }
    signupMutation.mutate({ email, password, name });
  };

  return (
    <div className="flex min-h-dvh">
      <div className="hidden w-1/2 flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
            <BookOpenText size={20} />
          </span>
          <span className="font-display text-2xl font-semibold">Wora</span>
        </div>
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight">
            Good books are better
            <br />
            <em className="font-display italic">together.</em>
          </h1>
          <div className="mt-8 space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon size={17} />
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-primary-foreground/75">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-primary-foreground/60">
          A community for people who never want the story to end.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <BookOpenText size={20} />
            </span>
            <span className="font-display text-2xl font-semibold">Wora</span>
          </div>

          <Tabs value={mode} onValueChange={(v) => switchMode(v as "login" | "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === "login" && (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                Pick up where you left off — your shelves are waiting.
              </p>
              <form className="mt-6 space-y-4" onSubmit={handleLoginSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                </div>
                {formError && <p className="text-sm text-destructive">{formError}</p>}
                <Button className="w-full" size="lg" type="submit" disabled={isPending}>
                  {isPending ? "Please wait…" : "Sign in"}
                </Button>
              </form>
              <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
                New here?{" "}
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-foreground"
                  onClick={() => switchMode("signup")}
                >
                  Create an account
                </button>
              </p>
            </>
          )}

          {mode === "signup" && (
            <>
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                    signupStep >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  1
                </span>
                <span className="h-px flex-1 bg-border" />
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                    signupStep >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  2
                </span>
              </div>

              {signupStep === 1 && (
                <>
                  <p className="mt-3 text-sm text-muted-foreground">Let's start with the basics.</p>
                  <form className="mt-6 space-y-4" onSubmit={handleStep1Continue}>
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Full name</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jane Doe"
                        required
                        autoComplete="name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        autoComplete="email"
                      />
                    </div>
                    {formError && <p className="text-sm text-destructive">{formError}</p>}
                    <Button className="w-full" size="lg" type="submit">
                      Continue
                    </Button>
                  </form>
                </>
              )}

              {signupStep === 2 && (
                <>
                  <p className="mt-3 text-sm text-muted-foreground">Now choose a password.</p>
                  <form className="mt-6 space-y-4" onSubmit={handleSignupSubmit}>
                    <div className="space-y-1.5">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        autoFocus
                        autoComplete="new-password"
                      />
                    </div>

                    {password.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex gap-1.5">
                          {[0, 1, 2].map((i) => (
                            <span
                              key={i}
                              className={cn(
                                "h-1.5 flex-1 rounded-full bg-muted transition-colors",
                                i < strength.score && strength.color,
                              )}
                            />
                          ))}
                        </div>
                        <p
                          className={cn(
                            "text-xs font-medium",
                            strength.score === 1 && "text-red-500",
                            strength.score === 2 && "text-orange-500",
                            strength.score === 3 && "text-green-600",
                          )}
                        >
                          {strength.label} password
                        </p>
                        <ul className="space-y-1">
                          {strength.checks.map((c) => (
                            <li key={c.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              {c.passed ? (
                                <Check size={12} className="text-green-600" />
                              ) : (
                                <X size={12} className="text-muted-foreground/50" />
                              )}
                              {c.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {formError && <p className="text-sm text-destructive">{formError}</p>}

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSignupStep(1);
                          setFormError(null);
                        }}
                      >
                        Back
                      </Button>
                      <Button className="w-full" size="lg" type="submit" disabled={isPending}>
                        {isPending ? "Please wait…" : "Create account"}
                      </Button>
                    </div>
                  </form>
                </>
              )}

              <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-foreground"
                  onClick={() => switchMode("login")}
                >
                  Sign in
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}