// GitHub Pages has no server-side routing, so a direct visit to /atlas/some-city
// would 404. Serving the app shell as 404.html makes Pages hand the URL back to
// the client-side router instead.
import { copyFileSync, existsSync } from 'node:fs';

if (existsSync('dist/index.html')) {
  copyFileSync('dist/index.html', 'dist/404.html');
  console.log('postbuild: copied dist/index.html -> dist/404.html');
}
