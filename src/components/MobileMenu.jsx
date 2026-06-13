import { useState, useRef, useEffect } from 'react';

export default function MobileMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="mobile-menu-wrap" ref={ref}>
      <button className="btn-secondary mobile-more-btn" onClick={() => setOpen(v => !v)}>⋯</button>
      {open && (
        <div className="mobile-menu-dropdown">
          {items.map((item, i) =>
            item === 'divider'
              ? <div key={i} className="mobile-menu-divider" />
              : <button key={i} className="mobile-menu-item" onClick={() => { item.onClick(); setOpen(false); }}>
                  {item.icon && <span>{item.icon}</span>}
                  {item.label}
                </button>
          )}
        </div>
      )}
    </div>
  );
}
