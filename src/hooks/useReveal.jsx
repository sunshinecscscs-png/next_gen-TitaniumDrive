import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook that triggers a CSS class when the element enters the viewport.
 * Returns [ref, isVisible].
 */
export function useReveal(options = {}) {
  const { threshold = 0.15, once = true } = options;
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  const handleIntersect = useCallback(
    ([entry], observer) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        if (once) observer.unobserve(entry.target);
      }
    },
    [once]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleIntersect, { threshold });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersect, threshold]);

  return [ref, isVisible];
}

/**
 * Utility component that wraps children in a reveal animation.
 */
export function Reveal({ children, delay = 0, className = '', tag = 'div', ...rest }) {
  const [ref, isVisible] = useReveal();
  const Tag = tag;
  const delayClass = delay ? `reveal--delay-${delay}` : '';

  return (
    <Tag
      ref={ref}
      className={`reveal ${isVisible ? 'reveal--visible' : ''} ${delayClass} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
