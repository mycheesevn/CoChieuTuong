import { LegalPage } from "@/components/cct/LegalPage";
import { PRIVACY } from "@/lib/cct/legal";

export const metadata = {
  title: "Privacy Policy — Cờ Chiếu Tướng (Vietnamese General Check)",
};

export default function Privacy() {
  return <LegalPage docs={PRIVACY} />;
}
