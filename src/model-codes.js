// Model code to friendly-label associations (V1.2 Phase 4).
//
// REVIEW STATUS: generated list, PENDING sign-off by Jate/Ben before it is
// treated as authoritative. Codes not in this map still work everywhere; they
// just render without a friendly label. Edit this file to correct or extend,
// no other change needed.
//
// Keys are the feed's chassis/model-code (kuzov) values, uppercased. Values
// are the human association shown next to the code in selects, e.g.
// "BNR32 - Skyline GT-R (R32)". Keep labels short; the code stays visible.
export const MODEL_CODE_LABELS = {
  // Nissan Skyline / GT-R
  BNR32: "Skyline GT-R (R32)",
  BCNR33: "Skyline GT-R (R33)",
  BNR34: "Skyline GT-R (R34)",
  HCR32: "Skyline GTS-t (R32)",
  ECR33: "Skyline GTS25-t (R33)",
  ER34: "Skyline 25GT-t (R34)",
  CPV35: "Skyline Coupe (V35)",
  R35: "GT-R (R35)",
  // Nissan Silvia / 180SX / Fairlady
  S13: "Silvia (S13)",
  PS13: "Silvia (S13)",
  RPS13: "180SX",
  S14: "Silvia (S14)",
  S15: "Silvia (S15)",
  Z32: "Fairlady Z (Z32)",
  Z33: "Fairlady Z (Z33)",
  Z34: "Fairlady Z (Z34)",
  // Toyota
  JZA80: "Supra (A80)",
  JZA70: "Supra (A70)",
  DB42: "GR Supra (A90)",
  DB82: "GR Supra (A90)",
  AE86: "Corolla Levin / Sprinter Trueno (AE86)",
  JZX90: "Chaser / Mark II (X90)",
  JZX100: "Chaser / Mark II (X100)",
  JZX110: "Mark II (X110)",
  ZN6: "86 (ZN6)",
  ZN8: "GR86 (ZN8)",
  GXPA16: "GR Yaris",
  ARS220: "Crown RS (S220)",
  GWS224: "Crown Hybrid G (S220)",
  AZSH20: "Crown Hybrid (S220)",
  URJ202: "Land Cruiser 200",
  VDJ200: "Land Cruiser 200 diesel",
  FJA300: "Land Cruiser 300",
  GDJ150: "Prado 150 diesel",
  TRJ150: "Prado 150 petrol",
  KZN185: "Hilux Surf (185)",
  RZN185: "Hilux Surf (185)",
  // Honda
  EK9: "Civic Type R (EK9)",
  EP3: "Civic Type R (EP3)",
  FD2: "Civic Type R (FD2)",
  FK2: "Civic Type R (FK2)",
  FK8: "Civic Type R (FK8)",
  FL5: "Civic Type R (FL5)",
  DC2: "Integra Type R (DC2)",
  DC5: "Integra Type R (DC5)",
  NA1: "NSX (NA1)",
  NA2: "NSX (NA2)",
  AP1: "S2000 (AP1)",
  AP2: "S2000 (AP2)",
  // Mazda
  FD3S: "RX-7 (FD)",
  FC3S: "RX-7 (FC)",
  SE3P: "RX-8",
  NA6CE: "Roadster / MX-5 (NA)",
  NA8C: "Roadster / MX-5 (NA)",
  NB8C: "Roadster / MX-5 (NB)",
  NCEC: "Roadster / MX-5 (NC)",
  ND5RC: "Roadster / MX-5 (ND)",
  // Mitsubishi
  CN9A: "Lancer Evolution IV",
  CP9A: "Lancer Evolution V/VI",
  CT9A: "Lancer Evolution VII/VIII/IX",
  CZ4A: "Lancer Evolution X",
  // Subaru
  GC8: "Impreza WRX/STI (GC8)",
  GDB: "Impreza WRX STI (GD)",
  GRB: "Impreza WRX STI (GR)",
  VAB: "WRX STI (VA)",
  BP5: "Legacy Touring Wagon (BP)",
  BL5: "Legacy B4 (BL)",
  // Mercedes-Benz (S222 S Class variants live under numeric codes)
  222058: "S450 (W222)",
  222182: "S560 (W222)",
  217059: "S Class Coupe (C217)",
  // Suzuki / Daihatsu kei sports
  JB23W: "Jimny (JB23)",
  JB64W: "Jimny (JB64)",
  JB74W: "Jimny Sierra (JB74)",
  CAPPUCCINO: "Cappuccino",
  EA11R: "Cappuccino (EA11R)",
  EA21R: "Cappuccino (EA21R)",
  L880K: "Copen (L880K)",
};

// "CODE - Friendly label" when the association is known, else the bare code.
export function labelForCode(code) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return "";
  const label = MODEL_CODE_LABELS[c];
  return label ? `${c} - ${label}` : c;
}
