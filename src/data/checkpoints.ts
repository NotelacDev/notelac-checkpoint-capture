// Sample checkpoints until the backend checkpoint API exists.
// Replace with a fetch from `${apiUrl}/checkpoints` once it is available.

export type Checkpoint = {
  id: string;
  short: string;
  name: string;
  place: string;
  lat: number;
  lng: number;
};

export const CHECKPOINTS: Checkpoint[] = [
  { id: 'CP-01', short: '01', name: 'Start Line', place: 'Gate A', lat: 18.5167, lng: 73.8563 },
  { id: 'CP-02', short: '02', name: 'Km 10 Bridge', place: 'River Rd', lat: 18.5195, lng: 73.8553 },
  { id: 'CP-03', short: '03', name: 'Km 21 Water Station', place: 'Hill Park', lat: 18.5204, lng: 73.8567 },
  { id: 'CP-04', short: '04', name: 'Km 32 Turnaround', place: 'Lake Loop', lat: 18.5229, lng: 73.8601 },
  { id: 'CP-05', short: '05', name: 'Finish Line', place: 'Stadium', lat: 18.5158, lng: 73.8505 },
];

export const findCheckpoint = (id: string | null | undefined) => CHECKPOINTS.find((c) => c.id === id);
