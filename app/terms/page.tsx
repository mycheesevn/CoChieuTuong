import { LegalPage } from "@/components/cct/LegalPage";
import { TERMS } from "@/lib/cct/legal";

export const metadata = {
  title: "Terms of Service — Cờ Chiếu Tướng (Vietnamese General Check)",
};

export default function Terms() {
  return <LegalPage docs={TERMS} />;
}
