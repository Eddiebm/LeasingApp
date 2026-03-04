-- Run after schema.sql. Inserts one sample property.
insert into properties (address, city, state, zip, rent, status)
values ('3110 Keokuk St', 'St Louis', 'MO', '63118', 1895, 'active');
