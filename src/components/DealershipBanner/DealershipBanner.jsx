import './DealershipBanner.css';

function DealershipBanner() {
  return (
    <section className="dealership-banner">
      <div className="dealership-banner__overlay" />
      <img
        src="/pexels-introspectivedsgn-4062484.jpg"
        alt="Дилерский центр"
        className="dealership-banner__img"
      />
    </section>
  );
}

export default DealershipBanner;
