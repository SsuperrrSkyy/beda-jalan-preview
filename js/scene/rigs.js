// 2D rigs for the two painted characters. All coordinates are image pixels (origin top-left, y down).
// Rotation bones: pivot, capsule weight region A-B(-C) with radius r (+ soft falloff), small angles only.
// Bones are applied in array order, children first (forearm before arm, knee before hip), all weights come from the rest pose.
// `sign` = which way "arm up / reach" rotates (positive angle = clockwise on screen).
// Flutter regions trail opposite to the flight direction (dir) and sway on sine waves.

const deg = Math.PI / 180;

export const GIRL = {
  url: 'assets/img/characters/siswa-cewek.webp',
  size: [1455, 1081],
  tip: [1300, 405],
  center: [760, 520],            // pointing fingertip (meets the boy's)
  flies: 1,                    // +1 = towards +x on screen
  bones: [
    { id: 'pointForearm', pivot: [990, 450], A: [990, 450], B: [1300, 408], C: [1300, 408], r: 55, soft: 40, idle: 2.5, ph: 0.4, reach: -3, ext: 0.05 },
    { id: 'freeForearm',  pivot: [300, 350], A: [300, 350], B: [215, 470], C: [215, 470], r: 55, soft: 35, idle: 5, ph: 2.2, swing: 1, ext: 0 },
    { id: 'kneeBack',     pivot: [400, 780], A: [400, 780], B: [230, 810], C: [230, 810], r: 70, soft: 40, idle: 4, ph: 1.0 },
    { id: 'kneeFront',    pivot: [870, 800], A: [870, 800], B: [1000, 990], C: [1000, 990], r: 75, soft: 40, idle: 4, ph: 3.1 },
    { id: 'pointArm',     pivot: [860, 410], A: [860, 410], B: [990, 450], C: [1300, 408], r: 75, soft: 55, idle: 3, ph: 0, reach: -5 },
    { id: 'freeArm',      pivot: [430, 290], A: [430, 290], B: [300, 350], C: [215, 470], r: 70, soft: 55, idle: 5, ph: 2.0, swing: 1 },
    { id: 'legBack',      pivot: [560, 650], A: [560, 650], B: [400, 780], C: [230, 810], r: 85, soft: 60, idle: 3, ph: 1.4 },
    { id: 'legFront',     pivot: [780, 700], A: [780, 700], B: [870, 800], C: [1000, 990], r: 90, soft: 60, idle: 3, ph: 3.4 },
    { id: 'head',         pivot: [745, 240], A: [745, 240], B: [790, 140], C: [790, 140], r: 100, soft: 45, idle: 3, ph: 0.8, reach: 1.5 },
  ],
  flutter: [
    { id: 'hairTop',  A: [760, 100], B: [440, 150], r: 125, amp: 14, freq: 2.1, ph: 0.0, dir: [-1, 0.15] },
    { id: 'hairLow',  A: [720, 170], B: [430, 230], r: 100, amp: 12, freq: 2.6, ph: 1.7, dir: [-1, 0.25] },
    { id: 'bow',      A: [625, 105], B: [560, 135], r: 55, amp: 7, freq: 3.2, ph: 0.9, dir: [-1, 0.3] },
    { id: 'bag',      A: [480, 380], B: [330, 480], r: 95, amp: 8, freq: 1.7, ph: 2.4, dir: [-1, 0.25] },
    { id: 'skirt',    A: [640, 560], B: [680, 900], r: 250, amp: 11, freq: 1.9, ph: 0.5, dir: [-1, 0.3] },
    { id: 'hem',      A: [820, 620], B: [940, 740], r: 120, amp: 9, freq: 2.4, ph: 2.0, dir: [-1, 0.4] },
  ],
};

export const BOY = {
  url: 'assets/img/characters/siswa-cowok.webp',
  size: [1180, 1333],
  tip: [15, 195],
  center: [620, 660],
  flies: -1,
  bones: [
    { id: 'pointForearm', pivot: [340, 395], A: [340, 395], B: [15, 195], C: [15, 195], r: 55, soft: 40, idle: 2.5, ph: 0.2, reach: 3, ext: 0.05 },
    { id: 'freeForearm',  pivot: [975, 553], A: [975, 553], B: [1120, 345], C: [1120, 345], r: 55, soft: 35, idle: 5, ph: 1.6, swing: 1, ext: 0 },
    { id: 'kneeA',        pivot: [400, 950], A: [400, 950], B: [150, 1250], C: [150, 1250], r: 70, soft: 40, idle: 4, ph: 0.6 },
    { id: 'kneeB',        pivot: [1030, 690], A: [1030, 690], B: [660, 960], C: [660, 960], r: 70, soft: 40, idle: 4, ph: 2.6 },
    { id: 'pointArm',     pivot: [450, 350], A: [450, 350], B: [340, 395], C: [15, 195], r: 80, soft: 55, idle: 3, ph: 0.1, reach: 5 },
    { id: 'freeArm',      pivot: [930, 430], A: [930, 430], B: [975, 553], C: [1120, 345], r: 75, soft: 55, idle: 5, ph: 1.4, swing: 1 },
    { id: 'legA',         pivot: [720, 720], A: [720, 720], B: [400, 950], C: [150, 1250], r: 85, soft: 60, idle: 3, ph: 1.2 },
    { id: 'legB',         pivot: [900, 690], A: [900, 690], B: [1030, 690], C: [660, 960], r: 85, soft: 60, idle: 3, ph: 3.0 },
    { id: 'head',         pivot: [690, 250], A: [690, 250], B: [660, 130], C: [660, 130], r: 105, soft: 45, idle: 3, ph: 0.5, reach: -1.5 },
  ],
  flutter: [
    { id: 'tie',      A: [740, 320], B: [470, 610], r: 100, amp: 15, freq: 2.3, ph: 0.3, dir: [1, 0.1] },
    { id: 'hair',     A: [650, 120], B: [790, 60], r: 110, amp: 5, freq: 2.8, ph: 1.1, dir: [1, 0.1] },
    { id: 'pack',     A: [560, 500], B: [470, 650], r: 100, amp: 6, freq: 1.8, ph: 2.2, dir: [1, 0.2] },
    { id: 'trouser',  A: [700, 700], B: [400, 960], r: 140, amp: 6, freq: 2.0, ph: 0.8, dir: [1, 0.3] },
  ],
};
export { deg };
