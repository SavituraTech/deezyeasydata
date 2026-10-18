import type { Provider } from "@/types";

export const NETWORKS: Provider[] = [
  { id: "mtn", name: "MTN", color: "bg-[var(--color-accent)] text-[var(--color-primary)]", short: "MTN" },
  { id: "airtel", name: "Airtel", color: "bg-red-500 text-white", short: "AIR" },
  { id: "glo", name: "Glo", color: "bg-green-600 text-white", short: "GLO" },
  { id: "9mobile", name: "9mobile", color: "bg-emerald-700 text-white", short: "9M" },
];

export const ELECTRICITY_PROVIDERS: Provider[] = [
  { id: "ekedc", name: "Eko Electric (EKEDC)", color: "bg-blue-600 text-white", short: "EKO" },
  { id: "ikedc", name: "Ikeja Electric (IKEDC)", color: "bg-red-600 text-white", short: "IKE" },
  { id: "aedc", name: "Abuja Electric (AEDC)", color: "bg-indigo-600 text-white", short: "ABJ" },
  { id: "phedc", name: "Port Harcourt Electric", color: "bg-[var(--color-action)] text-white", short: "PH" },
  { id: "kedco", name: "Kano Electric (KEDCO)", color: "bg-amber-600 text-white", short: "KAN" },
];

export const CABLE_PROVIDERS: Provider[] = [
  { id: "dstv", name: "DStv", color: "bg-blue-700 text-white", short: "DSt" },
  { id: "gotv", name: "GOtv", color: "bg-lime-500 text-[var(--color-primary)]", short: "GO" },
  { id: "startimes", name: "StarTimes", color: "bg-orange-500 text-white", short: "ST" },
  { id: "showmax", name: "Showmax", color: "bg-fuchsia-600 text-white", short: "SH" },
];

export const EDUCATION_PROVIDERS: Provider[] = [
  { id: "waec", name: "WAEC Result Checker", color: "bg-blue-600 text-white", short: "WA" },
  { id: "jamb", name: "JAMB e-PIN", color: "bg-green-700 text-white", short: "JA" },
  { id: "neco", name: "NECO Token", color: "bg-indigo-600 text-white", short: "NE" },
];

export const TRUSTED_LOGOS = ["MTN", "Airtel", "Glo", "9mobile", "DStv", "GOtv", "EKEDC"];
