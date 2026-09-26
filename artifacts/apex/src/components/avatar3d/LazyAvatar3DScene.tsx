import { lazy, Suspense, type ComponentProps } from "react";

// Loads three.js only when a 3D avatar is actually shown
const Avatar3DSceneImpl = lazy(() =>
  import("./Avatar3DScene").then((m) => ({ default: m.Avatar3DScene })),
);

export function LazyAvatar3DScene(props: ComponentProps<typeof Avatar3DSceneImpl>) {
  return (
    <Suspense fallback={null}>
      <Avatar3DSceneImpl {...props} />
    </Suspense>
  );
}
