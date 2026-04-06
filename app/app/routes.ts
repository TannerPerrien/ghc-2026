import {
  type RouteConfig,
  index,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route(":location", "routes/location.tsx", [
    index("routes/schedule.tsx"),
    route("schedule", "routes/my-schedule.tsx"),
    route("compare", "routes/compare.tsx"),
    route("workshops/:workshop", "routes/workshop.tsx"),
    route("speakers/:speaker", "routes/speaker.tsx"),
  ]),
] satisfies RouteConfig;
