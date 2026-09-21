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
}

export interface Notice { src: string; title: string; url: string; crit?: boolean }

export interface Status {
  updatedAt: string;
  control: null | { title: string; url?: string };
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
