import React from 'react';
import { createRoot } from 'react-dom/client';
import { ScrollProgress } from './components/magicui/scroll-progress';
import { setHTML, enhanceButtons } from './ui';
import './magicui.css';
import './landing.css';
import './magicui-overrides.css';

const main=document.querySelector('main')!;
setHTML(main,main.innerHTML);
enhanceButtons(document.querySelector('header')!);
const progress=document.createElement('div');
document.body.prepend(progress);
createRoot(progress).render(<ScrollProgress className="nextseat-scroll-progress" aria-hidden="true"/>);
