// Character art config. Swap `url`, `size`, pivots, `contact`, `foot` for new art without touching code.
// All pixels are in image space (y down). `contact` = where the character's BACK meets the other's (upper back, chest height);
// `foot` = sole baseline (feet of both characters are aligned on one world baseline); `left/right/top` = solid-figure bbox.
// `side` = which side of the stage; `facing` = where the character looks on screen.
const deg = Math.PI / 180;

export const CHARACTERS = {
  boy: {
    id: 'boy', url: 'assets/img/characters/siswa-cowok-berdiri.webp', size: [1024, 1536], center: [512, 768],
    side: -1, facing: -1, flies: 0, top: 17, left: 349, right: 669, foot: [500, 1520], contact: [632, 470], tip: [632, 470],
    bones: [   // children first (forearm before arm); calm, small angles
      { id: 'forearm', pivot: [524, 650], A: [524, 650], B: [490, 930], C: [490, 930], r: 55, soft: 40, idle: 2.5, ph: 0.3 },
      { id: 'arm',     pivot: [550, 310], A: [550, 310], B: [524, 650], C: [490, 930], r: 70, soft: 50, idle: 2, ph: 0.0 },
      { id: 'head',    pivot: [505, 255], A: [505, 255], B: [530, 130], C: [530, 130], r: 115, soft: 50, idle: 1.6, ph: 0.8 },
      { id: 'sway',    pivot: [500, 720], A: [500, 720], B: [520, 150], C: [520, 150], r: 330, soft: 260, idle: 0.7, ph: 0.0 },
      { id: 'breath',  pivot: [500, 720], A: [500, 720], B: [520, 250], C: [520, 250], r: 260, soft: 160, idle: 0, breath: 0.006, ph: 0.0 },
    ],
    flutter: [
      { id: 'tie',  A: [415, 330], B: [400, 640], r: 45, amp: 6, freq: 1.4, ph: 0.3, dir: [-1, 0] },
      { id: 'hair', A: [520, 160], B: [610, 70], r: 140, amp: 5, freq: 1.8, ph: 1.1, dir: [1, 0.3] },
    ],
  },
  girl: {
    id: 'girl', url: 'assets/img/characters/siswa-cewek-berdiri.webp', size: [1024, 1536], center: [512, 768],
    side: +1, facing: +1, flies: 0, top: 93, left: 279, right: 690, foot: [500, 1505], contact: [300, 455], tip: [300, 455],
    bones: [
      { id: 'forearm', pivot: [452, 650], A: [452, 650], B: [478, 910], C: [478, 910], r: 55, soft: 40, idle: 2.5, ph: 1.2 },
      { id: 'arm',     pivot: [450, 400], A: [450, 400], B: [452, 650], C: [478, 910], r: 70, soft: 50, idle: 2, ph: 0.9 },
      { id: 'head',    pivot: [500, 335], A: [500, 335], B: [520, 190], C: [520, 190], r: 115, soft: 50, idle: 1.6, ph: 2.0 },
      { id: 'sway',    pivot: [500, 700], A: [500, 700], B: [510, 200], C: [510, 200], r: 330, soft: 260, idle: 0.7, ph: 1.5 },
      { id: 'breath',  pivot: [500, 700], A: [500, 700], B: [500, 330], C: [500, 330], r: 260, soft: 160, idle: 0, breath: 0.006, ph: 1.0 },
    ],
    flutter: [
      { id: 'hairTop', A: [470, 150], B: [330, 520], r: 160, amp: 9, freq: 1.5, ph: 0.0, dir: [0.35, 1] },
      { id: 'hairLow', A: [440, 300], B: [310, 560], r: 120, amp: 7, freq: 1.9, ph: 1.4, dir: [0.35, 1] },
      { id: 'bow',     A: [420, 200], B: [405, 175], r: 45, amp: 4, freq: 2.4, ph: 0.6, dir: [1, 0.3] },
      { id: 'tie',     A: [570, 390], B: [600, 650], r: 40, amp: 5, freq: 1.6, ph: 0.9, dir: [1, 0] },
      { id: 'skirt',   A: [520, 700], B: [500, 1210], r: 270, amp: 9, freq: 1.3, ph: 0.5, dir: [1, 0.1] },
    ],
  },
};
export { deg };

// when their backs touch, the contact points stay this many image-px apart (keeps hair/back from interpenetrating)
export const TOUCH_PX = 16;
// heightFrac: figure height as a fraction of the stage height; footY: sole baseline in units of the visible half-height (Hd)
export const LAYOUT = {
  desktop: { heightFrac: 0.58, footY: -0.52, edge: 0.93 },
  mobile:  { heightFrac: 0.56, footY: -0.86, edge: 0.95, minGap: 0.55 },
};
