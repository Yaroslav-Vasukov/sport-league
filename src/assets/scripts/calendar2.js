function J(){var A;const d=document.querySelector('[data-module="week-calendar"]');if(!d)return;const b=t=>String(t).padStart(2,"0"),u=t=>`${t.getFullYear()}-${b(t.getMonth()+1)}-${b(t.getDate())}`,E=t=>{const e=new Date(t.getFullYear(),t.getMonth(),t.getDate()),n=(e.getDay()+6)%7;return e.setDate(e.getDate()-n),e};function F(t){return(t||[]).map(e=>{var n,a,o,r,l,D;return{id:e.id??`${e.date}_${e.home}_${e.away}`,date:e.date,time:e.time??e.start_time??"",league:e.league??e.tournament??"",title:e.title??"",home:e.home??((n=e.home_team)==null?void 0:n.name)??"",away:e.away??((a=e.away_team)==null?void 0:a.name)??"",homeLogo:e.home_logo??((o=e.home_team)==null?void 0:o.logo)??"",awayLogo:e.away_logo??((r=e.away_team)==null?void 0:r.logo)??"",homeScore:e.home_score??((l=e.score)==null?void 0:l.home),awayScore:e.away_score??((D=e.score)==null?void 0:D.away),finished:!!(e.finished??e.is_final??e.status==="final"),status:e.status??"",btn:e.btn??null}})}function C(t){return t.reduce((e,n)=>{var a;return(e[a=n.date]||(e[a]=[])).push(n),e},{})}let i={},y=[];try{const t=d.querySelector("#week-calendar-data");if(t){const{events:e=[]}=JSON.parse(t.textContent.trim());y=F(e),i=C(y)}}catch(t){console.warn("[week-calendar] JSON parse failed",t)}const w=d.querySelector('[data-role="days-list"]'),S=d.querySelector('[data-role="matches-list"]'),M=d.querySelector('[data-role="day-label"]'),p=d.querySelector('[data-action="prev"]'),$=d.querySelector('[data-action="next"]'),L=d.querySelector('[data-action="today"]'),_=d.querySelector('[data-role="month-label"]'),m=new Date;let s=E(m),c=(A=i[u(m)])!=null&&A.length?u(m):null;function W(t){return Array.from({length:7},(e,n)=>{const a=new Date(t);return a.setDate(t.getDate()+n),a})}function v(){if(!_)return;const t=W(s),e=[...new Set(t.map(r=>r.getMonth()))],n=[...new Set(t.map(r=>r.getFullYear()))];if(e.length===1&&n.length===1){_.textContent=t[0].toLocaleDateString("sv-SE",{month:"long",year:"numeric"});return}const a=t[0],o=t[6];if(a.getFullYear()!==o.getFullYear()){const r=a.toLocaleDateString("sv-SE",{month:"short",year:"numeric"}),l=o.toLocaleDateString("sv-SE",{month:"short",year:"numeric"});_.textContent=`${r} – ${l}`}else{const r=a.toLocaleDateString("sv-SE",{month:"short"}),l=o.toLocaleDateString("sv-SE",{month:"short",year:"numeric"});_.textContent=`${r}–${l}`}}function T(t){const e=new Date(t),n=new Date(s),a=new Date(s);return a.setDate(a.getDate()+6),e>=n&&e<=a}function x(){var t;for(let e=0;e<7;e++){const n=new Date(s);n.setDate(s.getDate()+e);const a=u(n);if((t=i[a])!=null&&t.length)return a}return null}function H(t){const e=new Date(t.getFullYear(),t.getMonth(),t.getDate()),n=(e.getDay()+6)%7;e.setDate(e.getDate()-n);const a=new Date(e);return a.setDate(e.getDate()+6),{s:e,e:a}}async function N(t){const{s:e,e:n}=H(t),o=(Array.isArray(y)?y:[]).filter(r=>{const l=new Date(r.date);return l>=e&&l<=n});return C(o)}async function f(){var t;i=await N(s),(!c||!((t=i[c])!=null&&t.length))&&(c=x()||null),g(),k()}function g(){var e;w.innerHTML="";const t=document.createDocumentFragment();for(let n=0;n<7;n++){const a=new Date(s);a.setDate(s.getDate()+n);const o=u(a),r=document.createElement("button");r.type="button",r.className="calendar__day",r.innerHTML=`
      <span class="calendar__day-week">${a.toLocaleDateString("sv-SE",{weekday:"short"})}</span>
      <span class="calendar__day-num">${a.getDate()}</span>
    `,!!((e=i[o])!=null&&e.length)||(r.disabled=!0,r.classList.add("calendar__day--disabled")),r.addEventListener("click",()=>{r.disabled||(c=o,q(),k())}),t.appendChild(r)}w.appendChild(t),(!c||!T(c))&&(c=x()||null,k()),q(),v()}function q(){[...w.querySelectorAll(".calendar__day")].forEach((e,n)=>{e.classList.remove("calendar__day--active");const a=new Date(s);a.setDate(s.getDate()+n),u(a)===c&&e.classList.add("calendar__day--active")})}function O(t,e){const n=h=>h===""||h===null||h===void 0?null:Number(h),a=n(t.homeScore),o=n(t.awayScore),r=!!t.finished||a!==null&&o!==null,l=r?"result":"upcoming",D=r?t.status||"final":(()=>{try{return(t.time?new Date(`${e}T${t.time}:00`):new Date(`${e}T00:00:00`)).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}catch{return t.time||e}})(),Y=t.title||t.league||`${t.away} @ ${t.home}`,B=r?String(a??"–"):"–",I=r?String(o??"–"):"–",R=t.btn&&t.btn.text?`
    <div class="calendar-card__wrap">
      <a class="button ${t.btn.extra_class||"button--calendar"}" href="${t.btn.href||"#"}">${t.btn.text}</a>
    </div>`:"";return`
<article class="calendar-card calendar-card--${l}">
  <p class="calendar-card__title">${Y}</p>

  <div class="calendar-card__center">
    <div class="calendar-card__team">
      <a href="#" class="calendar-card__team-link">
        <img src="${t.awayLogo||"/assets/images/team2.webp"}" alt="${t.away} logo" class="calendar-card__logo">
        <p class="calendar-card__tag">${t.away}</p>
      </a>
      <p class="calendar-card__score">${I}</p>
    </div>

    <div class="calendar-card__info">
      <p class="calendar-card__info-title">${D}</p>
    </div>

    <div class="calendar-card__team">
      <a href="#" class="calendar-card__team-link">
        <img src="${t.homeLogo||"/assets/images/team1.webp"}" alt="${t.home} logo" class="calendar-card__logo">
        <p class="calendar-card__tag">${t.home}</p>
      </a>
      <p class="calendar-card__score">${B}</p>
    </div>
  </div>

  ${R}
</article>`}function k(){if(S.innerHTML="",!c){M.textContent="No games this week";return}const t=new Date(c);M.textContent=t.toLocaleDateString("sv-SE",{weekday:"long",day:"numeric",month:"long",year:"numeric"});const e=i[c]||[];if(!e.length){const a=document.createElement("li");a.textContent="No games on this day.",S.appendChild(a);return}const n=document.createDocumentFragment();e.forEach(a=>{const o=document.createElement("li");o.innerHTML=O(a,c),n.appendChild(o)}),S.appendChild(n)}p==null||p.addEventListener("click",()=>{s.setDate(s.getDate()-7),g(),f()}),$==null||$.addEventListener("click",()=>{s.setDate(s.getDate()+7),g(),f()}),L==null||L.addEventListener("click",()=>{s=E(m),c=u(m),g(),f()}),g(),f()}export{J as default};
