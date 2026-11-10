// Test accounts and sample photos for trying the app without a backend.
// Replace with the real auth API before release.

export type DemoAccount = { operator: string; password: string; checkpointId: string; label: string };

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { operator: 'demo', password: 'demo1234', checkpointId: 'CP-03', label: 'Demo operator · CP-03 Water Station' },
  { operator: 'op-0142', password: 'race2026', checkpointId: 'CP-05', label: 'Finish line operator · CP-05' },
];

export const findDemoAccount = (operator: string, password: string) =>
  DEMO_ACCOUNTS.find((a) => a.operator.toLowerCase() === operator.trim().toLowerCase() && a.password === password);

/** Three runners (BIB 1042, 2187, 0563), five frames each, 900×1200. */
export const DEMO_RUNNERS: { bib: string; frames: number[] }[] = [
  {
    bib: '1042',
    frames: [
      require('../../assets/demo/r1_f1.jpg'),
      require('../../assets/demo/r1_f2.jpg'),
      require('../../assets/demo/r1_f3.jpg'),
      require('../../assets/demo/r1_f4.jpg'),
      require('../../assets/demo/r1_f5.jpg'),
    ],
  },
  {
    bib: '2187',
    frames: [
      require('../../assets/demo/r2_f1.jpg'),
      require('../../assets/demo/r2_f2.jpg'),
      require('../../assets/demo/r2_f3.jpg'),
      require('../../assets/demo/r2_f4.jpg'),
      require('../../assets/demo/r2_f5.jpg'),
    ],
  },
  {
    bib: '0563',
    frames: [
      require('../../assets/demo/r3_f1.jpg'),
      require('../../assets/demo/r3_f2.jpg'),
      require('../../assets/demo/r3_f3.jpg'),
      require('../../assets/demo/r3_f4.jpg'),
      require('../../assets/demo/r3_f5.jpg'),
    ],
  },
];

export const DEMO_PHOTO_SIZE = { width: 900, height: 1200 };
