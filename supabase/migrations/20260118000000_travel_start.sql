-- The field app previously collapsed two spec-required timestamps into one
-- "Check In & Start Work" tap: "commence job from beginning of journey" and
-- "commence job at customer site" are distinct events (travel start vs site
-- arrival) and both matter for reports. `actual_start`/`check_in_lat`/
-- `check_in_lng` already cover site arrival — this adds the matching travel
-- half rather than repurposing an existing column.
alter table jobs add column actual_travel_start timestamptz;
alter table jobs add column travel_start_lat double precision;
alter table jobs add column travel_start_lng double precision;
