-- Migration 011: Property listing fields for social sharing
alter table properties
  add column if not exists is_listed boolean default false,
  add column if not exists listing_headline text,
  add column if not exists listing_description text,
  add column if not exists listing_photo_url text,
  add column if not exists bedrooms integer,
  add column if not exists bathrooms numeric(3,1),
  add column if not exists available_from date,
  add column if not exists listing_slug text;

-- Unique index on listing_slug (nullable, so use partial index)
create unique index if not exists idx_properties_listing_slug
  on properties (listing_slug)
  where listing_slug is not null;
