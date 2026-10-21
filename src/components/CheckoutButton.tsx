"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completeDemoPayment, confirmRazorpayPayment, reportCheckoutFailure, startCheckout } from "@/app/actions/payments";

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayFailure = { error?: { description?: string; reason?: string } };
type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: RazorpayFailure) => void) => void };
declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

/** Loaded on demand; created by our nonce-approved bundle, which CSP 'strict-dynamic' permits. */
function loadRazorpay(): Promise<RazorpayCtor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error("Razorpay unavailable")));
    script.onerror = () => reject(new Error("Could not load Razorpay"));
    document.body.appendChild(script);
  });
}

export type CheckoutLabels = {
  welcome: string;
  demo: string;
  demoBody: string;
  activating: string;
  complete: string;
  cancel: string;
  wait: string;
  failed: string;
  failedNoCharge: string;
};

const ENGLISH: CheckoutLabels = {
  welcome: "Welcome to Premium!",
  demo: "Demo checkout",
  demoBody: "Razorpay isn’t connected yet, so no money will be charged. This activates {plan} for testing.",
  activating: "Activating…",
  complete: "Complete demo payment",
  cancel: "Cancel",
  wait: "Please wait…",
  failed: "Payment failed.",
  failedNoCharge: "Payment failed. No money was taken; please try again.",
};

export function CheckoutButton({
  planId,
  label,
  featured,
  couponCode,
  labels = ENGLISH,
}: {
  planId: string;
  label: string;
  featured?: boolean;
  couponCode?: string;
  labels?: CheckoutLabels;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState<{ paymentId: string; amount: number; planName: string } | null>(null);
  const [done, setDone] = useState(false);

  const finish = (result: { ok: boolean; error?: string }) => {
    if (result.ok) {
      setDone(true);
      setDemo(null);
      router.refresh();
    } else setError(result.error ?? labels.failed);
  };

  const begin = () =>
    startTransition(async () => {
      setError(null);
      const start = await startCheckout(planId, couponCode);
      if (start.kind === "error") return setError(start.error);
      if (start.kind === "demo") return setDemo(start);
      try {
        const Razorpay = await loadRazorpay();
        const rzp = new Razorpay({
          key: start.keyId,
          order_id: start.orderId,
          amount: start.amount,
          currency: "INR",
          name: "Devangar Matrimony",
          description: `${start.planName} membership`,
          prefill: { contact: start.phone },
          theme: { color: "#5e1229" },
          handler: (r: RazorpayResponse) =>
            startTransition(async () =>
              finish(await confirmRazorpayPayment({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature })),
            ),
        });
        rzp.on("payment.failed", (r) => {
          setError(labels.failedNoCharge);
          void reportCheckoutFailure(start.orderId, r.error?.description ?? r.error?.reason ?? "");
        });
        rzp.open();
      } catch (e) {
        setError((e as Error).message);
      }
    });

  if (done) return <p className="rounded-full bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-800">{labels.welcome}</p>;

  return (
    <div>
      {demo ? (
        <div className="rounded-xl border border-dashed border-gold bg-cream p-4 text-left text-sm">
          <p className="font-medium text-maroon">{labels.demo}</p>
          <p className="mt-1 text-stone-600">{labels.demoBody.replace("{plan}", demo.planName)}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(async () => finish(await completeDemoPayment(demo.paymentId)))}
              className="rounded-full bg-maroon px-4 py-2 text-xs font-medium text-white disabled:opacity-60"
            >
              {pending ? labels.activating : labels.complete}
            </button>
            <button type="button" onClick={() => setDemo(null)} className="px-2 text-xs text-stone-600 underline">{labels.cancel}</button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={begin}
          disabled={pending}
          className={`w-full rounded-full px-6 py-3 text-sm font-medium tracking-wide shadow-soft transition disabled:opacity-60 ${
            featured ? "bg-gold text-maroon-dark hover:bg-gold-light" : "bg-maroon text-white hover:bg-maroon-dark"
          }`}
        >
          {pending ? labels.wait : label}
        </button>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
