import { SidebarProvider, SidebarTrigger } from "@/src/components/ui/Sidebar";
import { cn } from "@/src/lib/utils";
import { SignedIn, SignedOut, useClerk } from "@clerk/nextjs";
import { Lock, ChevronRight } from "lucide-react";
import Logo from "@/src/components/shared/Logo";
import AdminSidebar from "./Sidebar";
import Header from "./Header";

type LayoutProps = {
  children?: React.ReactNode;
  contentScrollable?: boolean;
};

export default function Layout(props: LayoutProps) {
  const { openSignIn } = useClerk();

  return (
    <div className="h-screen w-full bg-white dark:bg-[hsl(0_0%_7%)]">
      <SignedIn>
        <SidebarProvider defaultOpen={true}>
          <div className="grid h-full w-full">
            <div className="flex h-full max-h-screen">
              <AdminSidebar />
              <div className="dark:bg-sidebar h-full w-full  bg-white">
                <div className="lg:hidden">
                  <div className="flex items-center justify-between bg-gray-50 px-4 py-1.5 dark:bg-gray-900">
                    <div className="text-primary w-32">
                      <Logo />
                    </div>
                    <SidebarTrigger />
                  </div>
                </div>
                <div className="flex h-full min-h-0 flex-col overflow-hidden">
                  <Header />
                  <div
                    className={cn(
                      "scrollbar relative rounded-t border dark:border-gray-800",
                      props.contentScrollable ? "flex-1 overflow-auto" : "h-full overflow-hidden"
                    )}
                  >
                    <div
                      className={cn(
                        "bg-gray-50 dark:bg-[hsl(0_0%_7%)]",
                        props.contentScrollable ? "min-h-full" : "h-full"
                      )}
                    >
                      {props.children}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SidebarProvider>
      </SignedIn>

      <SignedOut>
        <div className="dark:via-background flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-950">
          <div className="relative w-full max-w-lg px-6">
            {/* Decorative elements */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="bg-primary/5 absolute h-[400px] w-[400px] animate-pulse rounded-full" />
              <div
                className="bg-primary/5 absolute h-[300px] w-[300px] animate-pulse rounded-full"
                style={{ animationDelay: "200ms" }}
              />
              <div
                className="bg-primary/5 absolute h-[200px] w-[200px] animate-pulse rounded-full"
                style={{ animationDelay: "400ms" }}
              />
            </div>

            <div className="relative rounded-2xl bg-gradient-to-b from-white/50 to-white/80 p-8 shadow-2xl shadow-black/5 backdrop-blur-xl dark:from-zinc-900/50 dark:to-zinc-900/80">
              <div className="mb-8 flex justify-center">
                <div className="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-2xl">
                  <Lock className="text-primary h-8 w-8" />
                </div>
              </div>

              <div className="mb-6 text-center">
                <h2 className="text-foreground mb-2 text-2xl font-semibold tracking-tight">
                  Требуется авторизация
                </h2>
                <p className="text-muted-foreground">
                  Для доступа к панели управления необходимо войти в систему
                </p>
              </div>

              <button
                onClick={() => void openSignIn()}
                className="from-primary/80 via-primary to-primary/90 text-primary-foreground hover:from-primary/90 hover:via-primary hover:to-primary/95 group flex w-full items-center justify-between gap-2 rounded-lg bg-gradient-to-r px-4 py-3 text-sm font-medium transition-all"
              >
                <span>Войти в систему</span>
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </div>
      </SignedOut>
    </div>
  );
}
