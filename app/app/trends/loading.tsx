import styles from "./loading.module.css";

export default function TrendsLoading() {
  return (
    <main className={styles.loading} aria-busy="true" aria-label="Loading trend analysis">
      <div className={styles.heading}><span /><span /></div>
      <section className={styles.results}>{Array.from({ length: 5 }, (_, index) => <span key={index} />)}</section>
      <div className={styles.scope} />
      <section className={styles.chart}><span /><div /></section>
      <section className={styles.tabs}>{Array.from({ length: 4 }, (_, index) => <span key={index} />)}</section>
    </main>
  );
}
