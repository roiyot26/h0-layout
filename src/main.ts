import './style.css';
import { siteBase } from './base';
import { wireEmail } from './email';

document.documentElement.dataset.base = siteBase(import.meta.env.BASE_URL);
wireEmail(document);

// Preview-only 3D (M2 spec §8). With ENABLE_3D off, as in every production build, this
// branch is removed at build time and no three or world chunk is emitted. PHONE_3D off
// keeps phones on the facts site.
if (__ENABLE_3D__ && new URLSearchParams(location.search).has('3d')) {
  // TODO(M2 PR 3): replace this width placeholder with the tier rule (M2 spec §1.1).
  const phone = matchMedia('(max-width: 599px)').matches;
  if (__PHONE_3D__ || !phone) void import('./world').then((m) => m.boot());
}
