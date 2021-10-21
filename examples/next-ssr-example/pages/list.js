/* global fetch */
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from '../styles/Home.module.css';

export default function List() {
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState([]);

  useEffect(async () => {
    setIsLoading(true);
    const res = await fetch('/api/items');
    const { items: newItems } = await res.json();
    setItems(newItems);
    setIsLoading(false);
  }, []);

  return (
    <div className={styles.container}>
      <Head>
        <title>A list</title>
        <meta name="description" content="Just a list" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Items
        </h1>

        {
          isLoading ?
            <div>
              Loading...
            </div> :
            <ul>
              {items.map(item => (
                <li>
                  {item}
                </li>
              ))}
            </ul>
        }
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
