import { Link } from "react-router";
import type { Route } from "./+types/home";
import { getLocations } from "~/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "GHC 2026 — Great Homeschool Conventions" },
    { name: "description", content: "Build your custom schedule for the 2026 Great Homeschool Conventions." },
  ];
}

export function loader(_: Route.LoaderArgs) {
  return { locations: getLocations() };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { locations } = loaderData;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Great Homeschool Conventions</h1>
          <p className="text-muted-foreground mt-2">2026 Schedule Builder</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold mb-6">Select a Location</h2>
          <div className="grid gap-4">
            {locations.map((loc) => {
              const start = new Date(loc.dates.start + "T00:00:00");
              const end = new Date(loc.dates.end + "T00:00:00");
              const dateRange = `${start.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

              return (
                <Link key={loc.slug} to={`/${loc.slug}`}>
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{loc.name}</CardTitle>
                        <Badge variant="secondary">{loc.abbreviation}</Badge>
                      </div>
                      <CardDescription>{loc.venue}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        <div>{loc.city}</div>
                        <div>{dateRange}</div>
                      </div>
                      <Button variant="outline" size="sm">View Schedule</Button>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
