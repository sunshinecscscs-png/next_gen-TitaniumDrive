import { useNavigate } from 'react-router-dom';
import './Footer.css';

function Footer() {
  const navigate = useNavigate();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__col footer__col--brand">
          <div className="footer__logo">TitaniumDrive</div>
          <div className="footer__socials">
            <a href="https://t.me/TitaniumDrive" target="_blank" rel="noopener noreferrer" className="footer__social" aria-label="Telegram">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            </a>
            <a href="https://vk.com/dealerrugroup" target="_blank" rel="noopener noreferrer" className="footer__social" aria-label="VK">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M21.547 7h-3.29a.743.743 0 00-.655.392s-1.312 2.416-1.734 3.23C14.734 12.813 14 12.126 14 11.11V7.603A1.104 1.104 0 0012.896 6.5h-2.474a1.982 1.982 0 00-1.75.813s1.255-.204 1.255 1.49c0 .42.022 1.626.04 2.64a.73.73 0 01-1.272.503 21.54 21.54 0 01-2.498-4.543.693.693 0 00-.63-.403H2.66a.742.742 0 00-.677 1.03c1.827 4.203 5.395 8.97 10.036 8.97h1.234a.742.742 0 00.742-.742v-1.135a.743.743 0 01.677-.742c.344-.029.663.18.803.49.577 1.284 1.084 2.13 1.084 2.13a.742.742 0 00.642.37h3.2a.743.743 0 00.666-1.073s-1.166-2.052-1.77-3.177a.741.741 0 01.078-.832C20.903 11.385 22.96 8.67 22.96 8.67A.745.745 0 0021.547 7z"/></svg>
            </a>
          </div>
          <p className="footer__copy">2026 · Все права защищены</p>
        </div>

        <div className="footer__col">
          <h4 className="footer__heading">TitaniumDrive</h4>
          <a href="/catalog" className="footer__link" onClick={(e) => { e.preventDefault(); navigate('/catalog'); }}>Каталог авто</a>
          <a href="/search" className="footer__link" onClick={(e) => { e.preventDefault(); navigate('/search'); }}>Поиск</a>
        </div>

        <div className="footer__col">
          <h4 className="footer__heading">О компании</h4>
          <a href="/contact" className="footer__link" onClick={(e) => { e.preventDefault(); navigate('/contact'); }}>Связаться с нами</a>
          <a href="/about" className="footer__link" onClick={(e) => { e.preventDefault(); navigate('/about'); }}>О нас</a>
        </div>

        <div className="footer__col">
          <h4 className="footer__heading">Контакты</h4>
          <a href="tel:+79820780996" className="footer__link">+7 (982) 078-09-96</a>
          <a href="mailto:contact.finteh.avto@gmail.com" className="footer__link">contact.finteh.avto@gmail.com</a>
          <p className="footer__address">214032, Смоленская область, г Смоленск, ул Лавочкина, д. 106, помещ. 7</p>
        </div>

        <button className="footer__scroll-top" onClick={scrollToTop} aria-label="Наверх">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>
      </div>

    </footer>
  );
}

export default Footer;
