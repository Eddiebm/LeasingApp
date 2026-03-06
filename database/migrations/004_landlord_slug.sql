-- Landlord slug for public apply URLs: /apply/<slug>

alter table landlords
  add column if not exists slug text unique;

create index if not exists idx_landlords_slug on landlords (slug);
