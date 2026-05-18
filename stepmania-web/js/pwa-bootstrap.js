// PWA bootstrap — registra el service worker y expone helpers para el resto
// del código de la suite. Cargado desde el <head> de cada HTML; idempotente.
//
// Responsabilidades:
//  1. Registrar /sw.js con scope global.
//  2. Detectar si la página corre dentro del shell SPA (iframe) y exponerlo.
//  3. Capturar 'beforeinstallprompt' para que el shell pueda mostrar un
//     botón "Instalar app" cuando proceda.
(function () {
  'use strict';

  // ---- Service worker registration -----------------------------------------
  // Solo en https/localhost — file:// y http://… (excepto loopback) no soportan SW.
  var supportsSW = ('serviceWorker' in navigator)
    && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');

  // Guardamos la registration para que applyUpdate() pueda mandar SKIP_WAITING
  // al SW en estado "waiting" cuando el usuario pulse el botón del toast.
  var swRegistration = null;

  if (supportsSW) {
    window.addEventListener('load', function () {
      // Path relativo al document base (cada HTML está en raíz, así que
      // resuelve a /sw.js cuando se sirve desde host). En file:// el SW no se
      // registra (filtrado por supportsSW arriba) — el bootstrap solo es útil
      // ahí para la detección de in-shell y el patch de Routes relativas.
      navigator.serviceWorker.register('sw.js')
        .then(function (reg) {
          swRegistration = reg;

          // Caso 1: ya había un SW en "waiting" antes de que se cargara la
          // página (update detectado en una sesión anterior pero el usuario
          // nunca pulsó Actualizar). Disparamos el evento para que aparezca
          // el toast también en esta sesión.
          if (reg.waiting && navigator.serviceWorker.controller) {
            document.dispatchEvent(new CustomEvent('sincro-pwa-update-available'));
          }

          // Caso 2: nueva versión detectada durante esta sesión.
          reg.addEventListener('updatefound', function () {
            var nw = reg.installing;
            if (!nw) return;
            nw.addEventListener('statechange', function () {
              if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                document.dispatchEvent(new CustomEvent('sincro-pwa-update-available'));
              }
            });
          });
        })
        .catch(function (err) {
          console.warn('[PWA] Registro de service worker falló:', err);
        });
    });
  }

  // ---- Embedded shell detection --------------------------------------------
  // El shell SPA (app.html, fase 2) marca window.name = 'sincro-shell-frame'
  // antes de navegar el iframe. Las páginas internas pueden añadir CSS sobre
  // <html class="in-shell"> para ocultar su propio topbar/header — el shell
  // ya provee chrome unificado.
  var inShell = false;
  try {
    inShell = (window.parent !== window) && /^sincro-shell/.test(window.name || '');
  } catch (e) {
    // Cross-origin throw — no aplica aquí porque todo es same-origin, pero
    // por si alguien embebe la app desde otro dominio (no soportado).
    inShell = false;
  }
  if (inShell) {
    document.documentElement.classList.add('in-shell');
    // Inyecta CSS para ocultar los topbars internos cuando la página corre
    // dentro del shell SPA (app.html) — el shell ya provee chrome unificado
    // y no queremos doble navegación. Selectores cubren los IDs/clases
    // existentes en cada HTML de la suite (#topbar en play.html,
    // #sat-topbar en gh-play/autostepper/gh-autostepper/test-pad,
    // header.topbar en index.html).
    var injectShellCSS = function () {
      if (document.getElementById('sincro-in-shell-css')) return;
      var s = document.createElement('style');
      s.id = 'sincro-in-shell-css';
      s.textContent =
        'html.in-shell #topbar,' +
        'html.in-shell #sat-topbar,' +
        'html.in-shell header.topbar,' +
        'html.in-shell .topbar:not(.shell-topbar) {' +
          'display:none !important;' +
        '}' +
        'html.in-shell body {' +
          'padding-top:0 !important;' +
          'margin-top:0 !important;' +
        '}' +
        // .screen del motor SM/GH usa `position:fixed; top:50px` para dejar
        // hueco al #topbar interno. Cuando el topbar se oculta dentro del
        // shell, esos 50px quedan como franja muerta arriba — el shell ya
        // provee su propio header. Subimos .screen al borde del iframe.
        'html.in-shell .screen {' +
          'top:0 !important;' +
        '}';
      (document.head || document.documentElement).appendChild(s);
    };
    if (document.head) injectShellCSS();
    else document.addEventListener('DOMContentLoaded', injectShellCSS);
  }

  // ---- Install prompt capture ----------------------------------------------
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    document.dispatchEvent(new CustomEvent('sincro-pwa-installable'));
  });
  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    document.dispatchEvent(new CustomEvent('sincro-pwa-installed'));
  });

  // ---- Update flow (toast + apply) -----------------------------------------
  // Filosofía: NUNCA actualizar el SW en segundo plano sin avisar — daba la
  // sensación de "refresh fantasma" durante partidas (favicon parpadeaba y
  // el precache se re-fetcheaba, ver bug reportado 2026-05-18). En su lugar,
  // mostramos un toast persistente bottom-right cuando hay versión nueva.
  // El usuario decide cuándo aplicarla (típicamente entre partidas) pulsando
  // "Actualizar ahora", y eso dispara: postMessage SKIP_WAITING al SW en
  // waiting → controllerchange → location.reload() limpio.
  //
  // El toast NO se cierra hasta que el usuario actualice — adrede. Si lo
  // descartara se quedaría con versión antigua sin notarlo.

  // Solo el contexto top-level escucha controllerchange y recarga. Si la
  // página corre dentro del shell SPA (iframe), dejamos que el shell padre
  // sea quien dispare el reload — al recargar el padre, el iframe se recarga
  // solo, evitando parpadeo doble.
  var reloadingForUpdate = false;
  if (supportsSW && !inShell) {
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloadingForUpdate) return;
      reloadingForUpdate = true;
      location.reload();
    });
  }

  function applyUpdate() {
    if (!swRegistration) return;
    var btn = document.getElementById('sincro-update-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Actualizando…'; }
    if (swRegistration.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // No hay SW en waiting (raro: el evento se disparó pero ya no está).
      // Forzamos un reload por si acaso.
      reloadingForUpdate = true;
      location.reload();
    }
  }

  function showUpdateToast() {
    // En contexto shell SPA el padre app.html ya muestra su propio toast.
    // Suprimir aquí evita que aparezca uno por iframe + otro por shell.
    if (inShell) return;
    if (document.getElementById('sincro-update-toast')) return;

    var toast = document.createElement('div');
    toast.id = 'sincro-update-toast';
    toast.setAttribute('role', 'alertdialog');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-label', 'Nueva versión disponible');
    toast.style.cssText = [
      'position:fixed',
      'bottom:16px',
      'right:16px',
      'z-index:2147483647',
      'background:rgba(20,24,32,0.97)',
      'color:#fff',
      'border:1px solid #00bec8',
      'border-radius:12px',
      'padding:14px 16px',
      'box-shadow:0 8px 32px rgba(0,0,0,0.5)',
      'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
      'font-size:14px',
      'max-width:300px',
      'display:flex',
      'flex-direction:column',
      'gap:10px',
      'animation:sincroToastIn .25s ease-out'
    ].join(';');
    toast.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;font-weight:600;">' +
        '<span style="font-size:18px;">✨</span>' +
        '<span>Nueva versión disponible</span>' +
      '</div>' +
      '<div style="font-size:12.5px;opacity:0.82;line-height:1.4;">' +
        'Pulsa cuando termines tu partida.' +
      '</div>' +
      '<button id="sincro-update-btn" type="button" ' +
        'style="background:#00bec8;color:#001012;border:0;border-radius:8px;' +
        'padding:9px 14px;font-weight:700;cursor:pointer;font-size:14px;' +
        'font-family:inherit;">Actualizar ahora</button>';

    var append = function () {
      if (!document.getElementById('sincro-toast-keyframes')) {
        var st = document.createElement('style');
        st.id = 'sincro-toast-keyframes';
        st.textContent = '@keyframes sincroToastIn{from{transform:translateY(20px);opacity:0}to{transform:none;opacity:1}}';
        document.head.appendChild(st);
      }
      document.body.appendChild(toast);
      document.getElementById('sincro-update-btn').addEventListener('click', applyUpdate);
    };
    if (document.body) append();
    else document.addEventListener('DOMContentLoaded', append);
  }

  document.addEventListener('sincro-pwa-update-available', showUpdateToast);

  // ---- Public API ----------------------------------------------------------
  window.SincroPWA = {
    inShell: inShell,
    isInstalled: function () {
      return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    },
    canInstall: function () { return !!deferredPrompt; },
    promptInstall: function () {
      if (!deferredPrompt) return Promise.resolve({ outcome: 'unavailable' });
      var p = deferredPrompt;
      deferredPrompt = null;
      p.prompt();
      return p.userChoice;
    },
    applyUpdate: applyUpdate
  };
})();
