import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
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
function MotionLayer(){
 useEffect(()=>{
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  gsap.registerPlugin(ScrollTrigger);
  const ctx=gsap.context(()=>{
   gsap.from('.talent-visual',{opacity:0,y:20,scale:.985,duration:.9,ease:'power3.out',delay:.15});
   gsap.to('.chip-one',{y:14,duration:2.8,ease:'sine.inOut',repeat:-1,yoyo:true});
   gsap.to('.chip-two',{y:-12,duration:3.2,ease:'sine.inOut',repeat:-1,yoyo:true});
   gsap.to('.ticker-track',{xPercent:-50,duration:24,ease:'none',repeat:-1});
   gsap.utils.toArray<HTMLElement>('.steps article,.path-card').forEach((card,i)=>{
    gsap.from(card,{scrollTrigger:{trigger:card,start:'top 88%',once:true},opacity:0,y:26,duration:.65,delay:(i%3)*.07,ease:'power2.out'});
   });
   gsap.from('.privacy-control',{scrollTrigger:{trigger:'.privacy-band',start:'top 75%',once:true},opacity:0,x:32,duration:.8,ease:'power3.out'});
  });
  return()=>ctx.revert();
 },[]);
 return <ScrollProgress className="masslaidoff-scroll-progress" aria-hidden="true"/>;
}
createRoot(progress).render(<MotionLayer/>);
