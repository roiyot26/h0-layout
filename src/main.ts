import './style.css';
import { siteBase } from './base';
import { wireEmail } from './email';

document.documentElement.dataset.base = siteBase(import.meta.env.BASE_URL);
wireEmail(document);
