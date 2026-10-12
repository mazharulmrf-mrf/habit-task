import {
  bioAvailable as pBioAvailable,
  bioEnroll as pBioEnroll,
  bioAsk as pBioAsk,
  saveBackup,
  scheduleReminder,
  cancelReminder
} from './lib/platform.js'

(function(){
  var $=function(s,r){return (r||document).querySelector(s)};
  var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};

  /* ---------- splash loader ---------- */
  var steps=['Loading your habits…','Syncing your tasks…','Setting up today…','Ready'];
  var pr=$('#pr'),core=$('#core'),go=$('#go'),status=$('#status'),C=238.8,start=null,DUR=1500;
  function tick(t){
    if(!start)start=t;
    var p=Math.min((t-start)/DUR,1), e=1-Math.pow(1-p,2);
    pr.style.strokeDashoffset=C*(1-e);
    core.textContent=Math.round(e*100)+'%';
    status.textContent=steps[Math.min(Math.floor(p*3.01),3)];
    if(p<1){requestAnimationFrame(tick)}else{
      go.classList.add('ready');core.textContent='→';status.textContent='Starting…';setTimeout(enter,450);
    }
  }
  requestAnimationFrame(tick);
  var entered=false;
  function enter(){
    if(entered)return;entered=true;
    $('#splash').classList.add('out');$('#app').hidden=false;
    setTimeout(function(){$('#splash').hidden=true},450);
  }
  go.addEventListener('click',enter);

  /* ---------- shared data ---------- */
  var habits=[
    {n:'Drink water',s:'8 glasses',c:'Streak: 12',g:'💧',p:'m',d:false,v:3},
    {n:'Meditate',s:'10 min',c:'Cue: After waking up',g:'🍃',p:'m',d:true},
    {n:'Workout',s:'30 min',c:'Cue: Before work',g:'🏋',p:'m',d:false},
    {n:'Read',s:'20 pages',c:'Cue: After lunch',g:'📖',p:'a',d:false},
    {n:'Healthy lunch',s:'1 meal',c:'Cue: Before scrolling',g:'🍎',p:'a',d:true},
    {n:'Sleep by 11 PM',s:'11 PM',c:'Cue: Phone away',g:'☾',p:'n',d:false}
  ];
  var quit=[{n:'Late-night scrolling',days:5},{n:'Sugary drinks',days:18}];
  var tasks=[
    {n:'Submit assignment',w:'10:00 AM to 10:30 AM',d:'Today',i:'✓',p:100,a:false,f:true,q:2,off:0,ts:600,te:630},
    {n:'Pay electricity bill',w:'6:00 PM, home',d:'Today',i:'⚡',p:0,a:false,f:false,q:1,off:0,ts:1080,te:1110},
    {n:'Write lab report',w:'9:00 PM to 10:00 PM',d:'Today',i:'✎',p:70,a:false,f:false,q:0,off:0,ts:1260,te:1320},
    {n:'Lab prep',w:'11:00 AM to 12:00 PM',d:'Tue',i:'⚗',p:0,a:false,f:false,q:1,off:1,ts:660,te:720},
    {n:'Group study',w:'4:00 PM to 5:00 PM',d:'Wed',i:'☰',p:0,a:false,f:false,q:1,off:2,ts:960,te:1020},
    {n:'Physics revision',w:'Exam day',d:'Fri',i:'∑',p:35,a:false,f:false,q:0,off:4,ts:1020,te:1110}
  ];
  var filter='all',tab='list',mode='build',tday=0,wkOff=0;

  /* ---------- date strip ---------- */
  var now=new Date(),dn=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var hr=now.getHours();$('#greet').textContent=(hr<12?'Good morning':hr<18?'Good afternoon':'Good evening')+',';
  


  /* ---------- per-date habit log ---------- */
  function keyOf(d){return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()}
  var todayKey=keyOf(now),sel=todayKey,selDate=new Date(now),log={},dsLeft=null;
  for(var k=1;k<=13;k++){var pd=new Date(now);pd.setDate(now.getDate()-k);var lg={};
    habits.forEach(function(x,i){lg[i]=((k*7+i*3)%11)!==0});log[keyOf(pd)]=lg}
  function isDone(i,key){return key===todayKey?habits[i].d:!!(log[key]&&log[key][i])}
  function setDone(i,key){if(key===todayKey)habits[i].d=!habits[i].d;else{log[key]=log[key]||{};log[key][i]=!log[key][i]}}
  function hM(h){return /^(\d+)\s*(.*)$/.exec(h.s||'')}
  function hTgt(h){var m=hM(h);return m?+m[1]:1}
  function hUnit(h){var m=hM(h);return m?m[2]:''}
  function hCnt(h){var m=hM(h);return !!m&&+m[1]>1&&!/^(am|pm)\b/i.test(m[2])}
  function hStep(h){var t=hTgt(h);return t<=8?1:(t<=30?5:10)}
  function hCur(h){return h.v!=null?h.v:(h.d?hTgt(h):0)}
  function hAdd(h,dl){var t=hTgt(h),v=Math.max(0,Math.min(t,hCur(h)+dl));h.v=v;h.d=v>=t;return v}
  function hGoal(h,gl){if(!gl)return;var was=hCur(h);h.s=gl;if(hCnt(h)){h.v=Math.min(was,hTgt(h));h.d=h.v>=hTgt(h)}else{h.v=null}}

  /* ---------- save to device (localStorage) ---------- */
  var KEY='study2do.v1',lastSaved='',halt=false,failed=false,cfg={auto:true,sample:true,bak:0,bakDay:''};
  function readSaved(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){try{return JSON.parse(localStorage.getItem(KEY+'.bak')||'null')}catch(e2){return null}}}
  function swap(arr,src){Array.prototype.splice.apply(arr,[0,arr.length].concat(src))}
  try{
    var sv=readSaved();
    if(sv&&sv.habits&&sv.tasks&&sv.quit){
      swap(habits,sv.habits);swap(quit,sv.quit);swap(tasks,sv.tasks);
      Object.keys(log).forEach(function(k){delete log[k]});for(var lk in (sv.log||{}))log[lk]=sv.log[lk];
      if(sv.cfg)for(var ck in sv.cfg)cfg[ck]=sv.cfg[ck];
      var sp=String(sv.day).split('-'),t0=new Date(now.getFullYear(),now.getMonth(),now.getDate());
      var diff=Math.round((t0-new Date(+sp[0],+sp[1]-1,+sp[2]))/864e5);
      if(diff>0){
        var lg0={};habits.forEach(function(h,i){lg0[i]=!!h.d});log[sv.day]=lg0;
        habits.forEach(function(h){h.d=false;h.v=0});
        quit.forEach(function(q){q.days=(q.days||0)+diff});
        var keep=[];
        tasks.forEach(function(t){
          var o=t.off-diff;if(o<0&&t.f)return;
          o=Math.max(0,o);t.off=o;var td=new Date(now);td.setDate(now.getDate()+o);
          t.d=o===0?'Today':dn[td.getDay()];keep.push(t)
        });
        swap(tasks,keep);
      }
    }
  }catch(e){}
  function persist(){
    if(halt)return;
    try{
      var dirty=false;
      if(cfg.auto&&cfg.bakDay!==todayKey){cfg.bakDay=todayKey;cfg.bak=Date.now();dirty=true}
      var j=JSON.stringify({day:todayKey,habits:habits,quit:quit,tasks:tasks,log:log,cfg:cfg,theme:document.documentElement.getAttribute('data-theme')});
      if(j!==lastSaved){localStorage.setItem(KEY,j);lastSaved=j}
      if(dirty)localStorage.setItem(KEY+'.bak',j);
    }catch(e){if(!failed){failed=true;toast('Could not save. Export a backup now.')}}
  }
  try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}
  setInterval(persist,1500);
  document.addEventListener('visibilitychange',function(){if(document.hidden)persist()});
  window.addEventListener('pagehide',persist);
  function streakOf(i){var c=0,k=isDone(i,todayKey)?0:1;for(;k<400;k++){var d=new Date(now);d.setDate(now.getDate()-k);if(isDone(i,keyOf(d)))c++;else break}return c}
  function bestStreak(){return Math.max.apply(null,habits.map(function(_,i){return streakOf(i)}))}
  function countOn(key){var n=0;habits.forEach(function(x,i){if(isDone(i,key))n++});return n}

  /* ---------- swipe deck ---------- */
  function Deck(el,order,tilt,items,act){
    items=items||tasks;
    var drag=null,timer=null;
    function card(t,i){
      var st=t.s||(t.p===100?'Done':t.p===0?'Not started':'In progress');
      return '<div class="dcard'+(t.f?' isdone':'')+'" data-i="'+i+'" data-tone="'+(i%4)+'"><div class="dc-top"><span class="dc-ic">'+t.i+'</span><div><small>'+t.d+'</small><small>'+(t.w||'')+'</small></div><button class="dc-go'+(t.f?'':' open')+'" data-act="'+i+'" aria-label="Complete task">✓</button></div><b class="dc-t">'+t.n+'</b><div class="dc-prog" style="--p:'+t.p+'%"><i></i><span>'+st+'</span><b>'+t.p+'%</b></div></div>';
    }
    el.innerHTML=items.map(card).join('');
    function layout(){
      $$('.dcard',el).forEach(function(n){
        var p=order.indexOf(+n.dataset.i);
        var r=p===0?(tilt?-3:0):(p%2?1:-1)*(tilt?5:2.4)*Math.min(p,2);
        n.style.zIndex=20-p;n.style.opacity=p>3?0:1;n.style.pointerEvents=p===0?'auto':'none';
        n.style.transform='translateY('+p*20+'px) rotate('+r+'deg) scale('+(1-p*.05)+')';
      });
    }
    function fly(n,dir){
      n.style.transform='translateX('+dir*360+'px) rotate('+dir*18+'deg)';n.style.opacity=0;
      setTimeout(function(){order.push(order.shift());n.style.transition='none';layout();void n.offsetWidth;n.style.transition='';},260);
    }
    function stop(){if(timer){clearInterval(timer);timer=null}}
    el.addEventListener('pointerdown',function(e){
      if(e.target.closest('.dc-go'))return;
      var c=e.target.closest('.dcard');if(!c||order[0]!==+c.dataset.i)return;
      stop();drag={c:c,x:e.clientX,dx:0};c.style.transition='none';c.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove',function(e){
      if(!drag)return;drag.dx=e.clientX-drag.x;
      drag.c.style.transform='translateX('+drag.dx+'px) rotate('+drag.dx/18+'deg)';
    });
    function up(){if(!drag)return;var c=drag.c,dx=drag.dx;drag=null;c.style.transition='';if(Math.abs(dx)>70)fly(c,dx>0?1:-1);else layout()}
    el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
    el.addEventListener('click',function(e){var b=e.target.closest('[data-act]');if(b&&act)act(+b.dataset.act)});
    layout();
    return {auto:function(ms){timer=setInterval(function(){if(!el.isConnected||el.offsetParent===null)return stop();fly($('.dcard[data-i="'+order[0]+'"]',el),-1)},ms)}};
  }
  var splashItems=[
    {n:'Drink water',i:'💧',d:'Habit · Every day',w:'8 glasses',p:100,s:'Done today'},
    {n:'Write lab report',i:'✎',d:'Task · Today',w:'9:00 PM to 10:00 PM',p:70},
    {n:'Meditate, 10 min',i:'🍃',d:'Habit · Every day',w:'After waking up',p:100,s:'12 day streak'},
    {n:'Physics revision',i:'∑',d:'Task · Fri',w:'Exam day',p:35}
  ];
  var order1=splashItems.map(function(_,i){return i}),order2=tasks.map(function(_,i){return i}),order3=order2.slice();
  Deck($('#deck1'),order1,true,splashItems).auto(2600);

  var hstyle='focus';
  function listHTML(){
    var todo=[],fin=[];habits.forEach(function(h,i){(h.d?fin:todo).push(i)});
    var row=function(i){var h=habits[i],st=streakOf(i);return '<button class="lr '+(h.d?'done':'')+'" data-i="'+i+'"><span class="lc">'+(h.d?'✓':'')+'</span><div class="lt"><b>'+h.n+'</b><small>'+h.s+(st?' · '+st+' day streak':'')+'</small></div><span class="lg">'+h.g+'</span></button>'};
    return '<div class="lh"><span>To do</span><small>'+todo.length+'</small></div>'+(todo.length?todo.map(row).join(''):'<div class="le">Nothing left. Nice work.</div>')+(fin.length?'<div class="lh"><span>Completed</span><small>'+fin.length+'</small></div>'+fin.map(row).join(''):'');
  }
  function gridHTML(){
    var sun=new Date(now);sun.setDate(now.getDate()-now.getDay());var days=[];
    for(var k=0;k<7;k++){var d=new Date(sun);d.setDate(sun.getDate()+k);days.push(d)}
    var head='<div class="gr"><span></span>'+days.map(function(d){return '<span class="gd'+(keyOf(d)===todayKey?' cur':'')+'">'+dn[d.getDay()][0]+'<b>'+d.getDate()+'</b></span>'}).join('')+'</div>';
    var rows=habits.map(function(h,i){return '<div class="gr"><span class="gn"><span class="ggi">'+h.g+'</span><b>'+h.n+'</b></span>'+days.map(function(d){var key=keyOf(d),cur=key===todayKey,fut=d>now&&!cur,on=!fut&&isDone(i,key);return '<button class="gc'+(on?' on':'')+(fut?' fut':'')+(cur?' cur':'')+'" data-gi="'+i+'" data-gk="'+key+'"'+(fut?' disabled':'')+' aria-label="'+h.n+'">'+(on?'✓':'')+'</button>'}).join('')+'</div>'}).join('');
    return '<div class="gwrap">'+head+rows+'</div>';
  }

  function drawHH(t){
    var wk=0,h='';
    for(var k=6;k>=0;k--){var d=new Date(now);d.setDate(now.getDate()-k);var c=countOn(keyOf(d));wk+=c;h+='<i class="'+(k===0?'now':'')+'" style="height:'+Math.max(5,Math.round(c/t*34))+'px"></i>'}
    var e=$('#b7h');if(e)e.innerHTML=h;var w=$('#hs4');if(w)w.textContent=wk;
  }
  function drawPx(){
    var el=$('#px');if(!el)return;var n=habits.length||1,R=7,C=14,vals=[];
    for(var k=C-1;k>=0;k--){var d=new Date(now);d.setDate(now.getDate()-k);vals.push(countOn(keyOf(d))/n)}
    var h='';for(var r=0;r<R;r++)for(var c=0;c<C;c++){h+='<i class="'+((R-r)<=Math.round(vals[c]*R)?'on':'')+'"></i>'}
    el.innerHTML=h;
    var a=0,b=0;for(var i=0;i<7;i++){b+=vals[i];a+=vals[i+7]}
    var ch=b>0?Math.round((a-b)/b*100):(a>0?100:0),bb=$('#pxb');
    if(bb)bb.textContent=(ch>=0?'\u25b2 +'+ch:'\u25bc '+Math.abs(ch))+'%';
  }
  function drawDots(p){
    
    var el=$('#segs');if(!el)return;var h='',n=0;
    habits.forEach(function(x,i){var d=isDone(i,todayKey);if(d)n++;h+='<i class="'+(d?'on':'')+'"></i>'});
    el.innerHTML=h;el.setAttribute('role','img');el.setAttribute('aria-label',n+' of '+habits.length+' habits done today');
  }

  /* ---------- shared date bar (Habits + Tasks) ---------- */
  function dateBar(hasFn){
    var base=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    var wsun=new Date(base);wsun.setDate(base.getDate()-base.getDay()+wkOff*7);
    var mid=new Date(wsun);mid.setDate(wsun.getDate()+3);
    var head='<div class="tmonth"><span>'+mid.toLocaleDateString('en-GB',{month:'long',year:'numeric'})+'</span><span class="wnav"><button data-wk="-1" aria-label="Previous week">‹</button><button data-wk="1" aria-label="Next week">›</button></span></div>';
    var tiles=dn.map(function(l,k){var d=new Date(wsun);d.setDate(wsun.getDate()+k);var off=k-base.getDay()+wkOff*7;
      return '<button data-td="'+off+'" aria-label="'+l+' '+d.getDate()+'" class="'+(off===tday?'on':'')+(off===0?' td':'')+(k===0||k===6?' we':'')+'"><span>'+l+'</span><b>'+d.getDate()+'</b><i class="'+(hasFn(off,d)?'h':'')+'"></i></button>'}).join('');
    return head+'<div class="tstrip">'+tiles+'</div>';
  }
  function dateNav(e){
    var w=e.target.closest('[data-wk]');if(w){var dir=+w.dataset.wk;wkOff+=dir;tday+=dir*7;renderAll();return true}
    var t=e.target.closest('[data-td]');if(t){tday=+t.dataset.td;renderAll();return true}
    return false;
  }

  /* ---------- render ---------- */
  function done(){return habits.filter(function(h){return h.d}).length}
  function renderHome(){
    var n=done(),t=habits.length,p=Math.round(n/t*100);
    
    var tt=0;for(var kk=0;kk<14;kk++){var dd2=new Date(now);dd2.setDate(now.getDate()-kk);tt+=countOn(keyOf(dd2))}
    $('#hs2').textContent=bestStreak();$('#hs3').textContent=Math.round(tt/(14*t)*100)+'%';$('#pp').innerHTML=p+'<span class="pc">%</span>';$('#tcnt').textContent=tasks.filter(function(x){return x.off===0&&!x.f}).length+' left';drawDots(p);$('#hdate').textContent=now.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});drawPx();
        $('#qhome').innerHTML=quit.map(function(q){return '<button class="qc" data-quit="1"><span class="qi">🚫</span><span class="qt"><b>'+q.n+'</b><small>'+q.days+' days clean</small></span></button>'}).join('');
    var fmT=function(m){var h2=Math.floor(m/60),m2=m%60,ap=h2>=12?'PM':'AM';h2=h2%12||12;return h2+':'+(m2<10?'0':'')+m2+' '+ap};
    var tOpen=tasks.map(function(t2,i2){return {t:t2,i:i2}}).filter(function(x){return x.t.off===0&&!x.t.f}).sort(function(x,y){return (x.t.ts==null?-1:x.t.ts)-(y.t.ts==null?-1:y.t.ts)});
    $('#thome').innerHTML=tOpen.length?tOpen.slice(0,3).map(function(x){var t2=x.t;return '<div class="tc sm" data-c="'+x.i+'" role="button" tabindex="0"><span class="tbar"></span><div class="tm"><div class="tt"><b>'+t2.n+'</b>'+(t2.q===0?'<span class="tag"><i></i>Priority</span>':'')+'</div><small>'+(t2.ts==null?'Anytime':fmT(t2.ts)+' – '+fmT(t2.te))+'</small></div><span class="tk"></span></div>'}).join('')+(tOpen.length>3?'<button class="more" data-go="tasks">+'+(tOpen.length-3)+' more today</button>':''):'<div class="msg" style="margin:0">All tasks done for today. Nice work.</div>';
    $('#sh').textContent=n+' of '+t+' habits done today';drawHH(t);
    var ord=habits.map(function(_,i){return i}).sort(function(x,y){return (habits[x].d?1:0)-(habits[y].d?1:0)||x-y});
    var MAX=4,wkDays=[];for(var k=6;k>=0;k--){var wd=new Date(now);wd.setDate(now.getDate()-k);wkDays.push(keyOf(wd))}
    var hh='<div class="hgrid2">'+ord.slice(0,MAX).map(function(i,pos){
      var h=habits[i],m=/^(\d+)\s*(.*)$/.exec(h.s)||[0,h.s,''],wk=wkDays.map(function(key){return isDone(i,key)}),cnt=wk.filter(Boolean).length,vis;
      if(hCnt(h)){var Cc=106.8;vis='<svg class="hring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="17" fill="none" stroke="var(--line)" stroke-width="6"/><circle cx="22" cy="22" r="17" fill="none" stroke="var(--fg)" stroke-width="6" stroke-linecap="round" stroke-dasharray="'+(Cc*hCur(h)/hTgt(h)).toFixed(1)+' '+Cc+'" transform="rotate(-90 22 22)"/></svg>'}else if(i%3===1){vis='<div class="hbars" aria-hidden="true">'+wk.map(function(on){return '<i class="'+(on?'on':'')+'" style="height:'+(on?28:11)+'px"></i>'}).join('')+'</div>'}
      else{var C=106.8;vis='<svg class="hring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="17" fill="none" stroke="var(--line)" stroke-width="6"/><circle cx="22" cy="22" r="17" fill="none" stroke="var(--fg)" stroke-width="6" stroke-linecap="round" stroke-dasharray="'+(C*cnt/7).toFixed(1)+' '+C+'" transform="rotate(-90 22 22)"/></svg>'}
      return '<button class="ht '+(h.d?'done':'')+'" data-i="'+i+'" aria-label="'+h.n+'"><div class="hth"><span class="hti">'+h.g+'</span><b>'+h.n+'</b><span class="htk">✓</span></div><div class="htb"><div class="htv"><b>'+(hCnt(h)?hCur(h):m[1])+'</b><small>'+(hCnt(h)?'/ '+m[1]+' '+m[2]:m[2])+'</small>'+(hCur(h)>0?'<span class="dec" data-dec="'+i+'" role="button" aria-label="Remove one">−</span>':'')+(hCur(h)<hTgt(h)?'<span class="dec" data-inc="'+i+'" role="button" aria-label="Add one">+</span>':'')+'</div>'+vis+'</div></button>'}).join('')+'</div>'
      +(ord.length>MAX?'<button class="more" data-go="habits">+'+(ord.length-MAX)+' more habits</button>':'');
    $('#hgrid').innerHTML=hh;
  }
  function renderTasks(){
    $('#tabs').innerHTML=['list','matrix','calendar'].map(function(f){return '<button class="chip '+(tab===f?'on':'')+'" data-t="'+f+'">'+f[0].toUpperCase()+f.slice(1)+'</button>'}).join('');
    var h='';
    if(tab==='list'){
      var wsun=new Date(now);wsun.setDate(now.getDate()-now.getDay());
      var selD=new Date(now);selD.setDate(now.getDate()+tday);
      var strip=dateBar(function(off){return tasks.some(function(t){return t.off===off})});
      var list=tasks.map(function(t,i){return {t:t,i:i}}).filter(function(x){return x.t.off===tday}).sort(function(x,y){return (x.t.ts==null?-1:x.t.ts)-(y.t.ts==null?-1:y.t.ts)});
      var left=list.filter(function(x){return !x.t.f}).length;
      var fm=function(m){var hh=Math.floor(m/60),mm=m%60,ap=hh>=12?'PM':'AM';hh=hh%12||12;return hh+':'+(mm<10?'0':'')+mm+' '+ap};
      var nowMin=now.getHours()*60+now.getMinutes(),nowDone=false,pos=0;
      var nowRow='<div class="tl tnow"><span class="tlt"><em>Now</em></span><div class="tnl"></div></div>';
      var row=function(x){var t=x.t,i=x.i,st=t.f?'Done':(t.off<0?'Overdue':(t.p>0?'In progress':'Upcoming')),pre='';
        if(tday===0&&!nowDone&&t.ts!=null&&t.ts>nowMin){nowDone=true;pre=nowRow}
        return pre+'<div class="tl"><span class="tlt">'+(t.ts==null?'Anytime':fm(t.ts))+'</span><div class="tc'+(t.f?' fin':'')+'" data-tone="'+((pos++)%4)+'" data-c="'+i+'" role="button" tabindex="0"><span class="tbar"></span><div class="tm"><div class="tt"><b>'+esc(t.n)+(t.fv?'<span class="hrt">♥</span>':'')+'</b>'+(t.q===0&&!t.f?'<span class="tag"><i></i>Priority</span>':'')+'</div><small>'+st+'</small>'+((t.ts==null&&!t.rp)?'':'<div class="tmeta">'+(t.ts==null?'':'◷ '+fm(t.ts)+' – '+fm(t.te))+(t.rp?(t.ts==null?'':' · ')+'↻ '+cap(t.rp):'')+'</div>')+'</div><span class="tk" data-tk="'+i+'">'+(t.f?'✓':'')+'</span></div></div>'};
      var doneN=list.length-left;
      h=strip+'<p class="tsum">'+(list.length?(left?'You completed <b>'+doneN+'</b>/'+list.length+' tasks scheduled':'All '+list.length+' tasks completed. Nice work.'):'')+'</p>'+(list.length?'<div class="tlist">'+list.map(row).join('')+'</div>':'<div class="msg">Nothing planned. Tap + to add a task.</div>')+'<button class="addrow" data-newtask style="margin-top:8px">+ Add a task</button>';
    }else if(tab==='matrix'){
      var names=['Do now','Schedule','Delegate','Drop'];
      h='<div class="matrix">'+names.map(function(nm,q){
        return '<div class="q"><h3>'+nm+'</h3>'+tasks.filter(function(t){return !t.f&&(t.q===q||(q===1&&t.q===3))}).map(function(t){return '<p>'+t.n+'</p>'}).join('')+'</div>'}).join('')+'</div>';
    }else{
      var first=new Date(now.getFullYear(),now.getMonth(),1),off=first.getDay(),dim=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
      h='<div class="panel"><h3 style="margin-bottom:12px">'+now.toLocaleDateString('en-GB',{month:'long',year:'numeric'})+'</h3><div class="cal">'+dn.map(function(d){return '<span class="h">'+d[0]+'</span>'}).join('');
      var hasT={};tasks.forEach(function(t){var dd=new Date(now);dd.setDate(now.getDate()+t.off);if(dd.getMonth()===now.getMonth()&&dd.getFullYear()===now.getFullYear())hasT[dd.getDate()]=1});
      for(var i=0;i<off;i++)h+='<span></span>';
      for(var d=1;d<=dim;d++)h+='<span class="'+(d===now.getDate()?'today':(hasT[d]?'dot':''))+'">'+d+'</span>';
      h+='</div></div>';
    }
    $('#tbody').innerHTML=h;
  }
  $('#bell').addEventListener('click',function(){this.classList.add('seen');toast('No new notifications')});
  $('#avatar').addEventListener('click',function(){show('settings')});
  function renderHabits(){
    var _d=new Date(now);_d.setDate(now.getDate()+tday);$('#nb').textContent=countOn(keyOf(_d))+'/'+habits.length;$('#nq').textContent=Math.max.apply(null,quit.map(function(q){return q.days}).concat([0]))+'d';
    var h='';
    if(mode==='build'){
      selDate=new Date(now);selDate.setDate(now.getDate()+tday);sel=keyOf(selDate);
      var t=habits.length,n=countOn(sel),days=[],tot=0;
      for(var k=13;k>=0;k--){var d=new Date(now);d.setDate(now.getDate()-k);days.push(d);tot+=countOn(keyOf(d))}
      var pct=Math.round(n/t*100),rate=Math.round(tot/(14*t)*100),wk=0;
      days.slice(7).forEach(function(d){wk+=countOn(keyOf(d))});
      h=dateBar(function(off,d){return off<=0&&countOn(keyOf(d))>0});
      var bars7=days.slice(7).map(function(d,bi){var c7=countOn(keyOf(d));return '<i class="'+(bi===6?'now':'')+'" style="height:'+Math.max(5,Math.round(c7/t*34))+'px"></i>'}).join('');
      h+='<div class="sub" style="margin-top:4px"><h3>All habits</h3><small>Tap to check</small></div>';
      habits.forEach(function(x,i){
        var dn2=isDone(i,sel),st=streakOf(i);
        var dots=days.slice(7).map(function(d){var key=keyOf(d);return '<i class="'+(isDone(i,key)?'on':'')+(key===sel?' cur':'')+'"></i>'}).join('');
        h+='<div role="button" tabindex="0" class="hr2 '+(dn2?'done':'')+'" data-i="'+i+'" data-tone="'+(i%4)+'"><span class="hi">'+x.g+'</span><div class="tx"><b>'+x.n+'</b><small>'+(hCnt(x)&&sel===todayKey?hCur(x)+' of '+x.s:x.s)+' · '+x.c+'</small><div class="wk">'+dots+'</div></div><div class="rt"><span class="rtop"><span class="stk2">'+(st?'🔥 '+st:'')+'</span><button class="ed" data-e="'+i+'" aria-label="Rename habit">✎</button></span>'+(sel===todayKey?(hCur(x)>0?'<span class="dec" data-dec="'+i+'" role="button" aria-label="Remove one">−</span>':'')+(hCur(x)<hTgt(x)?'<span class="dec" data-inc="'+i+'" role="button" aria-label="Add one">+</span>':''):'')+'<span class="ck">'+(dn2?'✓':'')+'</span></div></div>';
      });
      h+='<button class="addrow" data-newhabit>+ Add a habit</button>';
      h+='<div class="sub"><h3>Last 14 days</h3><small>'+rate+'% done</small></div><div class="heat">'+days.map(function(d){var r=countOn(keyOf(d))/t,l=r>=.8?3:r>=.5?2:r>0?1:0;return '<i class="'+(l?'l'+l:'')+'"></i>'}).join('')+'</div>';
    }else{
      h=quit.map(function(q,i){return '<div class="panel" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div style="min-width:0"><b>'+q.n+'</b><br><small style="color:var(--muted)">'+q.days+' days clean</small></div><button class="chip" data-slip="'+i+'">I slipped</button></div><div id="m'+i+'"></div></div>'}).join('')+'<button class="addrow" data-newquit>+ Quit something new</button>';
    }
    $('#hb').innerHTML=h;
  }
  function renderAll(){renderHome();renderTasks();renderHabits()}
  renderAll();

  var toastT=null;
  var undoFn=null;
  function toast(m){var t=$('#toast');undoFn=null;t.classList.remove('act');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('show')},1800)}
  function toastU(m,fn){var t=$('#toast');t.textContent=m+'  ';var u=document.createElement('u');u.textContent='Undo';u.setAttribute('data-undo','1');t.appendChild(u);undoFn=fn;t.classList.add('show','act');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('show','act');undoFn=null},4500)}
  $('#toast').addEventListener('click',function(e){if(e.target.closest('[data-undo]')&&undoFn){var f=undoFn;undoFn=null;this.classList.remove('show','act');f()}});

  /* ---------- habit rename + auto icon ---------- */
  var ICONS=[[/\b(water|drink|pani|juice)/,'💧'],[/\b(medit|yoga|mind|relax|breath)/,'🍃'],[/\b(work ?out|gym|exercis|lift|push ?up|sport)/,'🏋'],[/\b(run|jog|walk|cycl|hike|step)/,'🏃'],[/\b(read|book|study|pori|novel|quran)/,'📖'],[/\b(lunch|eat|meal|diet|fruit|food|breakfast|dinner|veg)/,'🍎'],[/\b(sleep|bed|ghum|nap)/,'☾'],[/\b(code|coding|program|develop)/,'💻'],[/\b(pray|namaz|salah|dua|church|temple)/,'🕌'],[/\b(write|journal|diary|note)/,'✎'],[/\b(vitamin|medic|pill|tablet)/,'💊'],[/\b(clean|tidy|room|laundry|dish)/,'🧹'],[/\b(call|family|friend|mom|dad)/,'📞'],[/\b(music|guitar|piano|sing)/,'🎵'],[/\b(save|money|budget)/,'💰'],[/\b(gratitude|thank|smile)/,'🙂'],[/\b(shower|bath|teeth|brush|skin)/,'🚿']];
  function iconFor(n){n=(n||'').toLowerCase();for(var i=0;i<ICONS.length;i++)if(ICONS[i][0].test(n))return ICONS[i][1];return '★'}
  var editIdx=-1,kind='habit';
  var KINDS={habit:{t:'New habit',ph:'Habit name',hint:'The icon changes with the name. Try "Read book" or "Evening run".',ic:'★'},task:{t:'New task',ph:'Task name',hint:'It shows up under Today in your task list.',ic:'☑'},quit:{t:'Quit a habit',ph:'What do you want to quit?',hint:'Clean days are counted from today.',ic:'🚫'}};
  function openForm(k,i){
    kind=k;editIdx=i==null?-1:i;var c=KINDS[k];
    $('#etitle').textContent=(k==='habit'&&editIdx>=0)?'Edit habit':c.t;
    $('#hname').placeholder=c.ph;$('#ehint').textContent=c.hint;
    $('#hname').value=editIdx>=0?habits[editIdx].n:'';$('#grow').style.display=k==='habit'?'flex':'none';$('#hgoal').value=(k==='habit'&&editIdx>=0)?habits[editIdx].s:'';
    $('#eic').textContent=editIdx>=0?habits[editIdx].g:c.ic;
    $('#esheet').hidden=false;setTimeout(function(){$('#hname').focus()},50);
  }
  function openEdit(i){openForm('habit',i)}
  function saveEdit(){
    var name=$('#hname').value.trim();if(!name){$('#hname').focus();return}
    var msg;
    if(kind==='habit'){
      if(editIdx>=0){habits[editIdx].n=name;habits[editIdx].g=iconFor(name);hGoal(habits[editIdx],$('#hgoal').value.trim());msg='Habit updated'}
      else{var nh={n:name,s:'1 time',c:'Cue: Anytime',g:iconFor(name),p:'m',d:false};hGoal(nh,$('#hgoal').value.trim());habits.push(nh);msg='Habit added'}
    }else if(kind==='task'){var td0=new Date(now);td0.setDate(now.getDate()+tday);tasks.push({n:name,w:'',d:tday===0?'Today':dn[td0.getDay()],i:'☑',p:0,a:false,f:false,q:1,off:tday,ts:null,te:null});msg='Task added'}
    else{quit.push({n:name,days:0});msg='Quit habit added'}
    $('#esheet').hidden=true;renderAll();toast(msg);
  }
  $('#hname').addEventListener('input',function(){
    if(kind!=='habit')return;
    var ic=$('#eic'),g=iconFor(this.value);
    if(ic.textContent!==g){ic.textContent=g;ic.classList.add('pop');setTimeout(function(){ic.classList.remove('pop')},180)}
  });
  $('#hname').addEventListener('keydown',function(e){if(e.key==='Enter')saveEdit()});
  $('#esave').addEventListener('click',saveEdit);
  $('#ecancel').addEventListener('click',function(){$('#esheet').hidden=true});
  $('#esheet').addEventListener('click',function(e){if(e.target===this)this.hidden=true});
  $('#hb').addEventListener('keydown',function(e){var r=e.target.closest('.hr2');if(r&&e.target===r&&(e.key==='Enter'||e.key===' ')){e.preventDefault();r.click()}});


  /* ---------- tasks: add / edit / detail / repeat / favorite / delete ---------- */
  var tEdit=-1,tPr=1,tRp='none',tFav=false,tDetail=-1,tProgT=false,delArm=false;
  function pad2(n){return n<10?'0'+n:''+n}
  function esc(x){return String(x==null?'':x).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function dstr(o){var d=new Date(now);d.setDate(now.getDate()+o);return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())}
  function offOf(str){var p=str.split('-'),d=new Date(+p[0],+p[1]-1,+p[2]),t0=new Date(now.getFullYear(),now.getMonth(),now.getDate());return Math.round((d-t0)/864e5)}
  function hm(v){if(!v)return null;var p=v.split(':');return (+p[0])*60+(+p[1])}
  function hmStr(m){return m==null?'':pad2(Math.floor(m/60))+':'+pad2(m%60)}
  function fm12(m){var h=Math.floor(m/60),mm=m%60,ap=h>=12?'PM':'AM';h=h%12||12;return h+':'+pad2(mm)+' '+ap}
  function dayLabel(o){var d=new Date(now);d.setDate(now.getDate()+o);return o===0?'Today':dn[d.getDay()]}
  function cap(x){return x?x[0].toUpperCase()+x.slice(1):''}
  function setSeg(id,val){$$('#'+id+' button').forEach(function(b){b.classList.toggle('on',b.dataset.v===String(val))})}
  function jumpTo(o){tday=o;wkOff=Math.floor((o+now.getDay())/7)}
  function openTask(i){
    tEdit=i==null?-1:i;var t=tEdit>=0?tasks[tEdit]:null;tProgT=false;
    $('#ttitle').textContent=t?'Edit task':'New task';$('#tsave').textContent=t?'Save changes':'Add task';
    $('#tname').value=t?t.n:'';$('#tdate').value=dstr(t?t.off:tday);$('#tts').value=t?hmStr(t.ts):'';$('#tte').value=t?hmStr(t.te):'';
    tPr=t?(t.q>2?2:t.q):1;tRp=(t&&t.rp)||'none';tFav=!!(t&&t.fv);
    setSeg('tpr',tPr);setSeg('trp',tRp);$('#tgoal').value=(t&&t.rg)||'';$('#tgoalrow').hidden=tRp==='none';
    $('#tnote').value=(t&&t.nt)||'';var pg=t?t.p:0;$('#tprog').value=pg;$('#tpv').textContent=pg+'%';
    $('#tfav').textContent=tFav?'♥':'♡';$('#tfav').classList.toggle('on',tFav);
    var more=!!(t&&(t.q!==1||t.rp||t.nt||(t.p>0&&t.p<100)));$('#tmorebox').hidden=!more;$('#tmore').textContent=more?'Fewer options ▴':'More options ▾';
    $('#tsheet').hidden=false;setTimeout(function(){$('#tname').focus()},60);
  }
  function remind(t){
    if(!t||t.f||t.ts==null)return;
    var d=new Date(now);d.setDate(d.getDate()+t.off);d.setHours(Math.floor(t.ts/60),t.ts%60,0,0);
    cancelReminder(t).then(function(){return scheduleReminder(t,d)}).catch(function(){});
  }
  function saveTask(){
    var name=$('#tname').value.trim();if(!name){$('#tname').focus();return}
    var ds=$('#tdate').value,off=ds?offOf(ds):tday,ts=hm($('#tts').value),te=hm($('#tte').value),wasEdit=tEdit>=0;
    if(ts==null)te=null;else if(te==null||te<=ts)te=Math.min(ts+60,1439);
    var t=wasEdit?tasks[tEdit]:{id:'t'+Date.now()+Math.random().toString(36).slice(2,6),i:'☑',a:false,f:false,p:0,sc:0};
    t.n=name;t.off=off;t.d=dayLabel(off);t.ts=ts;t.te=te;t.q=tPr;
    t.rp=tRp==='none'?null:tRp;t.rg=(t.rp&&(+$('#tgoal').value>0))?+$('#tgoal').value:null;
    t.nt=$('#tnote').value.trim();t.fv=tFav;t.w=ts!=null?fm12(ts)+' to '+fm12(te):'';
    if(tProgT){var pv=+$('#tprog').value;t.p=pv;t.f=pv>=100;if(t.f)t.a=false}
    if(!wasEdit)tasks.push(t);
    remind(t);
    $('#tsheet').hidden=true;jumpTo(off);renderAll();toast(wasEdit?'Task updated':'Task added');
  }
  function nextOff(t){
    var d=new Date(now);d.setDate(now.getDate()+t.off);
    if(t.rp==='daily')d.setDate(d.getDate()+1);else if(t.rp==='weekly')d.setDate(d.getDate()+7);
    else{var dm=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+1);d.setDate(Math.min(dm,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()))}
    return offOf(d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()));
  }
  function toggleTask(i){
    var t=tasks[i];if(!t)return;
    if(!t.f){
      t.f=true;t.a=false;t.p=100;cancelReminder(t);
      if(t.rp){
        var pc=t.sc||0,nx=t.rg?(pc+1>=t.rg?0:pc+1):pc;t.sc=t.rg?Math.min(pc+1,t.rg):pc;
        var n={};for(var k in t)n[k]=t[k];n.id='t'+Date.now()+Math.random().toString(36).slice(2,6);n.off=nextOff(t);n.d=dayLabel(n.off);n.f=false;n.a=false;n.p=0;n.sc=nx;n.nx=null;
        t.nx=n.id;tasks.push(n);remind(n);toast('Done. Next: '+(n.off===1?'tomorrow':dayLabel(n.off)));
      }else toast('Task completed');
    }else{
      t.f=false;t.p=0;
      if(t.nx){for(var j=tasks.length-1;j>=0;j--)if(tasks[j].id===t.nx&&!tasks[j].f)tasks.splice(j,1);t.nx=null}
      toast('Task reopened');
    }
    renderAll();if(!$('#dsheet').hidden)openDetail(tasks.indexOf(t));
  }
  function deleteTask(i){
    var r=tasks.splice(i,1)[0];cancelReminder(r);$('#dsheet').hidden=true;renderAll();
    toastU('Task deleted',function(){tasks.splice(Math.min(i,tasks.length),0,r);remind(r);renderAll()});
  }
  function openDetail(i){
    tDetail=i;delArm=false;var t=tasks[i];if(!t)return;
    var pr=['High','Medium','Low','Low'][t.q]||'Medium',d=new Date(now);d.setDate(now.getDate()+t.off);
    var h='<div class="trow"><h3 class="dt'+(t.f?' fin':'')+'">'+esc(t.n)+'</h3><span><button class="ib'+(t.fv?' on':'')+'" data-d="fav" aria-label="Favorite">'+(t.fv?'♥':'♡')+'</button><button class="ib" data-d="close" aria-label="Close">✕</button></span></div>';
    h+='<button class="o" data-d="done">'+(t.f?'✓ Done · tap to reopen':'○ Mark as done')+'</button>';
    h+='<div class="chips2"><span class="c2">'+pr+' priority</span><span class="c2">'+d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})+'</span>';
    if(t.ts!=null)h+='<span class="c2">◷ '+fm12(t.ts)+' – '+fm12(t.te)+'</span>';
    if(t.rp)h+='<span class="c2">↻ '+cap(t.rp)+'</span>';
    if(t.rg)h+='<span class="c2">Streak '+(t.sc||0)+' / '+t.rg+'</span>';
    if(!t.f&&t.off<0)h+='<span class="c2" style="color:var(--warn)">Overdue</span>';
    h+='</div>';
    h+='<div class="nbox"'+(t.nt?'':' style="color:var(--muted)"')+'>'+(t.nt?esc(t.nt):'No note yet. Tap Edit to add one.')+'</div>';
    if(t.p>0&&t.p<100)h+='<div class="pbar"><i style="width:'+t.p+'%"></i></div>';
    h+='<div class="dact"><button data-d="edit">✎ Edit</button><button class="del" data-d="del">🗑 Delete</button></div>';
    $('#dbox').innerHTML=h;$('#dsheet').hidden=false;
  }
  $('#tclose').addEventListener('click',function(){$('#tsheet').hidden=true});
  $('#tsheet').addEventListener('click',function(e){if(e.target===this)this.hidden=true});
  $('#tsave').addEventListener('click',saveTask);
  $('#tfav').addEventListener('click',function(){tFav=!tFav;this.textContent=tFav?'♥':'♡';this.classList.toggle('on',tFav)});
  $('#tmore').addEventListener('click',function(){var b=$('#tmorebox');b.hidden=!b.hidden;this.textContent=b.hidden?'More options ▾':'Fewer options ▴'});
  $('#tpr').addEventListener('click',function(e){var b=e.target.closest('[data-v]');if(!b)return;tPr=+b.dataset.v;setSeg('tpr',tPr)});
  $('#trp').addEventListener('click',function(e){var b=e.target.closest('[data-v]');if(!b)return;tRp=b.dataset.v;setSeg('trp',tRp);$('#tgoalrow').hidden=tRp==='none'});
  $('#tprog').addEventListener('input',function(){tProgT=true;$('#tpv').textContent=this.value+'%'});
  $('#dsheet').addEventListener('click',function(e){
    if(e.target===this){this.hidden=true;return}
    var b=e.target.closest('[data-d]');if(!b)return;var a=b.dataset.d,t=tasks[tDetail];if(!t)return;
    if(a==='close')this.hidden=true;
    else if(a==='fav'){t.fv=!t.fv;renderAll();openDetail(tDetail)}
    else if(a==='done')toggleTask(tDetail);
    else if(a==='edit'){this.hidden=true;openTask(tDetail)}
    else if(a==='del'){if(!delArm){delArm=true;b.textContent='Tap again to delete'}else deleteTask(tDetail)}
  });

  /* ---------- events ---------- */
  function toggle(i){habits[i].d=!habits[i].d;renderAll();if(habits[i].d)toast('Nice, '+habits[i].n+' done')}
  function tapHabit(i){var h=habits[i];if(!hCnt(h)){toggle(i);return}if(hCur(h)>=hTgt(h)){hAdd(h,-hStep(h));renderAll();toast(hCur(h)+' of '+hTgt(h)+' '+hUnit(h));return}hAdd(h,hStep(h));renderAll();toast(h.d?'Nice, '+h.n+' done':hCur(h)+' of '+hTgt(h)+' '+hUnit(h))}
  function stepHabit(i,sg){var h=habits[i];if(!hCnt(h)){h.d=sg>0;h.v=null;renderAll();if(h.d)toast('Nice, '+h.n+' done');return}hAdd(h,sg*hStep(h));renderAll();if(sg>0)toast(h.d?'Nice, '+h.n+' done':hCur(h)+' of '+hTgt(h)+' '+hUnit(h))}
  $('#hgrid').addEventListener('click',function(e){var gc=e.target.closest('[data-gi]');if(gc){setDone(+gc.dataset.gi,gc.dataset.gk);renderAll();return}var dc=e.target.closest('[data-dec]');if(dc){stepHabit(+dc.dataset.dec,-1);return}var ic=e.target.closest('[data-inc]');if(ic){stepHabit(+ic.dataset.inc,1);return}var b=e.target.closest('[data-i]');if(b)tapHabit(+b.dataset.i)});
  $('#hb').addEventListener('click',function(e){
    if(e.target.closest('[data-newhabit]')){openForm('habit');return}
    if(e.target.closest('[data-newquit]')){openForm('quit');return}
    var ed=e.target.closest('[data-e]');if(ed){openEdit(+ed.dataset.e);return}
    if(dateNav(e))return;
    var dc=e.target.closest('[data-dec]');if(dc){stepHabit(+dc.dataset.dec,-1);return}
    var ic=e.target.closest('[data-inc]');if(ic){stepHabit(+ic.dataset.inc,1);return}
    var b=e.target.closest('[data-i]');if(b){if(tday>0){toast('You can\'t check a future day');return}var hi=+b.dataset.i;if(sel===todayKey&&hCnt(habits[hi])){tapHabit(hi);return}setDone(hi,sel);renderAll();if(isDone(+b.dataset.i,sel))toast('Nice, '+habits[+b.dataset.i].n+' done');return}
    var s=e.target.closest('[data-slip]');
    if(s){var i=+s.dataset.slip;$('#m'+i).innerHTML='<div class="msg">It happens. Your best run still counts. <button class="chip on" data-reset="'+i+'" style="margin-left:6px">Reset</button></div>'}
    var r=e.target.closest('[data-reset]');
    if(r){quit[+r.dataset.reset].days=0;renderAll()}
  });
  $('#tabs').addEventListener('click',function(e){var b=e.target.closest('[data-t]');if(b){tab=b.dataset.t;renderTasks()}});
  $('#tbody').addEventListener('click',function(e){
    if(e.target.closest('[data-newtask]')){openTask();return}
    if(dateNav(e))return;
    var s=e.target.closest('[data-s]');
    if(s){var i=+s.dataset.s,was=tasks[i].a;tasks.forEach(function(t){t.a=false});tasks[i].a=!was;renderAll()}
    var k=e.target.closest('[data-tk]');if(k){e.stopPropagation();toggleTask(+k.dataset.tk);return}
    var c=e.target.closest('[data-c]');
    if(c)openDetail(+c.dataset.c);
  });
  $('#bq').addEventListener('click',function(e){var b=e.target.closest('[data-m]');if(!b)return;mode=b.dataset.m;$$('#bq button').forEach(function(x){x.classList.toggle('on',x===b)});renderHabits()});

  function show(v){
    $$('.view').forEach(function(x){x.hidden=x.id!=='v-'+v});
    $$('#nav [data-v]').forEach(function(b){b.classList.toggle('on',b.dataset.v===v)});
  }
  $('#nav').addEventListener('click',function(e){var b=e.target.closest('[data-v]');if(b)show(b.dataset.v)});
  $('#v-home').addEventListener('click',function(e){if(e.target.closest('[data-quit]')){mode='quit';$$('#bq button').forEach(function(x){x.classList.toggle('on',x.dataset.m==='quit')});renderHabits();show('habits');return}
    var g=e.target.closest('[data-go]');if(g)show(g.dataset.go)});
  $('#thome').addEventListener('click',function(e){var c=e.target.closest('[data-c]');if(!c)return;toggleTask(+c.dataset.c)});
  $('#thome').addEventListener('keydown',function(e){var c=e.target.closest('[data-c]');if(c&&e.target===c&&(e.key==='Enter'||e.key===' ')){e.preventDefault();c.click()}});
  $('#plus').addEventListener('click',function(){$('#sheet').hidden=false});
  $('#sheet').addEventListener('click',function(e){
    var o=e.target.closest('[data-add]');
    if(o){var a=o.dataset.add;if(a==='quit'){mode='quit';$$('#bq button').forEach(function(x){x.classList.toggle('on',x.dataset.m==='quit')});renderHabits();show('habits');openForm('quit')}else{if(a==='habits'){mode='build';$$('#bq button').forEach(function(x){x.classList.toggle('on',x.dataset.m==='build')});renderHabits()}show(a);if(a==='habits')openEdit(-1);if(a==='tasks')openTask()}}
    $('#sheet').hidden=true;
  });
  $$('#theme button').forEach(function(b){b.classList.toggle('on',b.dataset.t==='system')});
  $('#theme').addEventListener('click',function(e){
    var b=e.target.closest('[data-t]');if(!b)return;
    if(b.dataset.t==='system')document.documentElement.removeAttribute('data-theme');else document.documentElement.setAttribute('data-theme',b.dataset.t);persist();
    $$('#theme button').forEach(function(x){x.classList.toggle('on',x===b)});
  });
  $$('.two .srow[data-msg]').forEach(function(b){b.addEventListener('click',function(){toast(b.dataset.msg)})});
  $$('[data-sw]').forEach(function(r){r.addEventListener('click',function(e){if(e.target.id==='prevlock')return;r.querySelector('.sw').classList.toggle('on')})});

  /* ---------- settings: safety copy, backup, sample data ---------- */
  function paintCfg(){
    $('#autosw').classList.toggle('on',!!cfg.auto);
    $('#baktxt').textContent=cfg.auto&&cfg.bak?'Last copy: '+new Date(cfg.bak).toLocaleString([],{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):(cfg.auto?'Kept on this device':'Off');
    $('#clr').hidden=!cfg.sample;
  }
  $('#autorow').addEventListener('click',function(){cfg.auto=!cfg.auto;if(cfg.auto)cfg.bakDay='';persist();paintCfg()});
  function exportData(){
    var data=JSON.stringify({app:'tickly',v:1,exported:new Date().toISOString(),day:todayKey,habits:habits,quit:quit,tasks:tasks,log:log,cfg:{auto:cfg.auto,sample:cfg.sample}},null,1);
    var name='habit-task-backup-'+todayKey+'.json';
    saveBackup(data,name).then(function(how){if(how==='download')toast('Backup downloaded')}).catch(function(){toast('Export failed')});
  }
  $('#exp').addEventListener('click',exportData);
  $('#imp').addEventListener('click',function(){$('#impf').value='';$('#impf').click()});
  $('#impf').addEventListener('change',function(){
    var f=this.files&&this.files[0];if(!f)return;var r=new FileReader();
    r.onload=function(){
      var d;try{d=JSON.parse(r.result);if((d.app!=='tickly'&&d.app!=='habitask'&&d.app!=='study2do')||!Array.isArray(d.habits)||!Array.isArray(d.tasks)||!Array.isArray(d.quit))throw 0}catch(e){toast('That is not a valid Habitask backup');return}
      if(!confirm('Replace all current data with this backup?'))return;
      try{localStorage.setItem(KEY,JSON.stringify({day:d.day||todayKey,habits:d.habits,quit:d.quit,tasks:d.tasks,log:d.log||{},cfg:{auto:d.cfg?d.cfg.auto!==false:true,sample:!!(d.cfg&&d.cfg.sample),bak:0,bakDay:''},theme:document.documentElement.getAttribute('data-theme')}));halt=true;location.reload()}
      catch(e){toast('Could not restore (storage full?)')}
    };
    r.readAsText(f);
  });
  $('#clr').addEventListener('click',function(){
    if(!confirm('Remove demo tasks, quit list and history? Your habits stay, so you can rename them.'))return;
    tasks.length=0;quit.length=0;Object.keys(log).forEach(function(k){delete log[k]});
    habits.forEach(function(h){h.d=false;h.v=0;h.c='Cue: Anytime'});
    cfg.sample=false;persist();paintCfg();renderAll();toast('Sample data cleared');
  });

  /* ---------- app lock (PIN, stored as salted SHA-256) ---------- */
  var PK='study2do.pin',lm=null,pin='',pend='',leftAt=0,fails=0,until=0;
  function lockOn(){try{return !!localStorage.getItem(PK)}catch(e){return false}}
  function sha(salt,p){if(!(window.crypto&&crypto.subtle&&window.TextEncoder))return Promise.reject();return crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+p)).then(function(h){return Array.prototype.map.call(new Uint8Array(h),function(x){return ('0'+x.toString(16)).slice(-2)}).join('')})}
  function dots(){$$('#dots i').forEach(function(d,i){d.classList.toggle('f',i<pin.length)})}
  function paintLock(){$('#locksw').classList.toggle('on',lockOn());$('#locktxt').textContent=lockOn()?'On. Asks for PIN after 30 seconds away':'Off';paintBio()}
  /* fingerprint (WebAuthn platform authenticator). PIN always stays as the fallback */
  var BK='study2do.bio',bioOK=false;
  function bioOn(){try{return !!localStorage.getItem(BK)}catch(e){return false}}
  function b64(buf){var x='';new Uint8Array(buf).forEach(function(c){x+=String.fromCharCode(c)});return btoa(x)}
  function unb64(x){var b=atob(x),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a.buffer}
  function rnd(n){var a=new Uint8Array(n);crypto.getRandomValues(a);return a}
  function paintBio(){
    var r=$('#biorow');if(!r)return;r.hidden=!lockOn();
    $('#biosw').classList.toggle('on',bioOn()&&lockOn());
    $('#biotxt').textContent=bioOn()?'On. Fingerprint or PIN':(bioOK?'Off':'Not available on this device or browser');
  }
  pBioAvailable().then(function(v){bioOK=!!v;paintBio()}).catch(function(){});
  function bioEnroll(){
    if(!bioOK){toast('Fingerprint is not available here');return}
    pBioEnroll().then(function(){paintBio();toast('Fingerprint unlock on')}).catch(function(){toast('Fingerprint was not set up')});
  }
  function bioAsk(){
    if(lm!=='unlock'||!bioOn()||!bioOK)return;
    pBioAsk().then(function(){if(lm==='unlock'){fails=0;closeLock()}}).catch(function(){lockText($('#lt').textContent,'Fingerprint not recognised. Use your PIN')});
  }
  function lockText(t,h){$('#lt').textContent=t;$('#lh').textContent=h}
  function openLock(mode){lm=mode;pin='';pend='';dots();
    lockText({unlock:'Enter PIN',set1:'Create a PIN',off:'Enter PIN'}[mode],{unlock:'Unlock Habit-Task',set1:'Choose 4 digits',off:'Enter your PIN to turn the lock off'}[mode]);
    $('#lcancel').hidden=(mode==='unlock');$('#lock').hidden=false;
    $('#bio').hidden=!(mode==='unlock'&&bioOn()&&bioOK);if(mode==='unlock')setTimeout(bioAsk,350)}
  function closeLock(){$('#bio').hidden=true;$('#lock').hidden=true;lm=null;pin='';pend='';dots()}
  function submitPin(){
    var p=pin;pin='';
    if(lm==='set1'){pend=p;lm='set2';lockText('Confirm PIN','Enter the same 4 digits again');dots();return}
    if(lm==='set2'){
      if(p!==pend){lm='set1';pend='';lockText('Create a PIN','PINs did not match. Try again');dots();return}
      var salt=String(Math.random()).slice(2)+Date.now();
      sha(salt,p).then(function(h){localStorage.setItem(PK,JSON.stringify({s:salt,h:h}));paintLock();closeLock();toast('App lock on')}).catch(function(){closeLock();toast('PIN lock needs a secure (https) app')});return;
    }
    var rec;try{rec=JSON.parse(localStorage.getItem(PK))}catch(e){}
    if(!rec){closeLock();return}
    if(Date.now()<until){lockText($('#lt').textContent,'Too many tries. Wait a moment');dots();return}
    sha(rec.s,p).then(function(h){
      if(h===rec.h){fails=0;if(lm==='off'){localStorage.removeItem(PK);localStorage.removeItem(BK);paintLock();toast('App lock off')}closeLock()}
      else{fails++;if(fails>=5){until=Date.now()+30000;fails=0}lockText($('#lt').textContent,'Wrong PIN');dots()}
    }).catch(function(){lockText($('#lt').textContent,'Could not check PIN');dots()});
  }
  $('#pad').innerHTML=[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(function(k){return k===''?'<span></span>':'<button data-k="'+k+'">'+k+'</button>'}).join('');
  $('#pad').addEventListener('click',function(e){
    var b=e.target.closest('[data-k]');if(!b||!lm)return;
    if(b.dataset.k==='⌫'){pin=pin.slice(0,-1)}else if(pin.length<4){pin+=b.dataset.k}
    dots();if(pin.length===4)setTimeout(submitPin,150);
  });
  $('#lockrow').addEventListener('click',function(){openLock(lockOn()?'off':'set1')});
  $('#biorow').addEventListener('click',function(){if(bioOn()){localStorage.removeItem(BK);paintBio();toast('Fingerprint unlock off')}else bioEnroll()});
  $('#bio').addEventListener('click',bioAsk);
  $('#lcancel').addEventListener('click',closeLock);
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){leftAt=Date.now();return}
    if(keyOf(new Date())!==todayKey){persist();location.reload();return}
    if(lockOn()&&leftAt&&Date.now()-leftAt>30000&&!lm)openLock('unlock');
  });
  paintCfg();paintLock();if(lockOn())openLock('unlock');
  tasks.forEach(remind);
  try{var sj=JSON.parse(localStorage.getItem(KEY)||'null'),th=sj&&sj.theme;
    if(th){document.documentElement.setAttribute('data-theme',th);$$('#theme button').forEach(function(x){x.classList.toggle('on',x.dataset.t===th)})}}catch(e){}
})();
