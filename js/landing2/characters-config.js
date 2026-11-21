// Character art config. Swap `url`, `size`, pivots, `contact`, `foot` for new art without touching code.
// All pixels are in image space (y down). `contact` = where the character's BACK meets the other's (upper back, chest height);
// `foot` = sole baseline (feet of both characters are aligned on one world baseline); `left/right/top` = solid-figure bbox.
// `side` = which side of the stage; `facing` = where the character looks on screen.
const deg = Math.PI / 180;

export const CHARACTERS = {
  // half-body backlit silhouettes (tools/make_silhouettes.py). Coordinates are in the cropped images;
  // `foot` is the virtual sole line below the crop, so both students keep their real height difference.
  boy: {
    id: 'boy', url: 'assets/img/characters/siluet-cowok.webp', size: [440, 860], center: [220, 430],
    side: -1, facing: -1, flies: 0, top: 17, left: 49, right: 369, foot: [200, 1520], contact: [332, 470], tip: [332, 470],
    bones: [   // children first; calm, small angles
      { id: 'arm',    pivot: [250, 310], A: [250, 310], B: [224, 650], C: [190, 860], r: 70, soft: 50, idle: 1.4, ph: 0.0 },
      { id: 'head',   pivot: [205, 255], A: [205, 255], B: [230, 130], C: [230, 130], r: 115, soft: 50, idle: 1.4, ph: 0.8 },
      { id: 'sway',   pivot: [200, 760], A: [200, 760], B: [220, 150], C: [220, 150], r: 330, soft: 260, idle: 0.6, ph: 0.0 },
      { id: 'breath', pivot: [200, 760], A: [200, 760], B: [220, 250], C: [220, 250], r: 260, soft: 160, idle: 0, breath: 0.006, ph: 0.0 },
    ],
    flutter: [
      { id: 'tie',  A: [115, 330], B: [100, 640], r: 40, amp: 4, freq: 1.4, ph: 0.3, dir: [-1, 0] },
      { id: 'hair', A: [220, 160], B: [310, 70], r: 130, amp: 4, freq: 1.8, ph: 1.1, dir: [1, 0.3] },
    ],
  },
  girl: {
    id: 'girl', url: 'assets/img/characters/siluet-cewek.webp', size: [490, 820], center: [245, 410],
    side: +1, facing: +1, flies: 0, top: 18, left: 81, right: 445, foot: [260, 1425], contact: [122, 375], tip: [122, 375],
    bones: [
      { id: 'arm',    pivot: [210, 320], A: [210, 320], B: [212, 570], C: [238, 820], r: 70, soft: 50, idle: 1.4, ph: 0.9 },
      { id: 'head',   pivot: [260, 255], A: [260, 255], B: [280, 110], C: [280, 110], r: 115, soft: 50, idle: 1.4, ph: 2.0 },
      { id: 'sway',   pivot: [260, 700], A: [260, 700], B: [270, 120], C: [270, 120], r: 330, soft: 260, idle: 0.6, ph: 1.5 },
      { id: 'breath', pivot: [260, 700], A: [260, 700], B: [260, 250], C: [260, 250], r: 260, soft: 160, idle: 0, breath: 0.006, ph: 1.0 },
    ],
    flutter: [
      { id: 'hair', A: [175, 130], B: [110, 450], r: 70, amp: 4, freq: 1.5, ph: 0.0, dir: [0.35, 1] },
      { id: 'bow',  A: [180, 120], B: [165, 95], r: 40, amp: 3, freq: 2.4, ph: 0.6, dir: [1, 0.3] },
      { id: 'tie',  A: [330, 310], B: [360, 570], r: 35, amp: 3, freq: 1.6, ph: 0.9, dir: [1, 0] },
    ],
  },
};
export { deg };

// when their backs touch, the contact points stay this many image-px apart (keeps hair/back from interpenetrating)
export const TOUCH_PX = 16;
// heightFrac: figure height as a fraction of the stage height; footY: sole baseline in units of the visible half-height (Hd)
export const LAYOUT = {
  desktop: { heightFrac: 1.43, footY: -2.31, edge: 0.95 },
  mobile:  { heightFrac: 0.95, footY: -1.83, edge: 0.98, minGap: 0.5 },
};
