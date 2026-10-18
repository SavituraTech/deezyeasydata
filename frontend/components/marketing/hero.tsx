"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Check, Radio, Smartphone, Wifi, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const services = [
  { icon: Wifi, label: "Data", tone: "bg-[#e8f3ff] text-[#0878cf]" },
  { icon: Smartphone, label: "Airtime", tone: "bg-[#eefbe8] text-[#4da822]" },
  { icon: Zap, label: "Bills", tone: "bg-[#fff5dc] text-[#b87500]" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#f5f8fb] px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pb-20 lg:pt-10">
      <div className="pointer-events-none absolute inset-0 data-grid opacity-60" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-32 top-12 h-[420px] w-[420px] rounded-full bg-[#62ce31]/15 blur-3xl" />
      <div className="relative mx-auto grid max-w-[1380px] overflow-hidden rounded-[32px] bg-[#062f4c] text-white shadow-[0_30px_80px_rgba(4,42,70,.2)] lg:min-h-[700px] lg:grid-cols-[1.05fr_.95fr]">
        <div className="relative z-10 flex flex-col justify-center px-7 py-16 sm:px-12 lg:px-16 lg:py-20">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45 }}>
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold tracking-wide text-white/80">
              <Radio className="h-3.5 w-3.5 text-[#78e342]" /> Built for everyday connections
            </div>
            <h1 className="max-w-[680px] text-[clamp(3.1rem,6vw,6rem)] font-extrabold leading-[.92] tracking-[-.065em]">
              Stay online.
              <span className="mt-2 block text-[#78e342]">Stay easy.</span>
            </h1>
            <p className="mt-8 max-w-xl text-base leading-7 text-[#c8d9e6] sm:text-lg">
              Your fast lane to data, airtime and everyday bills. One wallet, clear prices, and delivery you can track from payment to completion.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild className="rounded-full bg-[#78e342] px-7 text-[#062f4c] shadow-none hover:bg-[#8cec5b]">
                <Link href="/register">Open your account <ArrowUpRight className="h-4 w-4" /></Link>
              </Button>
              <Button size="lg" asChild className="rounded-full border border-white/20 bg-white/8 px-7 text-white shadow-none hover:bg-white/14">
                <Link href="/#services">See what you can do</Link>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-white/60">
              {['Instant delivery', 'Secure wallet funding', 'Human support'].map((item) => (
                <span key={item} className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#78e342]" />{item}</span>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .55, delay: .12 }} className="relative flex min-h-[560px] items-center justify-center overflow-hidden bg-[#0878cf] p-6 sm:p-10 lg:min-h-full">
          <div className="absolute inset-0 data-rings opacity-25" aria-hidden="true" />
          <div className="relative w-full max-w-[480px] rounded-[28px] bg-[#f8fbff] p-3 text-[#092d45] shadow-[0_28px_70px_rgba(1,35,60,.3)]">
            <div className="rounded-[19px] bg-white p-5 sm:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#6b8393]">Available balance</p>
                  <p className="mt-2 tabular-nums text-4xl font-extrabold tracking-[-.04em]">₦45,200<span className="text-xl text-[#8ca0ad]">.00</span></p>
                </div>
                <span className="rounded-full bg-[#eaf8e4] px-3 py-1.5 text-[11px] font-bold text-[#4da822]">Wallet active</span>
              </div>
              <div className="mt-7 grid grid-cols-3 gap-2">
                {services.map(({ icon: Icon, label, tone }) => (
                  <div key={label} className="rounded-2xl bg-[#f3f7fa] p-3.5">
                    <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></span>
                    <p className="mt-3 text-xs font-bold">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl bg-[#062f4c] p-5 text-white">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs text-white/55">MTN Data bundle</p><p className="mt-1 font-bold">10GB SME Plan</p></div>
                  <p className="tabular-nums text-lg font-extrabold">₦2,500</p>
                </div>
                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/12"><div className="h-full w-[84%] rounded-full bg-[#78e342]" /></div>
                <div className="mt-3 flex justify-between text-[11px]"><span className="text-[#9ef472]">Almost there</span><span className="text-white/55">84%</span></div>
              </div>
            </div>
          </div>
          <div className="absolute bottom-8 left-5 rounded-2xl bg-[#78e342] px-4 py-3 text-[#062f4c] shadow-xl sm:left-10">
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Just delivered</p><p className="mt-0.5 text-sm font-extrabold">10GB to 0803 ••• 1024</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
