export type Tier = "confirmed" | "est" | "auto";
export type Kind = "seen" | "miss";
export type ZoneCode = "A" | "B" | "C" | "D" | "E" | "F";

export interface Zone { code: ZoneCode; name: string }

export interface Event {
  at: string;
  kind: Kind;
  zone: ZoneCode;
  tier: Tier;
  note?: string;
  photo?: string | null;
  ordinal?: number;
}

export interface Notice { src: string; title: string; url: string; crit?: boolean }

export interface Stats {
  visitsToday: number; viewsToday: number;
  visitsTotal: number; viewsTotal: number;
  reportsToday: number; reportsTotal: number; approvedTotal: number;
}

export interface Status {
  updatedAt: string;
  demo?: boolean;
  stats?: Stats;
  control: null | { title: string; url?: string };
  /** 현장 탭 집계. 최근 windowMin분 안에 "보여요"/"안 보여요"를 누른 사람 수 */
  live?: null | { seen: number; miss: number; at: string; zone: string | null; windowMin: number };
  last: (Event & { evidence?: string }) | null;
  counters: { seen: number; visit: number };
  zones: Zone[];
  timeline: Event[];
  notices: Notice[];
}

export type CertType = "seen" | "visit";

export interface Submission {
  id: string;
  type: CertType;
  zone?: ZoneCode;
  takenAt: string;      // 관측 시각 (EXIF 또는 수동)
  submittedAt: string;  // 접수 시각
  exifGps?: { lat: number; lng: number } | null;
  photoDataUrl?: string;
  link?: string;
  status: "pending" | "approved" | "rejected";
  ordinal?: number;
  rarity?: import("./rarity").Rarity;
}
