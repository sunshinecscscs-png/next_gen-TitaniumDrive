import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './CatalogFilter.css';

/* Статические иконки кузовов */
const bodyIconMap = {
  'Кроссовер': '/cusov_type/2d8188d6-573c-4727-8091-aebe365bda87.webp',
  'Хэтчбек':  '/cusov_type/21f3b3b5-c518-4c19-ac6f-59b175590800.webp',
  'Седан':     '/cusov_type/93c13730-3944-4465-9005-4b9d3fa68ede.webp',
  'Лифтбек':  '/cusov_type/f9198d57-9e34-4f0a-80f9-56f81820e220.webp',
  'Минивэн':  '/cusov_type/cd421c73-912a-4232-9280-7218a57cab5e.webp',
  'Фургон':   '/cusov_type/ca2935f4-a2a4-4402-ab65-ddb1b5ecb9a3.webp',
  'Универсал': '/cusov_type/dda538d4-2c0c-43fe-9ed0-3aba38feb3d7.webp',
  'Пикап':    '/cusov_type/53dc6609-74b0-4cc0-a46d-2db13a873497.webp',
};

/* Статические логотипы марок */
const brandLogoMap = {
  'Skoda':         '/cars_logo/1f0bed7d-9d06-4ff0-af32-6c0fe5dd5187.webp',
  'Suzuki':        '/cars_logo/f6a58eb7-6610-4b12-af4e-04756157d1e3.png',
  'Renault':       '/cars_logo/bd9ed8da-0d7a-48ae-b0bc-c8690467cb79.webp',
  'Cupra':         '/cars_logo/dfe684b5-e977-43df-8441-4bea357bdfd2.webp',
  'Hyundai':       '/cars_logo/1bae7033-4a9f-44f5-804c-7980c8269352.webp',
  'Seat':          '/cars_logo/70d8c42e-96ce-4319-b870-ed6539f7d6d7.webp',
  'Ford':          '/cars_logo/0bcc6e5e-e534-4be7-96cb-4e5636fe1193.webp',
  'Volkswagen':    '/cars_logo/7acfe01c-82aa-4ef7-bbac-53c4d2501551.webp',
  'Mazda':         '/cars_logo/a70da5c5-7d77-461c-887f-e9d9a40084c6.webp',
  'Audi':          '/cars_logo/6fec8875-a792-4018-a9d8-551983320c50.webp',
  'Toyota':        '/cars_logo/1aed03ca-29ed-4558-8402-4ea3018b32d7.webp',
  'Nissan':        '/cars_logo/d1e7656d-04af-4f99-be4e-7e251d2aba18.webp',
  'Mercedes-Benz': '/cars_logo/daba8523-18d6-4b0d-88b8-52d6c8dae8bd.webp',
  'Land Rover':    '/cars_logo/e51d5e13-bd54-41dd-be39-b1205553deae.webp',
  'Dacia':         '/cars_logo/2f1e7b83-6c63-4228-8f74-00b1da91c2be.webp',
  'BMW':           '/cars_logo/2f976f0d-4a2a-45ba-9e8a-bd7ae2bb1e34.webp',
  'Kia':           '/cars_logo/160499-kia-free-transparent-image-hq.png',
  'Mitsubishi':    '/cars_logo/mitsubishi.png',
};

/* Case-insensitive lookup helpers */
const findBodyIcon = (name) => {
  const key = Object.keys(bodyIconMap).find(k => k.toLowerCase() === name?.toLowerCase()?.trim());
  return key ? bodyIconMap[key] : null;
};
const findBrandLogo = (name) => {
  const key = Object.keys(brandLogoMap).find(k => k.toLowerCase() === name?.toLowerCase()?.trim());
  return key ? brandLogoMap[key] : null;
};

function CatalogFilter() {
  const navigate = useNavigate();
  const [bodyTypes, setBodyTypes] = useState([]);
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    fetch('/api/cars/stats/counts')
      .then((r) => r.json())
      .then((data) => {
        if (data.bodyTypes) setBodyTypes(data.bodyTypes);
        if (data.brands) setBrands(data.brands);
      })
      .catch(() => {});
  }, []);

  return (
    <section className="catalog-filter">
      <div className="catalog-filter__inner">
        {bodyTypes.length > 0 && (
          <>
            <h3 className="catalog-filter__subtitle">По кузовам</h3>
            <div className="catalog-filter__grid catalog-filter__grid--body">
              {bodyTypes.map((item) => (
                <div className="catalog-filter__card" key={item.name} onClick={() => navigate(`/catalog?body_type=${encodeURIComponent(item.name)}`)}>
                  <span className="catalog-filter__card-icon">
                    {findBodyIcon(item.name) ? <img src={findBodyIcon(item.name)} alt={item.name} /> : null}
                  </span>
                  <span className="catalog-filter__card-name">{item.name}</span>
                  <span className="catalog-filter__card-count">{item.count}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {brands.length > 0 && (
          <>
            <h3 className="catalog-filter__subtitle">По маркам</h3>
            <div className="catalog-filter__grid catalog-filter__grid--brand">
              {brands.slice(0, 10).map((item) => (
                <div className="catalog-filter__card" key={item.name} onClick={() => navigate(`/catalog?brand=${encodeURIComponent(item.name)}`)}>
                  <span className="catalog-filter__card-logo">
                    {findBrandLogo(item.name) ? <img src={findBrandLogo(item.name)} alt={item.name} /> : null}
                  </span>
                  <span className="catalog-filter__card-name">{item.name}</span>
                  <span className="catalog-filter__card-count">{item.count}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default CatalogFilter;
