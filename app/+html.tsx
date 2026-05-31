// Custom HTML document for the web build (static rendering). Expo Router
// wraps every statically-rendered route in this shell. We use it to wire
// up the PWA manifest and the Apple "Add to Home Screen" meta tags —
// installing to the home screen is what lets an iPhone web user escape
// Safari's ~7-day storage eviction and get an app-like, standalone launch.
import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover so safe-area insets work in standalone mode. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#F3EDDE" />

        {/* Apple "Add to Home Screen" */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Helix" />
        <link rel="apple-touch-icon" href="/icon.png" />

        {/* Disable body scrolling on web so the ScrollView behaves like
            native. Required by Expo Router for the root layout. */}
        <ScrollViewStyleReset />

        {/* TEMP DIAGNOSTIC — surface uncaught errors on screen so mobile users
            without DevTools can see what's crashing. Remove after fix. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  var errors=[];
  function show(){
    var box=document.getElementById('__err_overlay__');
    if(!box){
      box=document.createElement('pre');
      box.id='__err_overlay__';
      box.style.cssText='position:fixed;left:0;right:0;top:0;z-index:99999;background:#200;color:#fdd;padding:12px;margin:0;font:12px/1.4 ui-monospace,monospace;max-height:60vh;overflow:auto;white-space:pre-wrap;border-bottom:2px solid #f55';
      document.body.appendChild(box);
    }
    box.textContent='HELIX WEB ERROR LOG\\n\\n'+errors.join('\\n\\n---\\n\\n');
  }
  window.addEventListener('error',function(e){
    errors.push('[error] '+(e.message||e)+'\\n  at '+(e.filename||'?')+':'+(e.lineno||'?')+':'+(e.colno||'?')+(e.error&&e.error.stack?'\\n'+e.error.stack:''));
    show();
  });
  window.addEventListener('unhandledrejection',function(e){
    var r=e.reason;
    errors.push('[unhandledrejection] '+(r&&r.message?r.message:String(r))+(r&&r.stack?'\\n'+r.stack:''));
    show();
  });
  var origErr=console.error;
  console.error=function(){
    try{errors.push('[console.error] '+Array.prototype.slice.call(arguments).map(function(a){return a&&a.stack?a.stack:typeof a==='object'?JSON.stringify(a):String(a);}).join(' '));show();}catch(_){}
    origErr.apply(console,arguments);
  };
  setTimeout(function(){
    var root=document.getElementById('root');
    if(root&&root.children.length===0&&errors.length===0){
      errors.push('[diagnostic] After 5s the React root is still empty but no errors were captured. The app may be stuck during an async init step (font load, auth hydration, etc).');
      show();
    }
  },5000);
})();
`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
