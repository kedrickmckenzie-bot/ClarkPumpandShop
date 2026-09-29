"use client";
import Link from "next/link";
export default function TaskError({reset}:{reset:()=>void}) {return <section role="alert"><h1>Couldn’t open tasks</h1><p>Try again. If this record is outside your assigned stores, ask your manager for help.</p><button onClick={reset}>Try again</button> <Link href="/app/tasks">Back to tasks</Link></section>;}
