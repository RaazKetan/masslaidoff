import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import parse, { attributesToProps, domToReact, Element, type DOMNode, type HTMLReactParserOptions } from 'html-react-parser';
import { useReducedMotion } from 'motion/react';
import { BlurFade } from './components/magicui/blur-fade';
import { MagicCard } from './components/magicui/magic-card';
import { RippleButton } from './components/magicui/ripple-button';

// Each island owns its host's children; nested islands are disposed before replacement.
const roots = new Map<HTMLElement,Root>();
function Fade({children,className}:{children:React.ReactNode;className?:string}){
 const reduced=useReducedMotion();
 return <BlurFade className={className} duration={reduced?0:0.28} offset={reduced?0:3} blur={reduced?'0px':'2px'}>{children}</BlurFade>;
}
const options:HTMLReactParserOptions={
 replace(node){
  if(!(node instanceof Element))return;
  const attrs=attributesToProps(node.attribs),cls=node.attribs.class||'';
  const children=()=>domToReact(node.children as DOMNode[],options);
  if(node.name==='button'||(node.name==='a'&&cls.split(' ').includes('button'))){
   return <RippleButton {...attrs} className={cls+' magic-control'} rippleColor={cls.includes('primary')?'#ffffff':'#9ab6ff'} duration="450ms">{children()}</RippleButton>;
  }
  if(['candidate','manager-card','sample-profile','hiring-panel'].some(c=>cls.split(' ').includes(c))){
   const type=cls.split(' ').find(c=>['candidate','manager-card','sample-profile','hiring-panel'].includes(c));
   const content=React.createElement(node.name,attrs,children());
   return <MagicCard className={'magic-surface magic-'+type} gradientColor="#b8cafa" gradientOpacity={0.06} gradientFrom="#c4d3f8" gradientTo="#e4eaf7" gradientSize={180}>{content}</MagicCard>;
  }
  if(cls==='hero-copy'||cls==='section-heading'){
   return <Fade className={cls}>{children()}</Fade>;
  }
 }
};
export function setHTML(host:HTMLElement|string,html:string){
 const target=typeof host==='string'?document.querySelector<HTMLElement>(host):host;
 if(!target)return;
 for(const [element,root] of roots){
  if(element!==target&&target.contains(element)){root.unmount();roots.delete(element)}
 }
 let root=roots.get(target);
 if(!root){root=createRoot(target);roots.set(target,root)}
 const content=parse(html,options);
 flushSync(()=>root!.render(target.classList.contains('page-heading')?<Fade>{content}</Fade>:content));
}
export function enhanceButtons(scope:Document|HTMLElement){
 for(const button of [...scope.querySelectorAll<HTMLElement>('button,a.button')]){
  const host=document.createElement('span');host.className='magic-button-host';
  const html=button.outerHTML;button.replaceWith(host);setHTML(host,html);
 }
}
