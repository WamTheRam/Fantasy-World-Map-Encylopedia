import { Link } from 'react-router-dom';
import styles from './Pages.module.css';

interface NotFoundPageProps {
  heading?: string;
  message?: string;
}

export function NotFoundPage({
  heading = 'This page is not on the map',
  message = 'The address may be misspelled, or the place may have been renamed.',
}: NotFoundPageProps) {
  return (
    <main className={styles.notFound}>
      <h1>{heading}</h1>
      <p>{message}</p>
      <Link to="/atlas" className={styles.button}>
        Back to the world map
      </Link>
    </main>
  );
}
