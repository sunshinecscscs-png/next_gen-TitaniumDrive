/**
 * Map a DB car object (from API) to the format used by catalog/detail cards.
 */
export function mapCar(c) {
  const imgs = Array.isArray(c.images) && c.images.length ? c.images : [c.image, c.image2].filter(Boolean);
  const d = c.created_at ? new Date(c.created_at) : new Date();
  const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

  return {
    id: c.id,
    name: c.name || '',
    brand: c.brand || '',
    model: c.model || '',
    year: c.year || '',
    spec: c.spec || '',
    price: formatPrice(c.price),
    rawPrice: Number(c.price) || 0,
    oldPrice: c.old_price ? formatPrice(c.old_price) : null,
    mileage: c.mileage || 0,
    date,
    color: { name: c.color_name || '', hex: c.color_hex || '#ccc' },
    image: imgs[0] || '/icons/body/placeholder.svg',
    image2: imgs[1] || imgs[0] || '/icons/body/placeholder.svg',
    images: imgs,
    description: c.description || '',
    tags: buildTags(c),
  };
}

function buildTags(c) {
  const t = {};
  if (c.condition) t.condition = c.condition;
  if (c.fuel) t.fuel = c.fuel;
  if (c.drive) t.drive = c.drive;
  if (c.transmission) t.transmission = c.transmission;
  if (c.consumption) t.consumption = c.consumption;
  if (c.engine) t.engine = c.engine;
  if (c.power) t.power = c.power;
  if (c.acceleration) t.acceleration = c.acceleration;
  if (c.trunk) t.trunk = c.trunk;
  if (c.body_type) t.bodyType = c.body_type;
  return t;
}

function formatPrice(v) {
  const n = Number(v);
  if (!n && n !== 0) return '0';
  return n.toLocaleString('ru-RU');
}
