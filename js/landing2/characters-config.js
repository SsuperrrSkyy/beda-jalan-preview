// The two 3D student figurines (3d/build_figures.py -> assets/3d/figures.glb) and where they stand in the hero.
// Model units are metres; each figure stands on its own floor at y = 0 and faces +z before `yaw` is applied.
const deg = Math.PI / 180;

export const FIGURES = {
  url: 'assets/3d/figures.glb',
  draco: 'vendor/three/addons/libs/draco/gltf/',
  headScale: 1.16,   // Figure.HS in 3d/build_figures.py: faces are painted in head units
  // side: stage side (-1 left, +1 right). yaw turns the figure so it faces away from the other (3/4 view).
  // chest: chest height (m), used for the ribbon loop and the light; ph: idle phase so they never move in sync.
  // pitch: head pose baked into the model (must match 3d/build_figures.py); bang: height (head units) where the
  // bangs' shadow starts on the forehead; iris: eye colours (top, bottom).
  boy:  { id: 'boy',  side: -1, yaw: -70 * deg, height: 1.75, waist: 0.99, chest: 1.31, ph: 0.0,
          pitch: -15 * deg, bang: 0.112, iris: ['#24160f', '#9a6238'], line: '#7a3f3a' },
  girl: { id: 'girl', side: +1, yaw: 70 * deg,  height: 1.64, waist: 0.93, chest: 1.23, ph: 2.1,
          pitch: 17 * deg, bang: 0.11, iris: ['#2a1418', '#b0704a'], line: '#7a3f3a' },
};

// topFrac: head top of the taller figure, as a fraction of the stage height from the top;
// waistFrac: where the boy's waist sits (also a fraction from the top); below it the figures fade out.
// edge: how far out the start positions go (1 = the figure's outer edge touches the screen edge).
export const LAYOUT = {
  desktop: { topFrac: 0.36, waistFrac: 1.0, edge: 0.93, fade: [0.86, 1.0] },
  mobile:  { topFrac: 0.52, waistFrac: 0.96, edge: 1.0, fade: [0.86, 0.97] },
};

// when their backs touch they stay this far apart (m, model scale) so hair and shirts never cut into each other
export const TOUCH_M = 0.03;
export { deg };
