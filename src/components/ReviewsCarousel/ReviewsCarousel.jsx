import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchPublicReviews } from '../../api/reviews.js';
import './ReviewsCarousel.css';

const STAR_FULL = '★';
const STAR_EMPTY = '☆';

function Stars({ rating }) {
  return (
    <span className="reviews-card__stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rating ? 'reviews-card__star--filled' : 'reviews-card__star--empty'}>
          {i <= rating ? STAR_FULL : STAR_EMPTY}
        </span>
      ))}
    </span>
  );
}

function ReviewsCarousel() {
  const [reviews, setReviews] = useState([]);
  const [current, setCurrent] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const trackRef = useRef(null);
  const autoRef = useRef(null);

  useEffect(() => {
    fetchPublicReviews()
      .then(({ reviews }) => setReviews(reviews))
      .catch(() => {});
  }, []);

  const count = reviews.length;

  /* Autoplay */
  const resetAuto = useCallback(() => {
    clearInterval(autoRef.current);
    if (count > 1) {
      autoRef.current = setInterval(() => {
        setCurrent((prev) => (prev + 1) % count);
      }, 5000);
    }
  }, [count]);

  useEffect(() => {
    resetAuto();
    return () => clearInterval(autoRef.current);
  }, [resetAuto]);

  const goTo = (idx) => {
    setCurrent(idx);
    resetAuto();
  };

  const prev = () => goTo((current - 1 + count) % count);
  const next = () => goTo((current + 1) % count);

  /* Touch / drag */
  const onDragStart = (e) => {
    setDragging(true);
    setStartX(e.touches ? e.touches[0].clientX : e.clientX);
    setTranslateX(0);
  };

  const onDragMove = (e) => {
    if (!dragging) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    setTranslateX(x - startX);
  };

  const onDragEnd = () => {
    if (!dragging) return;
    setDragging(false);
    if (translateX > 60) prev();
    else if (translateX < -60) next();
    setTranslateX(0);
  };

  if (!count) return null;

  const review = reviews[current];

  return (
    <section className="reviews-section">
      <div className="reviews-section__inner">
        <h2 className="reviews-section__title">Отзывы наших клиентов</h2>

        <div
          className="reviews-carousel"
          onMouseDown={onDragStart}
          onMouseMove={onDragMove}
          onMouseUp={onDragEnd}
          onMouseLeave={onDragEnd}
          onTouchStart={onDragStart}
          onTouchMove={onDragMove}
          onTouchEnd={onDragEnd}
          ref={trackRef}
        >
          <div
            className={`reviews-card ${dragging ? 'reviews-card--dragging' : ''}`}
            style={{ transform: dragging ? `translateX(${translateX}px)` : undefined }}
          >
            {/* Header: avatar + name + stars */}
            <div className="reviews-card__header">
              <div className="reviews-card__avatar">
                {review.avatar_url ? (
                  <img src={review.avatar_url} alt={review.first_name} />
                ) : (
                  <span>{(review.first_name?.[0] || '?').toUpperCase()}</span>
                )}
              </div>
              <div className="reviews-card__info">
                <span className="reviews-card__name">
                  {review.first_name}{review.last_name ? ` ${review.last_name}` : ''}
                </span>
                <Stars rating={review.rating} />
              </div>
            </div>

            {/* Text */}
            <p className="reviews-card__text">{review.text}</p>

            {/* Photo */}
            {review.photo_url && (
              <div className="reviews-card__photo">
                <img src={review.photo_url} alt="Фото к отзыву" />
              </div>
            )}
          </div>

          {/* Arrows */}
          {count > 1 && (
            <>
              <button className="reviews-carousel__arrow reviews-carousel__arrow--prev" onClick={prev} aria-label="Предыдущий">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button className="reviews-carousel__arrow reviews-carousel__arrow--next" onClick={next} aria-label="Следующий">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </>
          )}
        </div>

        {/* Dots */}
        {count > 1 && (
          <div className="reviews-dots">
            {reviews.map((_, i) => (
              <button
                key={i}
                className={`reviews-dots__dot ${i === current ? 'reviews-dots__dot--active' : ''}`}
                onClick={() => goTo(i)}
                aria-label={`Отзыв ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default ReviewsCarousel;
