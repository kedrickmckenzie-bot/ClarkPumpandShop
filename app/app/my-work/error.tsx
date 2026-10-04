"use client";
import Link from "next/link";
export default function WorkError({reset}:{reset:()=>void}){return <section><h1>Could not load this job view</h1><p>Your saved work is still available. Try loading it again.</p><button type="button" onClick={reset}>Try again</button><p><Link href="/app/my-work">Return to My work</Link></p></section>;}
