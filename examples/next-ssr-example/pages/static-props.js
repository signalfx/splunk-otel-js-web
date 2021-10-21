/* global fetch */
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Home.module.css';

export default function StaticProps({ bin }) {
  return (
    <div className={styles.container}>
      <Head>
        <title>HTTPbin Response (Static Props)</title>
        <meta name="description" content="Pretty dynatic for a static page" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          HTTPbin Response (Static Props)
        </h1>

        <pre>{JSON.stringify(bin, undefined, 2)}</pre>
      </main>

      <footer className={styles.footer}>
        <Link href="/">
          <a>
            Back Home
          </a>
        </Link>
      </footer>
    </div>
  );
}

export async function getStaticProps() {
  const res = await fetch('https://httpbin.org/get?time=' + Date.now());
  const bin = await res.json();

  return {
    props: {
      bin,
    }
  };
}
