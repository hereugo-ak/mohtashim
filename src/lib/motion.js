export function initMotion({ modal, mobileCta }) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if ('IntersectionObserver' in window && !reduced) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -25px 0px' });
    document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
  } else {
    document.querySelectorAll('.reveal').forEach((element) => element.classList.add('in-view'));
  }

  function updateScrollProgress() {
    const root = document.documentElement;
    const range = root.scrollHeight - window.innerHeight;
    const progress = range > 0 ? Math.min(100, Math.max(0, window.scrollY / range * 100)) : 0;
    root.style.setProperty('--scroll-progress', `${progress.toFixed(2)}%`);
  }

  let queued = false;
  window.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => {
      updateScrollProgress();
      if (window.innerWidth <= 620 && mobileCta) {
        mobileCta.classList.toggle('hidden', window.scrollY < 250 || modal.classList.contains('open'));
      }
      queued = false;
    });
  }, { passive: true });
  window.addEventListener('resize', updateScrollProgress, { passive: true });
  updateScrollProgress();
}
