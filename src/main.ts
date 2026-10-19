import './style.css';
import { siteBase } from './base';

document.documentElement.dataset.base = siteBase(import.meta.env.BASE_URL);
