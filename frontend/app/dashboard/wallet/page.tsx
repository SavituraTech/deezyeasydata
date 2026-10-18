import type { Metadata } from "next";
import { Suspense } from "react";
import { WalletView } from "@/components/dashboard/wallet-view";

export const metadata: Metadata = { title: "Wallet" };

export default function WalletPage() {
  return (
    <Suspense>
      <WalletView />
    </Suspense>
  );
}
