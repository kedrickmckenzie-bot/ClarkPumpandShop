"use client";
import Link from "next/link";

export default function WorkError({ reset }: { reset: () => void }) {
  return <section>
    <h1>This page didn&apos;t load</h1>
    <p>Nothing you saved was lost. Try again.</p>
    <button type="button" onClick={reset}>Try again</button>
    <p><Link href="/app/my-work">Go to My work</Link></p>
  </section>;
}
