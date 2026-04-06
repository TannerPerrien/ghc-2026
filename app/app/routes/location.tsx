import { Link, NavLink, Outlet } from "react-router";
import type { Route } from "./+types/location";
import { getLocation } from "~/lib/data";
import { Separator } from "~/components/ui/separator";
import { ScheduleProvider } from "~/contexts/schedule-context";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `GHC 2026 — ${data?.location.name ?? "Location"}` }];
}

export function loader({ params }: Route.LoaderArgs) {
  const location = getLocation(params.location);
  return { location };
}

export default function LocationLayout({ loaderData }: Route.ComponentProps) {
  const { location } = loaderData;

  const start = new Date(location.dates.start + "T00:00:00");
  const end = new Date(location.dates.end + "T00:00:00");
  const dateRange = `${start.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0">
              ← All Locations
            </Link>
            <Separator orientation="vertical" className="h-4 shrink-0" />
            <div className="min-w-0 truncate">
              <span className="font-semibold">{location.name}</span>
              <span className="text-muted-foreground text-sm ml-2">{dateRange}</span>
            </div>
          </div>
          <nav className="flex items-center gap-1 shrink-0">
            <NavLink
              to={`/${location.slug}`}
              end
              className={({ isActive }) =>
                `px-3 py-1.5 text-sm rounded-md transition-colors ${isActive ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`
              }
            >
              Workshops
            </NavLink>
            <NavLink
              to={`/${location.slug}/schedule`}
              className={({ isActive }) =>
                `px-3 py-1.5 text-sm rounded-md transition-colors ${isActive ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`
              }
            >
              Schedule
            </NavLink>
            <NavLink
              to={`/${location.slug}/compare`}
              className={({ isActive }) =>
                `px-3 py-1.5 text-sm rounded-md transition-colors ${isActive ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`
              }
            >
              Compare
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <ScheduleProvider locationSlug={location.slug}>
          <Outlet />
        </ScheduleProvider>
      </main>
    </div>
  );
}
