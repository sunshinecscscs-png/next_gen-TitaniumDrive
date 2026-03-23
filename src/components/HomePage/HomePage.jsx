import Header from '../Header/Header';
import Hero from '../Hero/Hero';
import SearchSection from '../SearchSection/SearchSection';
import HowToBuy from '../HowToBuy/HowToBuy';
import RecommendedCars from '../RecommendedCars/RecommendedCars';
import ReviewsCarousel from '../ReviewsCarousel/ReviewsCarousel';
import CatalogFilter from '../CatalogFilter/CatalogFilter';
import AboutUs from '../AboutUs/AboutUs';
import DealershipBanner from '../DealershipBanner/DealershipBanner';
import Footer from '../Footer/Footer';
import { Reveal } from '../../hooks/useReveal';

function HomePage({ onAuthOpen }) {
  return (
    <>
      <Header onAuthOpen={onAuthOpen} />
      <Hero />
      <Reveal>
        <SearchSection />
      </Reveal>
      <Reveal>
        <HowToBuy />
      </Reveal>
      <Reveal>
        <RecommendedCars onAuthOpen={onAuthOpen} />
      </Reveal>
      <Reveal>
        <ReviewsCarousel />
      </Reveal>
      <Reveal>
        <CatalogFilter />
      </Reveal>
      <Reveal>
        <AboutUs />
      </Reveal>
      <Reveal>
        <DealershipBanner />
      </Reveal>
      <Footer />
    </>
  );
}

export default HomePage;
