(function(){
  "use strict";

  var CONFIG = {
    contact: {
      email: "derenmakannasi@gmail.com",
      whatsappNumber: "6285119268943",
      whatsappMessage: "Halo Akbar, saya ingin diskusi project.",
      tiktokUsername: "drnalvrprtm",
      github: "https://github.com/drnalvrprtma",
      instagram: "https://instagram.com/drnalvrprtm"
    },
    journey: [
      { year: "2024", tag: "Kelas 8 SMP", title: "Mulai Belajar Coding", desc: "Mengenal HTML dan CSS secara otodidak lewat video tutorial, membuat halaman web Hello World pertama." },
      { year: "2025", tag: "Kelas 9 SMP", title: "Mendalami JavaScript", desc: "Belajar logika pemrograman dasar dan membuat project sederhana seperti kalkulator." },
      { year: "2026", tag: "Kelas 10 SMK", title: "Masuk SMKN 1 Kraksaan", desc: "Mengambil jurusan yang relevan dengan pengembangan perangkat lunak." },
    ]
  };

  var root = document.documentElement;
  root.setAttribute('data-theme', 'dark');

  var topnav = document.getElementById('topnav');
  if(topnav){
    var lastScrollY = window.scrollY || window.pageYOffset || 0;
    var navTicking = false;
    var scrollDelta = 0;
    function updateNavVisibility(){
      var currentY = window.scrollY || window.pageYOffset || 0;
      if(document.getElementById('mobile-menu').classList.contains('open')){ navTicking = false; return; }
      var diff = currentY - lastScrollY;
      if(currentY < 80){
        topnav.classList.remove('nav-hidden');
        scrollDelta = 0;
      } else if(diff > 0){
        scrollDelta = scrollDelta > 0 ? scrollDelta + diff : diff;
        if(scrollDelta > 24){ topnav.classList.add('nav-hidden'); }
      } else if(diff < 0){
        scrollDelta = scrollDelta < 0 ? scrollDelta + diff : diff;
        if(scrollDelta < -12){ topnav.classList.remove('nav-hidden'); }
      }
      lastScrollY = currentY;
      navTicking = false;
    }
    window.addEventListener('scroll', function(){
      if(!navTicking){
        window.requestAnimationFrame(updateNavVisibility);
        navTicking = true;
      }
    });
  }

  var burger = document.getElementById('nav-burger');
  var mobileMenu = document.getElementById('mobile-menu');
  burger.addEventListener('click', function(){
    burger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
  });
  var mLinks = mobileMenu.querySelectorAll('a');
  for(var mi=0; mi<mLinks.length; mi++){
    mLinks[mi].addEventListener('click', function(){
      burger.classList.remove('open');
      mobileMenu.classList.remove('open');
    });
  }

  var navLinks = document.querySelectorAll('.nav-links a');
  for(var ni=0; ni<navLinks.length; ni++){
    navLinks[ni].addEventListener('click', function(){
      var el = this;
      el.classList.remove('pulse');
      void el.offsetWidth;
      el.classList.add('pulse');
      setTimeout(function(){ el.classList.remove('pulse'); }, 550);
    });
  }
  var navSections = [];
  for(var nsi=0; nsi<navLinks.length; nsi++){
    var href = navLinks[nsi].getAttribute('href') || '';
    if(href.charAt(0) === '#'){
      var target = document.getElementById(href.slice(1));
      if(target){ navSections.push({ el: target, link: navLinks[nsi] }); }
    }
  }
  if(navSections.length > 0 && 'IntersectionObserver' in window){
    var spyObserver = new IntersectionObserver(function(entries){
      for(var ei=0; ei<entries.length; ei++){
        if(!entries[ei].isIntersecting) continue;
        for(var nsj=0; nsj<navSections.length; nsj++){
          navSections[nsj].link.classList.remove('active');
        }
        for(var nsk=0; nsk<navSections.length; nsk++){
          if(navSections[nsk].el === entries[ei].target){
            navSections[nsk].link.classList.add('active');
            break;
          }
        }
      }
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    for(var nsl=0; nsl<navSections.length; nsl++){ spyObserver.observe(navSections[nsl].el); }
  }

  var typerEl = document.getElementById('hero-typer');
  var typerLines = [
    { prompt: 'fitrah@smkn1kraksaan', path: '~$ whoami', done: false },
    { prompt: '', path: '&gt; FullStack Developer', done: false }
  ];
  function typeLines(){
    var lineIndex = 0;
    function renderStatic(){
      var html = '';
      for(var i=0;i<lineIndex;i++){
        var l = typerLines[i];
        html += '<div class="line">' + (l.prompt ? '<span class="prompt">' + l.prompt + '</span> ' : '') + '<span class="path">' + l.path.replace('&gt;','>') + '</span></div>';
      }
      return html;
    }
    function typeOne(){
      if(lineIndex >= typerLines.length){
        typerEl.innerHTML = renderStatic() + '<span class="cursor"></span>';
        return;
      }
      var l = typerLines[lineIndex];
      var full = l.path.replace('&gt;','>');
      var i = 0;
      var timer = setInterval(function(){
        i++;
        var partial = full.slice(0, i);
        typerEl.innerHTML = renderStatic() + '<div class="line">' + (l.prompt ? '<span class="prompt">' + l.prompt + '</span> ' : '') + '<span class="path">' + partial + '</span><span class="cursor"></span></div>';
        if(i >= full.length){
          clearInterval(timer);
          lineIndex++;
          setTimeout(typeOne, 260);
        }
      }, 32);
    }
    typeOne();
  }
  typeLines();

  var revealTargets = document.querySelectorAll('[data-reveal]');
  (function staggerReveal(){
    var counters = [];
    var parents = [];
    for(var si=0; si<revealTargets.length; si++){
      var parentEl = revealTargets[si].parentElement;
      var idx = parents.indexOf(parentEl);
      if(idx === -1){ parents.push(parentEl); counters.push(0); idx = parents.length - 1; }
      var order = counters[idx];
      counters[idx] = order + 1;
      revealTargets[si].style.transitionDelay = Math.min(order, 5) * 90 + 'ms';
    }
  })();
  if('IntersectionObserver' in window){
    var revealObserver = new IntersectionObserver(function(entries){
      for(var i=0;i<entries.length;i++){
        if(entries[i].isIntersecting){
          entries[i].target.classList.add('in');
          revealObserver.unobserve(entries[i].target);
        }
      }
    }, { threshold: 0.18 });
    for(var ri=0; ri<revealTargets.length; ri++){ revealObserver.observe(revealTargets[ri]); }
  } else {
    for(var rj=0; rj<revealTargets.length; rj++){ revealTargets[rj].classList.add('in'); }
  }

  var heroFigureWrap = document.getElementById('hero-figure-wrap');
  var heroSection = document.getElementById('hero');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(heroFigureWrap && heroSection && !reduceMotion && window.innerWidth > 900){
    var ticking = false;
    function updateParallax(){
      var rect = heroSection.getBoundingClientRect();
      var scrolledPast = Math.max(0, -rect.top);
      var offset = scrolledPast * 0.22;
      heroFigureWrap.style.transform = 'translateY(' + offset + 'px)';
      ticking = false;
    }
    window.addEventListener('scroll', function(){
      if(!ticking){
        window.requestAnimationFrame(updateParallax);
        ticking = true;
      }
    });
  }

  var skillRows = document.querySelectorAll('.skill-row');
  if('IntersectionObserver' in window){
    var skillObserver = new IntersectionObserver(function(entries){
      for(var i=0;i<entries.length;i++){
        if(entries[i].isIntersecting){
          entries[i].target.classList.add('in');
          skillObserver.unobserve(entries[i].target);
        }
      }
    }, { threshold: 0.5 });
    for(var si=0; si<skillRows.length; si++){ skillObserver.observe(skillRows[si]); }
  }

  function escapeHtml(str){
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  var timelineList = document.getElementById('timeline-list');
  var tlHtml = '';
  for(var t=0; t<CONFIG.journey.length; t++){
    var j = CONFIG.journey[t];
    tlHtml += '<div class="tl-item" data-reveal>' +
      '<div class="tl-year">' + escapeHtml(j.year) + '</div>' +
      '<div class="tl-body"><h4>' + escapeHtml(j.title) + '</h4><p>' + escapeHtml(j.desc) + '</p><span class="tl-tag">' + escapeHtml(j.tag) + '</span></div>' +
    '</div>';
  }
  timelineList.innerHTML = tlHtml;
  var tlItems = timelineList.querySelectorAll('[data-reveal]');
  if('IntersectionObserver' in window){
    var tlObserver = new IntersectionObserver(function(entries){
      for(var i=0;i<entries.length;i++){
        if(entries[i].isIntersecting){ entries[i].target.classList.add('in'); tlObserver.unobserve(entries[i].target); }
      }
    }, { threshold: 0.15 });
    for(var tk=0; tk<tlItems.length; tk++){ tlObserver.observe(tlItems[tk]); }
  } else {
    for(var tl2=0; tl2<tlItems.length; tl2++){ tlItems[tl2].classList.add('in'); }
  }

  function observeNew(nodeList){
    if(!('IntersectionObserver' in window)){
      for(var i=0;i<nodeList.length;i++){ nodeList[i].classList.add('in'); }
      return;
    }
    var obs = new IntersectionObserver(function(entries){
      for(var j=0;j<entries.length;j++){
        if(entries[j].isIntersecting){ entries[j].target.classList.add('in'); obs.unobserve(entries[j].target); }
      }
    }, { threshold: 0.15 });
    for(var k=0;k<nodeList.length;k++){ obs.observe(nodeList[k]); }
  }

  function renderProjectCard(p, index){
    var thumbInner = p.image_url
      ? '<img src="' + escapeHtml(p.image_url) + '" alt="' + escapeHtml(p.title) + '">'
      : '<div class="ph">no preview</div>';
    var techHtml = '';
    if(Array.isArray(p.tech)){
      for(var i=0;i<p.tech.length;i++){ techHtml += '<span>' + escapeHtml(p.tech[i]) + '</span>'; }
    }
    var previewBtn = p.preview_url ? '<a href="' + escapeHtml(p.preview_url) + '" target="_blank" rel="noopener" class="project-link primary">Preview</a>' : '';
    var sourceBtn = p.source_url ? '<a href="' + escapeHtml(p.source_url) + '" target="_blank" rel="noopener" class="project-link secondary">Source</a>' : '';
    var delay = Math.min(index, 6) * 70;
    return '<div class="project-card" data-reveal style="transition-delay:' + delay + 'ms;">' +
      '<div class="project-thumb">' + thumbInner + (p.year ? '<span class="project-year">' + escapeHtml(p.year) + '</span>' : '') + '</div>' +
      '<div class="project-body">' +
        '<div class="project-title">' + escapeHtml(p.title) + '</div>' +
        '<div class="project-desc">' + escapeHtml(p.description) + '</div>' +
        '<div class="project-tech">' + techHtml + '</div>' +
        '<div class="project-actions">' + previewBtn + sourceBtn + '</div>' +
      '</div>' +
    '</div>';
  }

  function renderCertCard(c, index){
    var thumbInner = c.image_url
      ? '<img src="' + escapeHtml(c.image_url) + '" alt="' + escapeHtml(c.title) + '">'
      : '';
    var link = c.credential_url ? '<a href="' + escapeHtml(c.credential_url) + '" target="_blank" rel="noopener" class="cert-link">Lihat Sertifikat</a>' : '';
    var delay = Math.min(index, 6) * 70;
    return '<div class="cert-card" data-reveal style="transition-delay:' + delay + 'ms;">' +
      '<div class="cert-thumb">' + thumbInner + '</div>' +
      '<div class="cert-body">' +
        '<div class="cert-title">' + escapeHtml(c.title) + '</div>' +
        '<div class="cert-meta">' + escapeHtml(c.issuer) + (c.year ? ' &middot; ' + escapeHtml(c.year) : '') + '</div>' +
        link +
      '</div>' +
    '</div>';
  }

  var supaClient = null;
  function getSupa(){
    if(!supaClient && window.supabase){
      supaClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    }
    return supaClient;
  }

  function loadProjects(){
    var grid = document.getElementById('projects-grid');
    var client = getSupa();
    if(!grid || !client) return;
    client.from('projects').select('*').order('sort_order', { ascending: true })
      .then(function(res){
        if(res.error){ grid.innerHTML = '<div class="state-msg">Gagal memuat project.</div>'; return; }
        var rows = res.data || [];
        if(rows.length === 0){ grid.innerHTML = '<div class="state-msg">Belum ada project untuk ditampilkan.</div>'; return; }
        var html = '';
        for(var i=0;i<rows.length;i++){ html += renderProjectCard(rows[i], i); }
        grid.innerHTML = html;
        observeNew(grid.querySelectorAll('[data-reveal]'));
      })
      .catch(function(){ grid.innerHTML = '<div class="state-msg">Gagal memuat project.</div>'; });
  }

  function loadCertificates(){
    var grid = document.getElementById('certificates-grid');
    var client = getSupa();
    if(!grid || !client) return;
    client.from('certificates').select('*').order('sort_order', { ascending: true })
      .then(function(res){
        if(res.error){ grid.innerHTML = '<div class="state-msg">Belum ada sertifikat, atau tabel certificates belum dibuat.</div>'; return; }
        var rows = res.data || [];
        if(rows.length === 0){ grid.innerHTML = '<div class="state-msg">Belum ada sertifikat untuk ditampilkan.</div>'; return; }
        var html = '';
        for(var i=0;i<rows.length;i++){ html += renderCertCard(rows[i], i); }
        grid.innerHTML = html;
        observeNew(grid.querySelectorAll('[data-reveal]'));
      })
      .catch(function(){ grid.innerHTML = '<div class="state-msg">Gagal memuat sertifikat.</div>'; });
  }

  loadProjects();
  loadCertificates();

  var audio = document.getElementById('audio-el');
  var btnPlay = document.getElementById('btn-play');
  var iconPlay = document.getElementById('icon-play');
  var iconPause = document.getElementById('icon-pause');
  var seek = document.getElementById('seek');
  var timeCur = document.getElementById('time-cur');
  var timeDur = document.getElementById('time-dur');
  var playerTitle = document.getElementById('player-title');
  var playerArtist = document.getElementById('player-artist');
  var playerArt = document.getElementById('player-art-img');
  var playlistList = document.getElementById('playlist-list');
  var playlistCoverImg = document.getElementById('playlist-cover-img');
  var playlistSub = document.getElementById('playlist-sub');
  var playlistTracks = [];
  var currentTrack = 0;

  function formatTime(sec){
    if(!isFinite(sec) || sec < 0) sec = 0;
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function renderPlaylist(){
    if(playlistTracks.length === 0){
      playlistList.innerHTML = '<div class="state-msg">Belum ada lagu di playlist.</div>';
      return;
    }
    var html = '';
    for(var i=0;i<playlistTracks.length;i++){
      var tr = playlistTracks[i];
      html += '<div class="plist-item' + (i === currentTrack ? ' active' : '') + '" data-index="' + i + '">' +
        '<span class="plist-num">' + (i + 1) + '</span>' +
        '<div class="plist-info"><div class="plist-title">' + escapeHtml(tr.title) + '</div><div class="plist-artist">' + escapeHtml(tr.artist) + '</div></div>' +
        '<span class="plist-dur">' + escapeHtml(tr.duration || '--:--') + '</span>' +
      '</div>';
    }
    playlistList.innerHTML = html;
    var items = playlistList.querySelectorAll('.plist-item');
    for(var j=0;j<items.length;j++){
      items[j].addEventListener('click', function(){
        loadTrack(parseInt(this.getAttribute('data-index'), 10));
        playAudio();
      });
    }
  }

  function loadTrack(index){
    if(playlistTracks.length === 0) return;
    currentTrack = (index + playlistTracks.length) % playlistTracks.length;
    var tr = playlistTracks[currentTrack];
    playerTitle.textContent = tr.title;
    playerArtist.textContent = tr.artist;
    playerArt.src = tr.cover_url || '';
    audio.src = tr.audio_url || '';
    seek.value = 0;
    timeCur.textContent = '0:00';
    timeDur.textContent = tr.duration || '0:00';
    renderPlaylist();
  }

  function playAudio(){
    if(!audio.src){ return; }
    audio.play();
    iconPlay.style.display = 'none';
    iconPause.style.display = '';
  }
  function pauseAudio(){
    audio.pause();
    iconPlay.style.display = '';
    iconPause.style.display = 'none';
  }

  btnPlay.addEventListener('click', function(){
    if(audio.paused){ playAudio(); } else { pauseAudio(); }
  });
  document.getElementById('btn-next').addEventListener('click', function(){ loadTrack(currentTrack + 1); playAudio(); });
  document.getElementById('btn-prev').addEventListener('click', function(){ loadTrack(currentTrack - 1); playAudio(); });

  audio.addEventListener('timeupdate', function(){
    if(!audio.duration) return;
    seek.value = (audio.currentTime / audio.duration) * 100;
    timeCur.textContent = formatTime(audio.currentTime);
  });
  audio.addEventListener('loadedmetadata', function(){
    timeDur.textContent = formatTime(audio.duration);
  });
  audio.addEventListener('ended', function(){ loadTrack(currentTrack + 1); playAudio(); });
  seek.addEventListener('input', function(){
    if(!audio.duration) return;
    audio.currentTime = (seek.value / 100) * audio.duration;
  });

  function loadTracks(){
    var client = getSupa();
    if(!client) return;
    client.from('tracks').select('*').order('sort_order', { ascending: true })
      .then(function(res){
        playlistTracks = res.error ? [] : (res.data || []);
        if(playlistTracks.length > 0){
          playlistCoverImg.src = playlistTracks[0].cover_url || '';
          playlistSub.textContent = playlistTracks.length + ' lagu pilihan saya';
          loadTrack(0);
        } else {
          playlistSub.textContent = 'Belum ada lagu ditambahkan';
          renderPlaylist();
        }
      })
      .catch(function(){ renderPlaylist(); });
  }
  loadTracks();

  var contactGrid = document.getElementById('contact-grid');
  var waLink = 'https://wa.me/' + CONFIG.contact.whatsappNumber + '?text=' + encodeURIComponent(CONFIG.contact.whatsappMessage);
  var ttLink = 'https://www.tiktok.com/@' + CONFIG.contact.tiktokUsername;
  var contacts = [
    { key: 'Email', val: CONFIG.contact.email, href: 'mailto:' + CONFIG.contact.email, icon: '<path d="M4 4h16v16H4z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 6l8 7 8-7" fill="none" stroke="currentColor" stroke-width="1.6"/>' },
    { key: 'WhatsApp', val: '+' + CONFIG.contact.whatsappNumber, href: waLink, icon: '<path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 10a.5.5 0 0 0 1 0v-1a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' },
    { key: 'TikTok', val: '@' + CONFIG.contact.tiktokUsername, href: ttLink, icon: '<path d="M15 4v9.2a3.4 3.4 0 1 1-2.6-3.3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M15 4c.4 2.2 2 3.6 4 3.8" fill="none" stroke="currentColor" stroke-width="1.6"/>' },
    { key: 'GitHub', val: 'Lihat repository', href: CONFIG.contact.github, icon: '<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0c-2.4-1.6-3.5-1.3-3.5-1.3a4.2 4.2 0 0 0-.1 3.2 4.6 4.6 0 0 0-1.3 3.2c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2v3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' },
    { key: 'Instagram', val: '@drnalvrprtm', href: CONFIG.contact.instagram, icon: '<rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" stroke-width="1.6"/>' }
  ];
  var cHtml = '';
  for(var ci=0; ci<contacts.length; ci++){
    var c = contacts[ci];
    cHtml += '<a class="contact-card" data-reveal href="' + c.href + '" target="_blank" rel="noopener">' +
      '<span class="contact-icon"><svg class="icon" viewBox="0 0 24 24">' + c.icon + '</svg></span>' +
      '<span class="contact-text"><span class="contact-k">' + c.key + '</span><span class="contact-v">' + escapeHtml(c.val) + '</span></span>' +
    '</a>';
  }
  contactGrid.innerHTML = cHtml;
  observeNew(contactGrid.querySelectorAll('[data-reveal]'));

  document.getElementById('foot-year').textContent = '' + new Date().getFullYear() + ' Fitrah Akbar Maulana';

})();